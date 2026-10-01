import { Router } from "express";
import crypto from "node:crypto";
import { v4 as uuid } from "uuid";
import jwt from "jsonwebtoken";
import { db } from "../db/database.js";
import { config } from "../config.js";
import {
  hashPassword,
  verifyPassword,
  normalizePhone,
  isValidPhone,
  assertPassword,
} from "../auth/password.js";
import {
  isLoginRateLimited,
  recordLoginFailure,
  clearLoginFailures,
  isRateLimited,
  recordFailure,
} from "../auth/rateLimit.js";
import { issueResetCode, consumeResetCode } from "../auth/reset.js";
import { createUserIfMissing, requireAuth } from "./user.routes.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a best-effort client IP that cannot be trivially spoofed.
 *  We read X-Forwarded-For only when the backend is behind a trusted reverse
 *  proxy (TRUST_PROXY=true).  Otherwise we fall back to the socket address. */
function clientIp(req) {
  if (process.env.TRUST_PROXY === "true") {
    const xff = req.headers["x-forwarded-for"];
    if (xff) return String(xff).split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

/** Composite rate-limit key: phone + IP so neither can be used alone to bypass. */
const registerKey = (phone, req) => `reg:${phone}:${clientIp(req)}`;
const resetKey = (phone, req) => `rst:${phone}:${clientIp(req)}`;

export const issueRefreshToken = (userId) => {
  const token = crypto.randomBytes(32).toString("hex");
  const ttlMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  const expiresAt = Date.now() + ttlMs;
  db.prepare(
    `INSERT INTO refresh_tokens (id, user_id, token, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(uuid(), userId, token, expiresAt);
  return token;
};

const issueToken = (user) =>
  jwt.sign(
    { sub: user.id, phone: user.phone, email: user.email_address },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

const authPayload = (user, extra = {}) => ({
  token: issueToken(user),
  refreshToken: issueRefreshToken(user.id),
  email: user.email_address,
  mustChangePassword: !!user.must_change_password,
  ...extra,
});

// ── Routes ────────────────────────────────────────────────────────────────────

router.post("/register", (req, res) => {
  // Rate-limit by phone+IP composite key.
  const phone = normalizePhone(req.body.phone);
  const rlKey = registerKey(phone, req);
  if (isRateLimited(rlKey, config.registerWindowMs, config.registerMaxAttempts)) {
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }

  if (!isValidPhone(phone)) {
    recordFailure(rlKey);
    return res.status(400).json({ error: "Invalid phone number" });
  }
  const passwordError = assertPassword(req.body.password, req.body.confirmPassword);
  if (passwordError) {
    recordFailure(rlKey);
    return res.status(400).json({ error: passwordError });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
  if (existing) {
    // Do NOT reveal that the phone is registered — return the same generic message
    // a login failure would return so callers cannot enumerate registered numbers.
    recordFailure(rlKey);
    return res.status(409).json({ error: "Invalid phone or password" });
  }

  const tosAcceptedAt = req.body.tosAccepted ? new Date().toISOString() : null;
  const { user, created } = createUserIfMissing(phone, "app", {
    passwordHash: hashPassword(req.body.password),
    mustChangePassword: false,
    tosAcceptedAt,
  });
  res.json(authPayload(user, { created, tosAccepted: !!tosAcceptedAt }));
});

router.post("/login", (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (phone && isLoginRateLimited(phone)) {
    return res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
  }

  const user = phone ? db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone) : null;
  if (!user || !verifyPassword(req.body.password, user.password_hash)) {
    if (phone) recordLoginFailure(phone);
    return res.status(401).json({ error: "Invalid phone or password" });
  }

  clearLoginFailures(phone);
  res.json(authPayload(user));
});

router.post("/password/reset-request", (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const rlKey = resetKey(phone, req);
  if (isRateLimited(rlKey, config.resetRequestWindowMs, config.resetRequestMaxAttempts)) {
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }

  if (!isValidPhone(phone)) {
    recordFailure(rlKey);
    return res.status(400).json({ error: "Invalid phone number" });
  }

  recordFailure(rlKey); // count every request, not just failures, to limit SMS flooding
  const user = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
  let resetCode;
  if (user) resetCode = issueResetCode(phone);

  res.json({
    ok: true,
    ...(config.twilio.mock && resetCode ? { resetCode } : {}),
  });
});

router.post("/password/reset-confirm", (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!isValidPhone(phone)) return res.status(400).json({ error: "Invalid phone number" });
  const passwordError = assertPassword(req.body.password, req.body.confirmPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const result = consumeResetCode(phone, req.body.code);
  if (!result.ok) return res.status(401).json({ error: result.reason });

  const user = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone);
  if (!user) return res.status(401).json({ error: "Invalid or expired reset code" });

  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(
    hashPassword(req.body.password),
    user.id
  );
  res.json({ ok: true });
});

router.post("/password/set", requireAuth, (req, res) => {
  const passwordError = assertPassword(req.body.password, req.body.confirmPassword ?? req.body.password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(
    hashPassword(req.body.password),
    req.user.sub
  );
  res.json({ ok: true, mustChangePassword: false });
});

router.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token is required" });
  }

  const record = db.prepare(
    `SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0`
  ).get(refreshToken);

  if (!record || Date.now() > record.expires_at) {
    if (record) {
      db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE token = ?`).run(refreshToken);
    }
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(record.user_id);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  // Issue new access token and optionally a rotated refresh token
  const token = issueToken(user);
  const newRefreshToken = issueRefreshToken(user.id);
  // Revoke old token
  db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE token = ?`).run(refreshToken);

  res.json({
    token,
    refreshToken: newRefreshToken,
    email: user.email_address,
    mustChangePassword: !!user.must_change_password,
  });
});

router.post("/logout", (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE token = ?`).run(refreshToken);
  }
  res.json({ ok: true });
});

export default router;

