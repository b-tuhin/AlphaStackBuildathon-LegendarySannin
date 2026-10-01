import { startPhoneOtp, checkPhoneOtp } from "./otp.js";

// Password resets share the configured Verify/challenge flow; this module does
// not generate, persist, return, or log reset codes itself.
export const issueResetVerification = (phone, ip) => startPhoneOtp(phone, "reset", ip);
export const verifyResetCode = (phone, code, ip) => checkPhoneOtp(phone, code, "reset", ip);
