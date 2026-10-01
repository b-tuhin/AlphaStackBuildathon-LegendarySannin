import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phonemail-test-"));
process.env.DB_PATH = path.join(tempDir, "test.db");
process.env.NODE_ENV = "test";
process.env.OTP_MODE = "twilio";
process.env.TWILIO_MOCK = "true";
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");

let issueSignupGrant, consumeSignupGrant, isTwilioSignatureValid, checkPhoneOtp, exactRecipientMatch, config, db, server, baseUrl;
before(async () => {
  ({ issueSignupGrant, consumeSignupGrant, isTwilioSignatureValid, checkPhoneOtp } = await import("../src/auth/otp.js"));
  ({ db } = await import("../src/db/database.js"));
  ({ exactRecipientMatch } = await import("../src/security/recipients.js"));
  ({ config } = await import("../src/config.js"));
  const express = (await import("express")).default;
  const authRoutes = (await import("../src/routes/auth.routes.js")).default;
  const webhookRoutes = (await import("../src/routes/webhook.routes.js")).default;
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use("/auth", authRoutes);
  app.use("/webhooks", webhookRoutes);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { db?.close(); } finally { fs.rmSync(tempDir, { recursive: true, force: true }); }
});

const postJson = (route, body) => fetch(`${baseUrl}${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("/auth/register requires a phone-bound, one-use grant and tosAccepted=true in Twilio mode", async () => {
  const phone = "+919876543210";
  const payload = { phone, password: "a-long-test-password", confirmPassword: "a-long-test-password", tosAccepted: true };
  let response = await postJson("/auth/register", payload);
  assert.equal(response.status, 401);
  const grant = issueSignupGrant(phone);
  response = await postJson("/auth/register", { ...payload, tosAccepted: false, signupGrant: grant });
  assert.equal(response.status, 400);
  response = await postJson("/auth/register", { ...payload, signupGrant: grant });
  assert.equal(response.status, 200);
  const created = await response.json();
  assert.equal(created.created, true);
  assert.equal("resetCode" in created, false);
  const verifiedUser = db.prepare("SELECT tos_version,phone_verified_at FROM users WHERE phone=?").get(phone);
  assert.equal(verifiedUser.tos_version, config.tosVersion);
  assert.ok(verifiedUser.phone_verified_at);
  response = await postJson("/auth/register", { ...payload, signupGrant: grant });
  assert.equal(response.status, 401, "grant replay must be rejected");
});

test("password mode preserves password-only signup as the explicit fallback", async () => {
  const priorMode = config.otpMode;
  config.otpMode = "password";
  try {
    const phone = "+919876543215";
    let response = await postJson("/auth/phone/start", { phone, purpose: "signup" });
    assert.equal(response.status, 202);
    assert.equal((await response.json()).mode, "password");
    response = await postJson("/auth/register", { phone, password: "a-long-test-password", confirmPassword: "a-long-test-password", tosAccepted: true });
    assert.equal(response.status, 200);
    assert.equal(db.prepare("SELECT phone_verified_at FROM users WHERE phone=?").get(phone).phone_verified_at, null);
  } finally { config.otpMode = priorMode; }
});

test("signup grants are bound to the phone and consumed once", () => {
  const phone = "+919876543211";
  const grant = issueSignupGrant(phone, Date.now());
  assert.equal(consumeSignupGrant(phone, "wrong"), false);
  assert.equal(consumeSignupGrant("+919876543212", grant), false);
  assert.equal(consumeSignupGrant(phone, grant), true);
  assert.equal(consumeSignupGrant(phone, grant), false);
});

test("expired signup grants cannot be consumed", () => {
  const phone = "+919876543216";
  const grant = issueSignupGrant(phone, Date.now() - 700_000);
  assert.equal(consumeSignupGrant(phone, grant), false);
});

test("OTP challenge is single-use and expired OTPs are rejected", async () => {
  const priorMode = config.otpMode;
  config.otpMode = "password";
  try {
    const now = Date.now();
    const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
    const phone = "+919876543213";
    db.prepare("INSERT INTO phone_challenges(phone,purpose,started_at,checks,verified,expires_at,code_hash) VALUES(?,?,?,?,?,?,?)")
      .run(phone, "signup", now, 0, 0, now + 60_000, hash("123456"));
    const success = await checkPhoneOtp(phone, "123456", "signup", "otp-replay-test-ip");
    assert.equal(success.ok, true);
    assert.equal(typeof success.signupGrant, "string");
    const replay = await checkPhoneOtp(phone, "123456", "signup", "otp-replay-test-ip-2");
    assert.equal(replay.ok, false);

    const expiredPhone = "+919876543214";
    db.prepare("INSERT INTO phone_challenges(phone,purpose,started_at,checks,verified,expires_at,code_hash) VALUES(?,?,?,?,?,?,?)")
      .run(expiredPhone, "signup", now - 700_000, 0, 0, now - 1, hash("654321"));
    const expired = await checkPhoneOtp(expiredPhone, "654321", "signup", "otp-expiry-test-ip");
    assert.equal(expired.ok, false);
  } finally { config.otpMode = priorMode; }
});

test("recipient membership compares exact normalized address tokens", () => {
  assert.equal(exactRecipientMatch("1234567890@phonemail.com, 9876543210@phonemail.com", "9876543210@phonemail.com"), true);
  assert.equal(exactRecipientMatch("11234567890@phonemail.com", "1234567890@phonemail.com"), false);
  assert.equal(exactRecipientMatch("Name <9876543210@phonemail.com>", "9876543210@phonemail.com"), false);
});

test("webhook signature validator rejects missing or invalid signatures", () => {
  const req = { headers: { "x-twilio-signature": "not-valid" }, originalUrl: "/webhooks/ivr", body: {}, get(name) { return this.headers[name.toLowerCase()]; } };
  assert.equal(isTwilioSignatureValid(req, "https://example.test", "test-token"), false);
  delete req.headers["x-twilio-signature"];
  assert.equal(isTwilioSignatureValid(req, "https://example.test", "test-token"), false);
});

test("unsigned /webhooks request is rejected before the IVR handler", async () => {
  const response = await fetch(`${baseUrl}/webhooks/ivr`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "From=%2B919876543210" });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden" });
});
