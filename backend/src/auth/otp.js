import { db } from "../db/database.js";
import { config } from "../config.js";
import { sendSms } from "../telephony/notifier.js";

export function generateOtp(phone) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.prepare(
    `INSERT INTO otps (phone, code, attempts, expires_at)
     VALUES (?, ?, 0, ?)
     ON CONFLICT(phone) DO UPDATE SET code=excluded.code, attempts=0, expires_at=excluded.expires_at`
  ).run(phone, code, Date.now() + config.otpTtlMs);

  sendSms(phone, `Your PhoneMail verification code is ${code}. Valid for 5 minutes.`);
  return code;
}

export function verifyOtp(phone, code) {
  const row = db.prepare(`SELECT * FROM otps WHERE phone = ?`).get(phone);
  if (!row) return { ok: false, reason: "No OTP requested" };
  if (Date.now() > row.expires_at) {
    db.prepare(`DELETE FROM otps WHERE phone = ?`).run(phone);
    return { ok: false, fallbackToPassword: true, reason: "OTP expired — use password login" };
  }
  if (row.code !== code) {
    const attempts = row.attempts + 1;
    if (attempts >= config.otpMaxAttempts) {
      db.prepare(`DELETE FROM otps WHERE phone = ?`).run(phone);
      return { ok: false, fallbackToPassword: true, reason: "Too many attempts — use password login" };
    }
    db.prepare(`UPDATE otps SET attempts = ? WHERE phone = ?`).run(attempts, phone);
    return { ok: false, reason: `Invalid code (${config.otpMaxAttempts - attempts} attempts left)` };
  }
  db.prepare(`DELETE FROM otps WHERE phone = ?`).run(phone);
  return { ok: true };
}
