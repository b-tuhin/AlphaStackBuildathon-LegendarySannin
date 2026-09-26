import { Router } from "express";
import { v4 as uuid } from "uuid";
import jwt from "jsonwebtoken";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { phoneToEmail } from "../smtp/mailEngine.js";
import { hashPassword, generateTempPassword } from "../auth/password.js";
import { sendSms } from "../telephony/notifier.js";

export function createUserIfMissing(phone, via = "app", extras = {}) {
  const normalized = phone.replace(/[^\d]/g, "");
  let user = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(normalized);
  if (user) return { user, created: false };
  user = {
    id: uuid(),
    phone: normalized,
    email_address: phoneToEmail(normalized),
    created_via: via,
    password_hash: extras.passwordHash ?? null,
    must_change_password: extras.mustChangePassword ? 1 : 0,
    tos_accepted_at: extras.tosAcceptedAt ?? null,
  };
  db.prepare(
    `INSERT INTO users (id, phone, email_address, created_via, password_hash, must_change_password, tos_accepted_at)
     VALUES (@id, @phone, @email_address, @created_via, @password_hash, @must_change_password, @tos_accepted_at)`
  ).run(user);
  console.log(`[users] Created ${user.email_address} via ${via}`);
  return { user, created: true };
}

const tempPasswordSms = (user, tempPassword) =>
  `Welcome to PhoneMail! Your email is ${user.email_address}. Temporary password: ${tempPassword}. Change it the first time you log in.`;

/** IVR / inbound-SMS signup: create the account and issue a temporary password. */
export function provisionTelephonyAccount(phone, via, { deliverSms = true } = {}) {
  const existing = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(String(phone).replace(/[^\d]/g, ""));
  if (existing) return { user: existing, created: false };

  const tempPassword = generateTempPassword();
  const { user, created } = createUserIfMissing(phone, via, {
    passwordHash: hashPassword(tempPassword),
    mustChangePassword: true,
  });
  if (deliverSms) sendSms(user.phone, tempPasswordSms(user, tempPassword));
  return { user, created, tempPassword };
}

export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

const router = Router();

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare(
    `SELECT id, phone, email_address, display_name, aliases, must_change_password, tos_accepted_at FROM users WHERE id = ?`
  ).get(req.user.sub);
  res.json({
    ...user,
    aliases: JSON.parse(user.aliases),
    mustChangePassword: !!user.must_change_password,
    tosAccepted: !!user.tos_accepted_at,
  });
});

router.patch("/me", requireAuth, (req, res) => {
  const { display_name } = req.body;
  db.prepare(`UPDATE users SET display_name = ? WHERE id = ?`).run(display_name ?? null, req.user.sub);
  res.json({ ok: true });
});

// Record ToS acceptance (idempotent: only sets the timestamp once; subsequent
// calls return the original timestamp so the client can display "accepted on …")
router.post("/me/tos", requireAuth, (req, res) => {
  const user = db.prepare(`SELECT tos_accepted_at FROM users WHERE id = ?`).get(req.user.sub);
  if (!user) return res.status(404).json({ error: "Not found" });
  if (!user.tos_accepted_at) {
    const now = new Date().toISOString();
    db.prepare(`UPDATE users SET tos_accepted_at = ? WHERE id = ?`).run(now, req.user.sub);
    return res.json({ ok: true, tosAcceptedAt: now });
  }
  // Already accepted — return existing timestamp (idempotent)
  res.json({ ok: true, tosAcceptedAt: user.tos_accepted_at });
});

// Look up a user by phone (for "search a phone number to start a chat")
router.get("/lookup/:phone", requireAuth, (req, res) => {
  const phone = req.params.phone.replace(/[^\d]/g, "");
  const user = db.prepare(`SELECT phone, email_address, display_name FROM users WHERE phone = ?`).get(phone);
  if (!user) return res.status(404).json({ error: "No PhoneMail user with that number" });
  res.json(user);
});

// Familiar recipients (recent/known contacts from conversations)
router.get("/familiar", requireAuth, (req, res) => {
  const userRow = db.prepare(`SELECT email_address FROM users WHERE id = ?`).get(req.user.sub);
  const myAddr = req.user.email || userRow?.email_address;
  if (!myAddr) return res.status(400).json({ error: "User email not found" });

  const oneToOneThreads = db.prepare(
    `SELECT participant_a, participant_b, last_message_at
     FROM threads
     WHERE is_group = 0 AND (participant_a = ? OR participant_b = ?)
     ORDER BY last_message_at DESC`
  ).all(myAddr, myAddr);

  const groupThreads = db.prepare(
    `SELECT participants, last_message_at
     FROM threads
     WHERE is_group = 1 AND participants LIKE '%' || ? || '%'
     ORDER BY last_message_at DESC`
  ).all(myAddr);

  const contactMap = new Map();

  for (const t of oneToOneThreads) {
    const counterpart = t.participant_a === myAddr ? t.participant_b : t.participant_a;
    if (counterpart && counterpart !== myAddr && !contactMap.has(counterpart)) {
      contactMap.set(counterpart, t.last_message_at);
    }
  }

  for (const t of groupThreads) {
    try {
      const parts = JSON.parse(t.participants || "[]");
      for (const p of parts) {
        if (p && p !== myAddr && !contactMap.has(p)) {
          contactMap.set(p, t.last_message_at);
        }
      }
    } catch {}
  }

  const results = [];
  for (const [address, last_message_at] of contactMap.entries()) {
    const phone = address.split("@")[0].replace(/[^\d]/g, "");
    const user = db.prepare(`SELECT display_name, phone, email_address FROM users WHERE phone = ? OR email_address = ?`).get(phone, address);
    results.push({
      email_address: user?.email_address || address,
      phone: user?.phone || phone,
      display_name: user?.display_name || phone || address,
      last_message_at,
    });
  }

  results.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  res.json(results);
});

router.post("/me/aliases", requireAuth, (req, res) => {
  const { alias } = req.body;
  if (!alias || !/^[a-z0-9._-]{3,30}$/.test(alias)) return res.status(400).json({ error: "Invalid alias" });
  const taken = db.prepare(`SELECT 1 FROM users WHERE phone = ? OR aliases LIKE ?`).get(alias, `%"${alias}"%`);
  if (taken) return res.status(409).json({ error: "Alias unavailable" });
  const user = db.prepare(`SELECT aliases FROM users WHERE id = ?`).get(req.user.sub);
  const aliases = JSON.parse(user.aliases);
  aliases.push(alias);
  db.prepare(`UPDATE users SET aliases = ? WHERE id = ?`).run(JSON.stringify(aliases), req.user.sub);
  res.json({ aliases, aliasEmail: `${alias}@${config.mailDomain}` });
});

router.post("/me/devices", requireAuth, (req, res) => {
  const { platform, pushToken } = req.body;
  db.prepare(
    `INSERT OR IGNORE INTO device_registrations (id, user_id, platform, push_token) VALUES (?, ?, ?, ?)`
  ).run(uuid(), req.user.sub, platform || "android", pushToken || null);
  res.json({ ok: true });
});

export default router;
