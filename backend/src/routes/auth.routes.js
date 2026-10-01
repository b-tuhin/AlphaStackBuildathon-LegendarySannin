import { Router } from "express";
import crypto from "node:crypto";
import { v4 as uuid } from "uuid";
import jwt from "jsonwebtoken";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { hashPassword, verifyPassword, normalizePhone, isValidPhone, assertPassword } from "../auth/password.js";
import { startPhoneOtp, checkPhoneOtp, consumeSignupGrant } from "../auth/otp.js";
import { isLoginRateLimited, recordLoginFailure, clearLoginFailures, isRateLimited, recordFailure } from "../auth/rateLimit.js";
import { createUserIfMissing, requireAuth } from "./user.routes.js";

const router = Router();

function clientIp(req) {
  if (process.env.TRUST_PROXY === "true") {
    const xff = req.headers["x-forwarded-for"];
    if (xff) return String(xff).split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

const registerKey = (phone, req) => `reg:${phone}:${clientIp(req)}`;
const resetKey = (phone, req) => `rst:${phone}:${clientIp(req)}`;

export const issueRefreshToken = (userId) => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  db.prepare(`INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`).run(uuid(), userId, token, expiresAt);
  return token;
};

const issueToken = (user) =>
  jwt.sign({ sub: user.id, phone: user.phone, email: user.email_address }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const authPayload = (user, extra = {}) => ({
  token: issueToken(user),
  refreshToken: issueRefreshToken(user.id),
  email: user.email_address,
  mustChangePassword: !!user.must_change_password,
  ...extra,
});

router.post("/phone/start", async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const purpose = req.body?.purpose;
  if (!isValidPhone(phone)) return res.status(400).json({ error: "Invalid phone number" });
  try {
    const started = await startPhoneOtp(phone, purpose, clientIp(req));
    if (!started.ok) return res.status(400).json({ error: "Could not start verification" });
    return res.json({ ok: true, limited: !!started.limited, mode: started.mode || config.otpMode });
  } catch (err) {
    console.error("[auth] OTP start failed:", err.code || err.name || "Error");
    return res.status(503).json({ error: "Phone verification is unavailable" });
  }
});

router.post("/phone/check", async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!isValidPhone(phone)) return res.status(400).json({ error: "Invalid phone number" });
  let result;
  try {
    result = await checkPhoneOtp(phone, req.body?.code, req.body?.purpose, clientIp(req));
  } catch {
    return res.status(401).json({ error: "Invalid or expired code" });
  }
  if (!result.ok) return res.status(result.limited ? 429 : 401).json({ error: "Invalid or expired code" });
  return res.json({ ok: true, ...(result.signupGrant ? { signupGrant: result.signupGrant } : {}) });
});

router.post("/register", (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const rlKey = registerKey(phone, req);
  if (isRateLimited(rlKey, config.registerWindowMs, config.registerMaxAttempts)) {
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }
  if (!isValidPhone(phone)) {
    recordFailure(rlKey);
    return res.status(400).json({ error: "Invalid phone number" });
  }
  const passwordError = assertPassword(req.body?.password, req.body?.confirmPassword);
  if (passwordError) {
    recordFailure(rlKey);
    return res.status(400).json({ error: passwordError });
  }
  const existing = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
  if (existing) {
    recordFailure(rlKey);
    return res.status(409).json({ error: "Invalid phone or password" });
  }
  const twilioMode = config.otpMode === "twilio";
  if (twilioMode && !consumeSignupGrant(phone, req.body?.signupGrant)) {
    recordFailure(rlKey);
    return res.status(403).json({ error: "Phone verification required" });
  }
  const tosAcceptedAt = req.body?.tosAccepted ? new Date().toISOString() : null;
  const { user, created } = createUserIfMissing(phone, "app", {
    passwordHash: hashPassword(req.body.password),
    mustChangePassword: false,
    tosAcceptedAt,
    phoneVerifiedAt: twilioMode ? new Date().toISOString() : null,
  });
  res.json(authPayload(user, { created, tosAccepted: !!tosAcceptedAt }));
});

router.post("/phone/exists", (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!isValidPhone(phone)) return res.status(400).json({ error: "Invalid phone number" });
  const key = `exists:${phone}:${clientIp(req)}`;
  if (isRateLimited(key, 60 * 1000, 20)) return res.status(429).json({ error: "Too many attempts. Try again later." });
  recordFailure(key);
  const user = db.prepare(`SELECT 1 FROM users WHERE phone = ?`).get(phone);
  return res.json({ exists: !!user });
});
router.post("/login", (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (phone && isLoginRateLimited(phone)) {
    return res.status(429).json({ error: "Too many login attempts. Try again in 15 minutes." });
  }
  const user = phone ? db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone) : null;
  if (!user || !verifyPassword(req.body?.password, user.password_hash)) {
    if (phone) recordLoginFailure(phone);
    return res.status(401).json({ error: "Invalid phone or password" });
  }
  clearLoginFailures(phone);
  res.json(authPayload(user));
});

router.post("/password/reset-request", async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const rlKey = resetKey(phone, req);
  if (isRateLimited(rlKey, config.resetRequestWindowMs, config.resetRequestMaxAttempts)) {
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }
  if (!isValidPhone(phone)) {
    recordFailure(rlKey);
    return res.status(400).json({ error: "Invalid phone number" });
  }
  recordFailure(rlKey);
  try {
    await startPhoneOtp(phone, "reset", clientIp(req));
  } catch (err) {
    console.error("[auth] Reset OTP start failed:", err.code || err.name || "Error");
  }
  return res.json({ ok: true, message: "If this number has an account and can receive a code, one has been sent." });
});

router.post("/password/reset-confirm", async (req, res) => {
  const bad = { error: "Invalid or expired reset code." };
  const phone = normalizePhone(req.body?.phone);
  if (!isValidPhone(phone)) return res.status(401).json(bad);
  const passwordError = assertPassword(req.body?.password, req.body?.confirmPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });
  let result;
  try {
    result = await checkPhoneOtp(phone, req.body?.code, "reset", clientIp(req));
  } catch {
    return res.status(401).json(bad);
  }
  if (!result.ok) return res.status(401).json(bad);
  const user = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone);
  if (!user) return res.status(401).json(bad);
  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(hashPassword(req.body.password), user.id);
  return res.json({ ok: true });
});

router.post("/password/set", requireAuth, (req, res) => {
  const passwordError = assertPassword(req.body?.password, req.body?.confirmPassword ?? req.body?.password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(hashPassword(req.body.password), req.user.sub);
  return res.json({ ok: true, mustChangePassword: false });
});

router.post("/password/change", requireAuth, (req, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.sub);
  if (!user || !verifyPassword(req.body?.currentPassword, user.password_hash)) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  const passwordError = assertPassword(req.body?.password, req.body?.confirmPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });
  db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).run(hashPassword(req.body.password), user.id);
  return res.json({ ok: true });
});

router.post("/refresh", (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (!refreshToken) return res.status(400).json({ error: "Refresh token is required" });
  const record = db.prepare(`SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0`).get(refreshToken);
  if (!record || Date.now() > record.expires_at) {
    if (record) db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE token = ?`).run(refreshToken);
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(record.user_id);
  if (!user) return res.status(401).json({ error: "User not found" });
  const token = issueToken(user);
  const newRefreshToken = issueRefreshToken(user.id);
  db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE token = ?`).run(refreshToken);
  res.json({ token, refreshToken: newRefreshToken, email: user.email_address, mustChangePassword: !!user.must_change_password });
});

router.post("/logout", (req, res) => {
  const refreshToken = req.body?.refreshToken;
  if (refreshToken) db.prepare(`UPDATE refresh_tokens SET revoked = 1 WHERE token = ?`).run(refreshToken);
  res.json({ ok: true });
});

export default router;