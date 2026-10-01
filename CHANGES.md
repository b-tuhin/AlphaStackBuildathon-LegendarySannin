# PhoneMail OTP, SMS, and security changes

## Implemented

- Added Twilio Verify phone-start/check endpoints, E.164 normalization (default country `IN`), one-use phone-bound signup grants (10-minute expiry), signup ToS enforcement, and persisted `tos_version` / `phone_verified_at` fields with startup migrations.
- Added persisted per-phone and per-IP OTP throttles, a 60-second resend cooldown, a five-check limit per verification, and phone-number-independent start/reset responses. Password reset now uses Twilio Verify and does not return reset codes.
- Kept the explicit `OTP_MODE=password` legacy password-only signup/login fallback. **Phone ownership is not verified in this mode**, so `phone_verified_at` remains empty. Password resets still require Twilio Verify credentials in either mode.
- Updated web signup to phone → SMS code → password, with a Terms of Service link; login starts at the phone/password step. Updated mobile onboarding for editable SIM-prefilled phone entry, OTP autofill, password creation, and inbox navigation. Mobile login and signup call `registerDevice`.
- Made incoming-mail SMS notification delivery awaited, retry once, sanitized/truncated, metadata-only in logs, and limited to recipients without an Android/iOS device registration. IVR account provisioning sends its welcome SMS through the same awaited notifier.
- Added Twilio signature validation before every webhook handler, exact normalized recipient matching, authenticated thread-member attachment reads, `nosniff`, and attachment disposition headers.
- Added Node tests for registration grant/ToS gates, grant and OTP replay/expiry, the password-mode fallback, exact recipient matching, and signed-webhook rejection.

## Environment and local Twilio setup

1. Use the included `.env.example` as a **template**; configure real values only in your deployment environment or your own untracked `.env` file. Do not commit credentials.
2. For phone verification, set `OTP_MODE=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_PHONE_NUMBER`, and a public HTTPS `PUBLIC_BASE_URL`. Set `TWILIO_MOCK=false`. Production startup rejects mock mode, missing required Twilio settings in Twilio mode, and the example JWT secret.
3. For a local backend listening on port 4000, run `ngrok http 4000` and set `PUBLIC_BASE_URL` to the tunnel's HTTPS origin (no trailing slash). In Twilio Console, set the Voice webhook to `<PUBLIC_BASE_URL>/webhooks/ivr` using `POST`; set the inbound SMS webhook, if used, to `<PUBLIC_BASE_URL>/webhooks/sms` using `POST`. The IVR gathers digit `1` and posts to `/webhooks/ivr/handle`. Webhook signatures are checked against this public URL.
4. `OTP_MODE=password` preserves the previous password-only signup path. It is a lower-assurance fallback; phone verification is not recorded. Reset requests still use Verify.

## Validation evidence

- `node --check` passed for backend JavaScript and the changed web/mobile API clients.
- `node --test` passed **8 tests** (grant/ToS gates, password fallback, grant replay/expiry, OTP replay/expiry, exact recipient matching, and webhook signature rejection).
- `esbuild` parsed the changed web and mobile JSX successfully.
- A runtime smoke import of the mail router and calls to its exact-recipient SQLite predicates passed.
- Production startup guards rejected mock mode, missing Twilio settings in Twilio mode, and the `.env.example` JWT placeholder as expected.
- Real Twilio Verify/SMS delivery was **not exercised**; tests use no Twilio credentials. `docker compose up -d` was **not run**.

## NOT DONE

- **Compose deployment wiring and `docker compose up -d` validation are not done.** The requested edit scope excluded `docker-compose.yml`. The current Compose service does not forward `OTP_MODE`, `TWILIO_VERIFY_SERVICE_SID`, `PUBLIC_BASE_URL`, or `TOS_VERSION`, and defaults `TWILIO_MOCK` to `true`. Since the API now correctly fails production startup with mock SMS enabled or required Twilio settings missing, the existing Compose configuration will not start in default Twilio mode. Before deployment, add those environment pass-throughs and change the Compose mock default to `false`; provide real settings through the deployment environment, then run `docker compose up -d --build` and inspect service health.
- **Live Twilio verification, SMS notification, and IVR calls are not done.** They require account credentials, a Verify Service SID, a provisioned sender number, and a reachable HTTPS webhook. No real credentials were available or used in validation.
