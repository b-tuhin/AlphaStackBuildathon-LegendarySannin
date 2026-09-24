import twilio from "twilio";
import { createUserIfMissing } from "../routes/user.routes.js";

const { VoiceResponse } = twilio.twiml;

/** POST /webhooks/ivr — initial call: play menu */
export function ivrEntry(req, res) {
  const twiml = new VoiceResponse();
  const gather = twiml.gather({ numDigits: 1, action: "/webhooks/ivr/handle", method: "POST" });
  gather.say("Welcome to PhoneMail. Press 1 to create your email account using this phone number.");
  twiml.say("We did not receive input. Goodbye.");
  res.type("text/xml").send(twiml.toString());
}

/** POST /webhooks/ivr/handle — digit pressed */
export function ivrHandle(req, res) {
  const twiml = new VoiceResponse();
  const digit = req.body.Digits;
  const caller = (req.body.From || "").replace(/[^\d]/g, "");

  if (digit === "1" && caller) {
    const { user, created } = createUserIfMissing(caller, "ivr");
    twiml.say(
      created
        ? `Your PhoneMail account has been created. Your email address is ${user.email_address.split("").join(" ")}.`
        : "You already have a PhoneMail account. Goodbye."
    );
  } else {
    twiml.say("Invalid input. Goodbye.");
  }
  res.type("text/xml").send(twiml.toString());
}
