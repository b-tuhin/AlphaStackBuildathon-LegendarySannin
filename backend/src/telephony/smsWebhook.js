import twilio from "twilio";
import { createUserIfMissing } from "../routes/user.routes.js";

const { MessagingResponse } = twilio.twiml;

/** POST /webhooks/sms — any inbound SMS creates an account */
export function smsInbound(req, res) {
  const twiml = new MessagingResponse();
  const sender = (req.body.From || "").replace(/[^\d]/g, "");

  if (sender) {
    const { user, created } = createUserIfMissing(sender, "sms");
    twiml.message(
      created
        ? `Welcome to PhoneMail! Your email address is ${user.email_address}. Download the app or visit the web portal to get started.`
        : `You already have a PhoneMail account: ${user.email_address}`
    );
  } else {
    twiml.message("Could not identify your phone number.");
  }
  res.type("text/xml").send(twiml.toString());
}
