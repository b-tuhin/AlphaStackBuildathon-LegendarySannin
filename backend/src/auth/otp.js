import crypto from "node:crypto";
import twilio from "twilio";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { normalizePhone, isValidPhone } from "./password.js";

const twilioClient = config.twilio.accountSid && config.twilio.authToken
  ? twilio(config.twilio.accountSid, config.twilio.authToken)
  : null;
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export function normalizeOtpPhone(input) { return normalizePhone(input); }
export function validOtpPhone(phone) { return isValidPhone(phone); }

function rateLimit(bucket, key, windowMs, limit, now = Date.now()) {
  const row = db.prepare("SELECT window_start,count FROM otp_rate_limits WHERE bucket=? AND rate_key=?").get(bucket, key);
  if (!row || now - row.window_start >= windowMs) {
    db.prepare(`INSERT INTO otp_rate_limits(bucket,rate_key,window_start,count,last_at) VALUES(?,?,?,1,?)
      ON CONFLICT(bucket,rate_key) DO UPDATE SET window_start=excluded.window_start,count=1,last_at=excluded.last_at`).run(bucket, key, now, now);
    return false;
  }
  if (row.count >= limit) return true;
  db.prepare("UPDATE otp_rate_limits SET count=count+1,last_at=? WHERE bucket=? AND rate_key=?").run(now, bucket, key);
  return false;
}

function issueChallenge(phone, purpose, codeHash, now = Date.now()) {
  db.prepare(`INSERT INTO phone_challenges(phone,purpose,started_at,checks,verified,expires_at,code_hash)
    VALUES(?,?,?,0,0,?,?) ON CONFLICT(phone,purpose) DO UPDATE SET started_at=excluded.started_at,checks=0,verified=0,expires_at=excluded.expires_at,code_hash=excluded.code_hash`)
    .run(phone, purpose, now, now + config.otp.ttlMs, codeHash);
}

export async function startPhoneOtp(phoneInput, purpose, ip) {
  const phone = normalizePhone(phoneInput);
  if (!isValidPhone(phone) || !["signup", "reset"].includes(purpose)) return { ok: false, limited: false };
  if (config.otpMode === "password" && purpose === "signup") return { ok: true, limited: false, mode: "password" };
  const previous = db.prepare("SELECT started_at FROM phone_challenges WHERE phone=? ORDER BY started_at DESC LIMIT 1").get(phone);
  if (previous && Date.now() - previous.started_at < config.otp.resendCooldownMs) return { ok: true, limited: true };
  if (rateLimit("phone-start", phone, 24 * 60 * 60 * 1000, config.otp.maxStartsPerPhoneDay)) return { ok: true, limited: true };
  if (rateLimit("ip-start", ip || "unknown", 24 * 60 * 60 * 1000, config.otp.maxStartsPerIpDay)) return { ok: true, limited: true };

  if (!twilioClient || !config.twilio.verifyServiceSid) throw new Error("Phone verification service is unavailable");
  issueChallenge(phone, purpose, null);
  await twilioClient.verify.v2.services(config.twilio.verifyServiceSid).verifications.create({ to: phone, channel: "sms" });
  return { ok: true, limited: false, mode: "twilio" };
}

export function issueSignupGrant(phone, now = Date.now()) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO signup_grants(token_hash,phone,created_at,expires_at,consumed_at) VALUES(?,?,?,?,NULL)")
    .run(hashToken(token), phone, now, now + config.otp.ttlMs);
  return token;
}

export function consumeSignupGrant(phoneInput, token, now = Date.now()) {
  const phone = normalizePhone(phoneInput);
  if (!phone || typeof token !== "string" || !token) return false;
  const result = db.prepare(`UPDATE signup_grants SET consumed_at=?
    WHERE token_hash=? AND phone=? AND consumed_at IS NULL AND expires_at>=?`)
    .run(now, hashToken(token), phone, now);
  return result.changes === 1;
}

export async function checkPhoneOtp(phoneInput, code, purpose, ip) {
  const phone = normalizePhone(phoneInput);
  if (!isValidPhone(phone) || !["signup", "reset"].includes(purpose) || !/^\d{4,10}$/.test(String(code || ""))) return { ok: false };
  if (rateLimit("ip-check", ip || "unknown", 60 * 60 * 1000, config.otp.maxChecksPerIpHour)) return { ok: false, limited: true };
  const row = db.prepare("SELECT * FROM phone_challenges WHERE phone=? AND purpose=?").get(phone, purpose);
  if (!row || row.verified || Date.now() > row.expires_at || row.checks >= config.otp.maxChecks) return { ok: false };
  const nextChecks = row.checks + 1;
  db.prepare("UPDATE phone_challenges SET checks=? WHERE phone=? AND purpose=?").run(nextChecks, phone, purpose);

  let approved = false;
  if (config.otpMode === "twilio" || purpose === "reset") {
    if (!twilioClient || !config.twilio.verifyServiceSid) return { ok: false };
    try {
      const result = await twilioClient.verify.v2.services(config.twilio.verifyServiceSid).verificationChecks.create({ to: phone, code: String(code) });
      approved = result.status === "approved";
    } catch {
      approved = false;
    }
  } else {
    approved = row.code_hash === hashToken(String(code));
  }
  if (!approved) return { ok: false };
  const mark = db.prepare("UPDATE phone_challenges SET verified=1 WHERE phone=? AND purpose=? AND verified=0 AND expires_at>=?").run(phone, purpose, Date.now());
  if (mark.changes !== 1) return { ok: false };
  return { ok: true, ...(purpose === "signup" ? { signupGrant: issueSignupGrant(phone) } : {}) };
}

export function isTwilioSignatureValid(req, publicBaseUrl = config.publicBaseUrl, authToken = config.twilio.authToken) {
  const signature = req.get ? req.get("X-Twilio-Signature") : req.headers?.["x-twilio-signature"];
  if (!signature || !publicBaseUrl || !authToken) return false;
  const url = `${publicBaseUrl}${req.originalUrl || req.url || ""}`;
  try { return twilio.validateRequest(authToken, signature, url, req.body || {}); }
  catch { return false; }
}
