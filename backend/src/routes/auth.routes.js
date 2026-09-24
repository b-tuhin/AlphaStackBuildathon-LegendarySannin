import { Router } from "express";
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
import { isLoginRateLimited, recordLoginFailure, clearLoginFailures } from "../auth/rateLimit.js";
import { issueResetCode, consumeResetCode } from "../auth/reset.js";
import { createUserIfMissing, requireAuth } from "./user.routes.js";

const router = Router();

const issueToken = (user) =>
  jwt.sign({ sub: user.id, phone: user.phone, email: user.email_address }, config.jwtSecret, { expiresIn: "30d" });

const authPayload = (user, extra = {}) => ({
  token: issueToken(user),
  email: user.email_address,
  mustChangePassword: !!user.must_change_password,
  ...extra,
});

router.post("/register", (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!isValidPhone(phone)) return res.status(400).json({ error: "Invalid phone number" });
  const passwordError = assertPassword(req.body.password, req.body.confirmPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const existing = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
  if (existing) {
    return res.status(409).json({ error: "An account with this phone already exists. Please log in." });
  }

  const { user, created } = createUserIfMissing(phone, "app", {
    passwordHash: hashPassword(req.body.password),
    mustChangePassword: false,
  });
  res.json(authPayload(user, { created }));
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
  if (!isValidPhone(phone)) return res.status(400).json({ error: "Invalid phone number" });

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

export default router;
