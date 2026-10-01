import twilio from "twilio";
import { normalizePhone } from "../auth/password.js";
import { provisionTelephonyAccount } from "../routes/user.routes.js";

const { VoiceResponse } = twilio.twiml;
export function ivrEntry(_req, res) {
  const twiml = new VoiceResponse();
  const gather = twiml.gather({ numDigits: 1, action: "/webhooks/ivr/handle", method: "POST" });
  gather.say("Welcome to PhoneMail. Press 1 to create your email account using this phone number.");
  twiml.say("We did not receive input. Goodbye.");
  res.type("text/xml").send(twiml.toString());
}
export async function ivrHandle(req, res) {
  const twiml = new VoiceResponse();
  const caller = normalizePhone(req.body?.From);
  if (req.body?.Digits === "1" && caller) {
    try {
      const { user, created } = await provisionTelephonyAccount(caller, "ivr");
      twiml.say(created
        ? `Your PhoneMail account has been created. Your email address is ${user.email_address.split("").join(" ")}. A temporary password has been sent by text message. You must change it the first time you log in.`
        : "You already have a PhoneMail account. Goodbye.");
    } catch (err) {
      console.error("[ivr] account setup or SMS delivery failed:", err.code || err.name || "Error");
      twiml.say("We could not complete account setup right now. Please try again later.");
    }
  } else {
    twiml.say("Invalid input. Goodbye.");
  }
  res.type("text/xml").send(twiml.toString());
}
