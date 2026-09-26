import twilio from "twilio";
import { provisionTelephonyAccount } from "../routes/user.routes.js";

const { MessagingResponse } = twilio.twiml;

/** POST /webhooks/sms — any inbound SMS creates an account with a temp password */
export function smsInbound(req, res) {
  const twiml = new MessagingResponse();
  const sender = (req.body.From || "").replace(/[^\d]/g, "");

  if (sender) {
    const { user, created, tempPassword } = provisionTelephonyAccount(sender, "sms", { deliverSms: false });
    twiml.message(
      created
        ? `Welcome to PhoneMail! Your email is ${user.email_address}. Temporary password: ${tempPassword}. Change it the first time you log in.`
        : `You already have a PhoneMail account: ${user.email_address}`
    );
  } else {
    twiml.message("Could not identify your phone number.");
  }
  res.type("text/xml").send(twiml.toString());
}
