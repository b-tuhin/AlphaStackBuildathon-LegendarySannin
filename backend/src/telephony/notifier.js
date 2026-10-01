import twilio from "twilio";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { normalizePhone } from "../auth/password.js";

const client = config.twilio.accountSid && config.twilio.authToken ? twilio(config.twilio.accountSid, config.twilio.authToken) : null;
const clean = (value, max) => String(value || "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export async function sendSms(toPhone, body) {
  const to = normalizePhone(toPhone);
  if (!to) throw new Error("Invalid SMS destination");
  if (config.twilio.mock) throw new Error("SMS mock mode is enabled; delivery is disabled");
  if (!client || !config.twilio.phoneNumber) throw new Error("SMS delivery is not configured");
  const from = normalizePhone(config.twilio.phoneNumber);
  if (!from) throw new Error("Invalid SMS sender number");
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const message = await client.messages.create({ body, from, to });
      console.log(`[sms] sent sid=${message.sid}`);
      return message;
    } catch (err) {
      lastError = err;
      console.error(`[sms] delivery failed attempt=${attempt + 1} code=${err.code || "unknown"} status=${err.status || "unknown"}`);
    }
  }
  throw lastError || new Error("SMS delivery failed");
}

/** Deliver the requested transactional alert only to PhoneMail recipients without a mobile device. */
export async function notifyRecipient(toAddress, fromAddress, subject) {
  const local = String(toAddress || "").split("@")[0];
  const phone = normalizePhone(local.startsWith("+") ? local : `+${local.replace(/\D/g, "")}`);
  if (!phone) return;
  const user = db.prepare(`SELECT u.id,u.phone FROM users u
    LEFT JOIN alias_map a ON a.user_id=u.id
    WHERE u.phone=? OR lower(u.email_address)=lower(?) OR a.alias=lower(?)`).get(phone, toAddress, local.toLowerCase());
  if (!user) return;
  const hasDevice = db.prepare("SELECT 1 FROM device_registrations WHERE user_id=? AND platform IN ('android','ios') LIMIT 1").get(user.id);
  if (hasDevice) return;
  const sender = clean(fromAddress, 48) || "an email address";
  const safeSubject = clean(subject, 80) || "(no subject)";
  let body = `You have received an email from ${sender}. Subject: ${safeSubject}.`;
  if (body.length > 160) body = `${body.slice(0, 157)}...`;
  await sendSms(user.phone, body);
}

export async function notifyGroup(addresses, fromAddress, subject) {
  const recipients = [...new Set(addresses || [])].filter((addr) => addr !== fromAddress);
  await Promise.all(recipients.map((addr) => notifyRecipient(addr, fromAddress, subject)));
}
