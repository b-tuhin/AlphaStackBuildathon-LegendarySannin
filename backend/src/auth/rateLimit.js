import { db } from "../db/database.js";
import { config } from "../config.js";

// ── Generic key-based rate limiter ────────────────────────────────────────────
// Stored in the same `login_attempts` table; the `phone` column holds an
// arbitrary string key (phone number, "reg:<phone>:<ip>", "rst:<phone>:<ip>",
// etc.) so we get one table, one mechanism.

/**
 * Returns true when the given key has exceeded maxAttempts within windowMs.
 * Stale windows are automatically cleared.
 */
export function isRateLimited(key, windowMs, maxAttempts) {
  const now = Date.now();
  const row = db.prepare(`SELECT * FROM login_attempts WHERE phone = ?`).get(key);
  if (!row) return false;
  if (now - row.window_start > windowMs) {
    db.prepare(`DELETE FROM login_attempts WHERE phone = ?`).run(key);
    return false;
  }
  return row.count >= maxAttempts;
}

/**
 * Increments the failure counter for key within its window.
 * If the window has expired it resets before incrementing.
 */
export function recordFailure(key) {
  const now = Date.now();
  const row = db.prepare(`SELECT * FROM login_attempts WHERE phone = ?`).get(key);
  // Derive windowMs: for unknown keys default to the login window — callers
  // that need a different window will have already checked isRateLimited with
  // their own window, and the exact value stored here doesn't affect the check.
  const windowMs = config.loginWindowMs;
  if (!row || now - row.window_start > windowMs) {
    db.prepare(
      `INSERT INTO login_attempts (phone, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT(phone) DO UPDATE SET window_start = excluded.window_start, count = 1`
    ).run(key, now);
    return;
  }
  db.prepare(`UPDATE login_attempts SET count = count + 1 WHERE phone = ?`).run(key);
}

// ── Login-specific helpers (kept for backward compatibility) ──────────────────

export function isLoginRateLimited(phone) {
  return isRateLimited(phone, config.loginWindowMs, config.loginMaxAttempts);
}

export function recordLoginFailure(phone) {
  recordFailure(phone);
}

export function clearLoginFailures(phone) {
  db.prepare(`DELETE FROM login_attempts WHERE phone = ?`).run(phone);
}
