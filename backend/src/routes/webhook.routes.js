import { Router } from "express";
import { ivrEntry, ivrHandle } from "../telephony/ivrWebhook.js";
import { smsInbound } from "../telephony/smsWebhook.js";

const router = Router();
router.post("/ivr", ivrEntry);
router.post("/ivr/handle", ivrHandle);
router.post("/sms", smsInbound);
export default router;
