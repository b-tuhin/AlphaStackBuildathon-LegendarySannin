import crypto from "node:crypto";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { sendSms } from "../telephony/notifier.js";

export function issueResetCode(phone) {
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare(
    `INSERT INTO password_resets (phone, code, attempts, expires_at)
     VALUES (?, ?, 0, ?)
     ON CONFLICT(phone) DO UPDATE SET code=excluded.code, attempts=0, expires_at=excluded.expires_at`
  ).run(phone, code, Date.now() + config.resetCodeTtlMs);

  // Dual-format SMS template compatible with:
  // 1. WebOTP API: '@<domain> #<code>'
  // 2. Android SMS Retriever API: '<#>' prefix and 11-char app hash on the last line
  // 3. iOS keyboard suggestion: standard 'code is 123456' pattern
  const smsBody = `<#> Your PhoneMail password reset code is ${code}. Valid for 15 minutes.\n\n@${config.webDomain} #${code}\n${config.androidSmsHash}`;
  sendSms(phone, smsBody);
  return code;
}

export function consumeResetCode(phone, code) {
  const row = db.prepare(`SELECT * FROM password_resets WHERE phone = ?`).get(phone);
  if (!row) return { ok: false, reason: "Invalid or expired reset code" };
  if (Date.now() > row.expires_at) {
    db.prepare(`DELETE FROM password_resets WHERE phone = ?`).run(phone);
    return { ok: false, reason: "Invalid or expired reset code" };
  }
  if (row.code !== String(code || "")) {
    const attempts = row.attempts + 1;
    if (attempts >= config.resetMaxAttempts) {
      db.prepare(`DELETE FROM password_resets WHERE phone = ?`).run(phone);
      return { ok: false, reason: "Too many attempts. Request a new reset code." };
    }
    db.prepare(`UPDATE password_resets SET attempts = ? WHERE phone = ?`).run(attempts, phone);
    return { ok: false, reason: "Invalid or expired reset code" };
  }
  db.prepare(`DELETE FROM password_resets WHERE phone = ?`).run(phone);
  return { ok: true };
}
