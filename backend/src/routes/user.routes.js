import { Router } from "express";
import { v4 as uuid } from "uuid";
import jwt from "jsonwebtoken";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { phoneToEmail } from "../smtp/mailEngine.js";
import { hashPassword, generateTempPassword, normalizePhone } from "../auth/password.js";
import { sendSms } from "../telephony/notifier.js";

export function createUserIfMissing(phone, via = "app", extras = {}) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error("Invalid phone number");
  const existing = db.prepare("SELECT * FROM users WHERE phone=?").get(normalized);
  if (existing) return { user: existing, created: false };
  const user = {
    id: uuid(), phone: normalized, email_address: phoneToEmail(normalized), created_via: via,
    password_hash: extras.passwordHash ?? null, must_change_password: extras.mustChangePassword ? 1 : 0,
    tos_accepted_at: extras.tosAcceptedAt ?? null, tos_version: extras.tosVersion ?? null,
    phone_verified_at: extras.phoneVerifiedAt ?? null,
  };
  db.prepare(`INSERT INTO users (id,phone,email_address,created_via,password_hash,must_change_password,tos_accepted_at,tos_version,phone_verified_at)
    VALUES (@id,@phone,@email_address,@created_via,@password_hash,@must_change_password,@tos_accepted_at,@tos_version,@phone_verified_at)`).run(user);
  console.log(`[users] Created account via ${via}`);
  return { user, created: true };
}

const tempPasswordSms = (user, tempPassword) => `Welcome to PhoneMail! Your email is ${user.email_address}. Temporary password: ${tempPassword}. Change it the first time you log in.`;
export async function provisionTelephonyAccount(phone, via, { deliverSms = true } = {}) {
  const canonical = normalizePhone(phone);
  if (!canonical) throw new Error("Invalid caller phone number");
  const existing = db.prepare("SELECT * FROM users WHERE phone=?").get(canonical);
  if (existing) return { user: existing, created: false };
  const tempPassword = generateTempPassword();
  const { user, created } = createUserIfMissing(canonical, via, { passwordHash: hashPassword(tempPassword), mustChangePassword: true, phoneVerifiedAt: new Date().toISOString() });
  if (deliverSms) await sendSms(user.phone, tempPasswordSms(user, tempPassword));
  return { user, created };
}

const AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export function isValidAvatarAttachment(id) {
  if (!id || typeof id !== "string") return false;
  const att = db.prepare("SELECT mime_type FROM attachments WHERE id=?").get(id);
  return Boolean(att && AVATAR_MIME.has(String(att.mime_type).toLowerCase()));
}
export const avatarPath = (id) => (id ? `/mail/attachments/${id}` : null);
export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try { req.user = jwt.verify(token, config.jwtSecret); next(); }
  catch { res.status(401).json({ error: "Unauthorized" }); }
}

const router = Router();
router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id,phone,email_address,display_name,avatar_id,aliases,must_change_password,tos_accepted_at,tos_version,phone_verified_at FROM users WHERE id=?").get(req.user.sub);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ ...user, avatar_url: avatarPath(user.avatar_id), aliases: JSON.parse(user.aliases || "[]"), mustChangePassword: !!user.must_change_password, tosAccepted: !!user.tos_accepted_at });
});
router.patch("/me", requireAuth, (req, res) => {
  const body = req.body || {};
  if ("display_name" in body) db.prepare("UPDATE users SET display_name=? WHERE id=?").run(body.display_name ?? null, req.user.sub);
  if ("avatar_id" in body) {
    const avatarId = body.avatar_id || null;
    if (avatarId && !isValidAvatarAttachment(avatarId)) return res.status(400).json({ error: "Profile picture must be a JPEG, PNG, WebP or GIF image." });
    db.prepare("UPDATE users SET avatar_id=? WHERE id=?").run(avatarId, req.user.sub);
  }
  const row = db.prepare("SELECT display_name,avatar_id FROM users WHERE id=?").get(req.user.sub);
  res.json({ ok: true, display_name: row?.display_name ?? null, avatar_id: row?.avatar_id ?? null, avatar_url: avatarPath(row?.avatar_id) });
});
router.post("/me/tos", requireAuth, (req, res) => {
  const user = db.prepare("SELECT tos_accepted_at FROM users WHERE id=?").get(req.user.sub);
  if (!user) return res.status(404).json({ error: "Not found" });
  const now = user.tos_accepted_at || new Date().toISOString();
  db.prepare("UPDATE users SET tos_accepted_at=COALESCE(tos_accepted_at,?),tos_version=COALESCE(tos_version,?) WHERE id=?").run(now, config.tosVersion, req.user.sub);
  res.json({ ok: true, tosAcceptedAt: now });
});
router.get("/lookup/:identifier", requireAuth, (req, res) => {
  const raw = String(req.params.identifier).trim();
  const phone = normalizePhone(raw);
  const cleanAlias = raw.toLowerCase().replace(/@.*$/, "");
  let user = phone ? db.prepare("SELECT id,phone,email_address,display_name,avatar_id,aliases FROM users WHERE phone=?").get(phone) : null;
  if (!user) user = db.prepare("SELECT id,phone,email_address,display_name,avatar_id,aliases FROM users WHERE email_address=?").get(raw.toLowerCase());
  if (!user) {
    const map = db.prepare("SELECT user_id FROM alias_map WHERE alias=?").get(cleanAlias);
    if (map) user = db.prepare("SELECT id,phone,email_address,display_name,avatar_id,aliases FROM users WHERE id=?").get(map.user_id);
  }
  if (!user) return res.status(404).json({ error: "No PhoneMail user with that identifier" });
  let aliases = []; try { aliases = JSON.parse(user.aliases || "[]"); } catch {}
  res.json({ phone: user.phone, email_address: user.email_address, display_name: user.display_name, avatar_url: avatarPath(user.avatar_id), aliases });
});
router.get("/familiar", requireAuth, (req, res) => {
  const userRow = db.prepare("SELECT email_address FROM users WHERE id=?").get(req.user.sub);
  const myAddr = req.user.email || userRow?.email_address;
  if (!myAddr) return res.status(400).json({ error: "User email not found" });
  const one = db.prepare("SELECT participant_a,participant_b,last_message_at FROM threads WHERE is_group=0 AND (participant_a=? OR participant_b=?) ORDER BY last_message_at DESC").all(myAddr, myAddr);
  const groups = db.prepare("SELECT participants,last_message_at FROM threads WHERE is_group=1 ORDER BY last_message_at DESC").all();
  const found = new Map();
  for (const t of one) { const a = t.participant_a === myAddr ? t.participant_b : t.participant_a; if (a && a !== myAddr && !found.has(a)) found.set(a,t.last_message_at); }
  for (const t of groups) { try { for (const p of JSON.parse(t.participants || "[]")) if (p && p !== myAddr && !found.has(p)) found.set(p,t.last_message_at); } catch {} }
  const result = [];
  for (const [address,last_message_at] of found) {
    const local = address.split("@")[0];
    const phone = local.startsWith("+") ? normalizePhone(local) : normalizePhone(`+${local.replace(/\D/g, "")}`);
    const user = db.prepare("SELECT display_name,phone,email_address FROM users WHERE phone=? OR email_address=?").get(phone,address);
    result.push({ email_address:user?.email_address || address, phone:user?.phone || phone, display_name:user?.display_name || phone || address, last_message_at });
  }
  result.sort((a,b) => new Date(b.last_message_at)-new Date(a.last_message_at));
  res.json(result);
});
router.post("/me/aliases", requireAuth, (req, res) => {
  const alias = String(req.body?.alias || "").toLowerCase().trim();
  if (!/^[a-z0-9._-]{3,30}$/i.test(alias)) return res.status(400).json({ error: "Invalid alias. Must be 3-30 chars (letters, numbers, dot, underscore, dash)." });
  const taken = db.prepare("SELECT 1 FROM users WHERE phone=? OR email_address=?").get(alias, `${alias}@${config.mailDomain}`) || db.prepare("SELECT 1 FROM alias_map WHERE alias=?").get(alias);
  if (taken) return res.status(409).json({ error: "Alias unavailable" });
  const user = db.prepare("SELECT aliases FROM users WHERE id=?").get(req.user.sub);
  let aliases = []; try { aliases = JSON.parse(user?.aliases || "[]"); } catch {}
  if (!aliases.includes(alias)) aliases.push(alias);
  db.transaction(() => { db.prepare("INSERT INTO alias_map(alias,user_id) VALUES(?,?)").run(alias,req.user.sub); db.prepare("UPDATE users SET aliases=? WHERE id=?").run(JSON.stringify(aliases),req.user.sub); })();
  res.json({ aliases, aliasEmail: `${alias}@${config.mailDomain}` });
});
router.delete("/me/aliases/:alias", requireAuth, (req, res) => {
  const alias = String(req.params.alias || "").toLowerCase().trim();
  if (!alias) return res.status(400).json({ error: "Alias is required" });
  const user = db.prepare("SELECT aliases FROM users WHERE id=?").get(req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found" });
  let aliases = []; try { aliases = JSON.parse(user.aliases || "[]"); } catch {}
  aliases = aliases.filter((a) => a.toLowerCase().trim() !== alias);
  db.transaction(() => { db.prepare("DELETE FROM alias_map WHERE alias=? AND user_id=?").run(alias,req.user.sub); db.prepare("UPDATE users SET aliases=? WHERE id=?").run(JSON.stringify(aliases),req.user.sub); })();
  res.json({ ok:true, aliases });
});
router.post("/me/devices", requireAuth, (req, res) => {
  const { platform, pushToken } = req.body || {};
  db.prepare("INSERT OR IGNORE INTO device_registrations(id,user_id,platform,push_token) VALUES(?,?,?,?)").run(uuid(),req.user.sub,platform || "android",pushToken || null);
  res.json({ ok:true });
});
export default router;
