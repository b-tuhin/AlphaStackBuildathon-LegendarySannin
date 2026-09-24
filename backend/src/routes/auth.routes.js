import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { generateOtp, verifyOtp } from "../auth/otp.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { createUserIfMissing, requireAuth } from "./user.routes.js";

const router = Router();

const issueToken = (user) =>
  jwt.sign({ sub: user.id, phone: user.phone, email: user.email_address }, config.jwtSecret, { expiresIn: "30d" });

router.post("/otp/request", (req, res) => {
  const phone = String(req.body.phone || "").replace(/[^\d]/g, "");
  if (phone.length < 7) return res.status(400).json({ error: "Invalid phone number" });
  const code = generateOtp(phone);
  res.json({ ok: true, ...(config.twilio.mock ? { devCode: code } : {}) });
});

router.post("/otp/verify", (req, res) => {
  const phone = String(req.body.phone || "").replace(/[^\d]/g, "");
  const result = verifyOtp(phone, String(req.body.code || ""));
  if (!result.ok) {
    return res.status(401).json({ error: result.reason, fallbackToPassword: !!result.fallbackToPassword });
  }
  const { user, created } = createUserIfMissing(phone, "app");
  res.json({ token: issueToken(user), created, email: user.email_address });
});

router.post("/password/login", (req, res) => {
  const phone = String(req.body.phone || "").replace(/[^\d]/g, "");
  const user = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone);
  if (!user || !verifyPassword(req.body.password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid phone or password" });
  }
  res.json({ token: issueToken(user), email: user.email_address });
});

router.post("/password/set", requireAuth, (req, res) => {
  if (!req.body.password || req.body.password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(req.body.password), req.user.sub);
  res.json({ ok: true });
});

export default router;
