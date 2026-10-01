import { Router } from "express";
import { ivrEntry, ivrHandle } from "../telephony/ivrWebhook.js";
import { smsInbound } from "../telephony/smsWebhook.js";
import { isTwilioSignatureValid } from "../auth/otp.js";

const router = Router();
router.use((req, res, next) => {
  if (!isTwilioSignatureValid(req)) return res.status(403).json({ error: "Forbidden" });
  next();
});
router.post("/ivr", ivrEntry);
router.post("/ivr/handle", ivrHandle);
router.post("/sms", smsInbound);
export default router;
