import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  smtpPort: parseInt(process.env.SMTP_PORT || "2525", 10),
  mailDomain: process.env.MAIL_DOMAIN || "phonemail.com",
  jwtSecret: process.env.JWT_SECRET || "phonemail_dev_secret",
  dbPath: process.env.DB_PATH || "./data/phonemail.db",
  otpTtlMs: 5 * 60 * 1000,
  otpMaxAttempts: 3,
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
    mock: (process.env.TWILIO_MOCK || "true") === "true",
  },
};
