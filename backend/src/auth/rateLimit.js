import { db } from "../db/database.js";
import { config } from "../config.js";

export function isLoginRateLimited(phone) {
  const now = Date.now();
  const row = db.prepare(`SELECT * FROM login_attempts WHERE phone = ?`).get(phone);
  if (!row) return false;
  if (now - row.window_start > config.loginWindowMs) {
    db.prepare(`DELETE FROM login_attempts WHERE phone = ?`).run(phone);
    return false;
  }
  return row.count >= config.loginMaxAttempts;
}

export function recordLoginFailure(phone) {
  const now = Date.now();
  const row = db.prepare(`SELECT * FROM login_attempts WHERE phone = ?`).get(phone);
  if (!row || now - row.window_start > config.loginWindowMs) {
    db.prepare(
      `INSERT INTO login_attempts (phone, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT(phone) DO UPDATE SET window_start = excluded.window_start, count = 1`
    ).run(phone, now);
    return;
  }
  db.prepare(`UPDATE login_attempts SET count = count + 1 WHERE phone = ?`).run(phone);
}

export function clearLoginFailures(phone) {
  db.prepare(`DELETE FROM login_attempts WHERE phone = ?`).run(phone);
}
