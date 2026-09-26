import dotenv from "dotenv";
dotenv.config();

// ── JWT_SECRET guard ──────────────────────────────────────────────────────────
// The placeholder values (from .env.example and the old docker-compose default)
// must never be used in production.  Fail fast so a misconfigured deployment is
// caught at startup rather than discovered after a breach.
const PLACEHOLDER_SECRETS = new Set([
  "phonemail_dev_secret",
  "change_me_in_production",
  "",
]);

const rawSecret = process.env.JWT_SECRET ?? "";
const isProduction = (process.env.NODE_ENV || "development") === "production";

if (isProduction && PLACEHOLDER_SECRETS.has(rawSecret)) {
  console.error(
    "[FATAL] JWT_SECRET is missing or equals a placeholder value. " +
      "Set a strong, unique secret before running in production."
  );
  process.exit(1);
}

// In development fall back to a predictable value so `npm run dev` still works
// without a .env file.  Never let this reach production (the guard above stops it).
const jwtSecret = rawSecret || "phonemail_dev_secret";

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  smtpPort: parseInt(process.env.SMTP_PORT || "2525", 10),
  mailDomain: process.env.MAIL_DOMAIN || "phonemail.com",
  webDomain: process.env.WEB_DOMAIN || process.env.MAIL_DOMAIN || "phonemail.com",
  androidSmsHash: process.env.ANDROID_SMS_HASH || "FA+9qCX9VSu",
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  dbPath: process.env.DB_PATH || "./data/phonemail.db",
  resetCodeTtlMs: 15 * 60 * 1000,
  resetMaxAttempts: 5,
  loginWindowMs: 15 * 60 * 1000,
  loginMaxAttempts: 5,
  // Rate-limit shared settings (register / reset-request reuse login window)
  registerWindowMs: 15 * 60 * 1000,
  registerMaxAttempts: 5,
  resetRequestWindowMs: 15 * 60 * 1000,
  resetRequestMaxAttempts: 5,
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
    mock: (process.env.TWILIO_MOCK || "true") === "true",
  },
};
