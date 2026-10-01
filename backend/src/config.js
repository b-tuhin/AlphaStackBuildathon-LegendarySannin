import dotenv from "dotenv";
dotenv.config();

const PLACEHOLDER_SECRETS = new Set([
  "phonemail_dev_secret",
  "change_me_in_production",
  "REPLACE_WITH_A_STRONG_RANDOM_SECRET",
  "",
]);
const rawSecret = process.env.JWT_SECRET ?? "";
const isProduction = (process.env.NODE_ENV || "development") === "production";
const otpMode = String(process.env.OTP_MODE || "twilio").toLowerCase();
const twilioMock = /^(true|1|yes|on)$/i.test(String(process.env.TWILIO_MOCK || "false").trim());
const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");

if (!new Set(["twilio", "password"]).has(otpMode)) {
  throw new Error("OTP_MODE must be either twilio or password");
}
if (isProduction && PLACEHOLDER_SECRETS.has(rawSecret)) {
  console.error("[FATAL] JWT_SECRET is missing or equals a placeholder; set a strong, unique secret.");
  process.exit(1);
}
if (isProduction && twilioMock) {
  console.error("[FATAL] Mock SMS is not allowed in production; set TWILIO_MOCK=false.");
  process.exit(1);
}
if (isProduction && otpMode === "twilio") {
  const required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID", "PUBLIC_BASE_URL", "TWILIO_PHONE_NUMBER"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`[FATAL] Missing required production environment settings: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (!/^https:\/\//i.test(publicBaseUrl)) {
    console.error("[FATAL] PUBLIC_BASE_URL must be an HTTPS origin in production.");
    process.exit(1);
  }
}

const jwtSecret = rawSecret || "phonemail_dev_secret";

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  smtpPort: parseInt(process.env.SMTP_PORT || "2525", 10),
  mailDomain: process.env.MAIL_DOMAIN || "bharatchat.com",
  webDomain: process.env.WEB_DOMAIN || process.env.MAIL_DOMAIN || "bharatchat.com",
  androidSmsHash: process.env.ANDROID_SMS_HASH || "FA+9qCX9VSu",
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  dbPath: process.env.DB_PATH || "./data/phonemail.db",
  otpMode,
  tosVersion: process.env.TOS_VERSION || "2026-09-30",
  publicBaseUrl,
  otp: { ttlMs: 10 * 60 * 1000, resendCooldownMs: 60 * 1000, maxChecks: 5, maxStartsPerPhoneDay: 10, maxStartsPerIpDay: 30, maxChecksPerIpHour: 30 },
  loginWindowMs: 15 * 60 * 1000,
  loginMaxAttempts: 5,
  registerWindowMs: 15 * 60 * 1000,
  registerMaxAttempts: 5,
  resetRequestWindowMs: 15 * 60 * 1000,
  resetRequestMaxAttempts: 5,
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID || "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
    mock: twilioMock,
  },
};
