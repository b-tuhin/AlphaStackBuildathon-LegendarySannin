# PhoneMail

An email platform where your **phone number is your email address**
(`9876543210@phonemail.com`). Mobile-first, WhatsApp-styled chat inbox, with a
Gmail-styled web portal and a Node.js backend that speaks SMTP, REST, and Twilio
voice/SMS — all fully dockerized.

## Quick start

```bash
cp .env.example .env      # edit HOST_IP to your machine's LAN IP for Expo Go
docker compose up -d --build
```

| Service   | URL                              | Purpose                                   |
|-----------|-----------------------------------|--------------------------------------------|
| backend   | http://localhost:4000            | REST API (auth, mail) + health check       |
| backend   | localhost:2525                   | Local SMTP — accepts mail for `*@phonemail.com` |
| web       | http://localhost:3000            | Registration portal + Gmail-style client   |
| mobile    | exp://<HOST_IP>:8081              | Expo dev server — scan QR with Expo Go     |
| mailhog   | http://localhost:8025            | Inspect outbound SMTP relay (dev only)     |

No Twilio account is required to demo: `TWILIO_MOCK=true` (the default) logs
OTPs, IVR speech, and SMS notifications to the backend console instead of
sending them, and `POST /auth/otp/request` also returns the code directly in
the response body (`devCode`) in mock mode so the UI can display it.

## How each requirement is met

**Account creation**
- IVR "press 1": `POST /webhooks/ivr` → `/webhooks/ivr/handle` (Twilio `<Gather>`), creates
  the user from the caller's number.
- Inbound SMS: `POST /webhooks/sms`, any text creates an account for the sender.
- Web registration portal: two fields only — phone number, then OTP — with a
  Terms of Service link, at `web/src/pages/Register.jsx`.
- Password fallback: if OTP verification fails 3 times or expires, the API
  responds `fallbackToPassword: true` and both clients route to a
  password-login screen (`POST /auth/password/login`).

**Mobile client (priority)** — `mobile/`
- WhatsApp design tokens in `src/theme/whatsapp.js` (teal header, green
  accent, bubble colors) applied throughout.
- Onboarding: Language → Terms → Phone number → OTP, auto-verifying once 6
  digits are entered (`src/screens/onboarding/`).
- Inbox: full-width search bar, filter chips (All / Unread / Attachments /
  Favorites), a drawer combining Inbox+Sent with Drafts/Spam/Trash.
- Chat-based inbox: every sender (or group) is one thread
  (`GET /mail/threads`), not a flat message list. Swipe-right-to-reply on any
  row (`SwipeReplyWrapper.js`).
- Compose: search a phone number to start a 1:1 chat, or add multiple numbers
  to start a **group chat**. Replies to a group stay in that group thread;
  replies to a single number stay 1:1 (`ComposeScreen.js`, backed by
  `mailEngine.js`'s group-thread resolution).

**Web client** — `web/`
- Single-screen onboarding: phone + OTP + Next, with a hyperlinked ToS
  (`public/terms.html`).
- Gmail-style three-pane layout: folder sidebar, email list, reading pane
  (`pages/Mail.jsx`), not the mobile chat view.
- Profile & Settings screen for display name and alias IDs.

**Notifications**
- `telephony/notifier.js`: any recipient without a registered mobile device
  (`device_registrations` table) gets an SMS: *"You have received an email
  from `<sender>`. Subject: `<subject>`."* Works for both 1:1 and group
  recipients.

**Technical**
- Backend: Node.js/Express, `better-sqlite3`, `smtp-server` (local SMTP with
  RFC 5322 phone→address mapping), `twilio` SDK, JWT auth, bcrypt password
  fallback.
- Fully dockerized: `docker compose up -d --build` brings up backend, web,
  mobile (Expo/Metro), and MailHog with a single command; the backend has a
  healthcheck other services `depends_on`.
- `.env.example` documents every configurable value.

## Verifying it works (curl)

```bash
# 1. Request OTP (mock mode returns devCode)
curl -X POST localhost:4000/auth/otp/request -H "Content-Type: application/json" -d '{"phone":"9876543210"}'

# 2. Verify OTP -> account created + JWT issued
curl -X POST localhost:4000/auth/otp/verify -H "Content-Type: application/json" -d '{"phone":"9876543210","code":"<devCode>"}'

# 3. Create a second user and message them
curl -X POST localhost:4000/auth/otp/request -H "Content-Type: application/json" -d '{"phone":"9998887776"}'
curl -X POST localhost:4000/auth/otp/verify -H "Content-Type: application/json" -d '{"phone":"9998887776","code":"<devCode2>"}'
curl -X POST localhost:4000/mail/send -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"to":"9998887776","subject":"Hello","text":"Hi from PhoneMail"}'

# 4. Group chat: pass an array of recipients
curl -X POST localhost:4000/mail/send -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"to":["9998887776","9123456789"],"subject":"Team","text":"Group hello"}'

# 5. External mail via local SMTP
npx swaks --to 9876543210@phonemail.com --from tester@example.com --server localhost:2525 \
  --header "Subject: Hello" --body "Test message"
```

## Running components individually (no Docker)

```bash
npm install --workspaces
npm run dev:backend     # http://localhost:4000
npm run dev:web         # http://localhost:5173
npm run dev:mobile      # Expo dev server — scan with Expo Go
```

## Project structure

```
phonemail/
├── docker-compose.yml
├── backend/    # Express API + local SMTP + Twilio IVR/SMS + SQLite
├── mobile/     # Expo/React Native — WhatsApp-style chat client (priority)
└── web/        # React/Vite — Gmail-style client + registration portal
```

## Known trade-offs / good-to-haves not yet built

- Push notifications for app users are stubbed via `device_registrations`
  (a device "has the app" once it registers) — real push delivery (FCM/APNs)
  isn't wired up; SMS fallback covers the notification requirement.
- Attachments are accepted end-to-end in the schema/API but neither client
  has a file picker yet — `attachments` on `POST /mail/send` accepts
  pre-uploaded metadata for extension.
- OTP delivery is SMS/voice via Twilio; no email-based OTP, since the whole
  point of PhoneMail is phone-first identity.
