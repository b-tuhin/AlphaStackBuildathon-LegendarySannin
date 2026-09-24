import twilio from "twilio";
import { db } from "../db/database.js";
import { config } from "../config.js";

const client = !config.twilio.mock && config.twilio.accountSid
  ? twilio(config.twilio.accountSid, config.twilio.authToken)
  : null;

export function sendSms(toPhone, body) {
  if (config.twilio.mock || !client) {
    console.log(`[sms:MOCK] To +${toPhone}: "${body}"`);
    return Promise.resolve({ mock: true });
  }
  return client.messages.create({
    body,
    from: config.twilio.phoneNumber,
    to: toPhone.startsWith("+") ? toPhone : `+${toPhone}`,
  }).catch(err => console.error("[sms] Twilio error:", err.message));
}

/** SMS-notify a single recipient (by @phonemail.com address) who lacks the app. */
export function notifyRecipient(toAddress, fromAddress, subject) {
  const phone = toAddress.split("@")[0];
  const user = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
  if (!user) return;

  const hasApp = db.prepare(
    `SELECT 1 FROM device_registrations WHERE user_id = ? AND platform IN ('android','ios') LIMIT 1`
  ).get(user.id);

  if (!hasApp) {
    sendSms(phone, `You have received an email from ${fromAddress}. Subject: ${subject || "(no subject)"}`);
  } else {
    console.log(`[notify] ${phone} has the app installed — push path (SMS skipped)`);
  }
}

/** Notify every recipient in a group thread except the sender. */
export function notifyGroup(addresses, fromAddress, subject) {
  for (const addr of addresses) {
    if (addr === fromAddress) continue;
    notifyRecipient(addr, fromAddress, subject);
  }
}
