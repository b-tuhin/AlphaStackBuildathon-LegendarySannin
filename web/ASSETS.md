# Bharat Chat — Image Asset Spec

All images live in `public/assets/`. Every reference must go through [`src/config/assets.js`](src/config/assets.js) via `getAsset(id)`.  
Do **not** hard-code `/assets/…` paths anywhere in `src/`.

## Role Table

| Role | Composition rule | Sizing |
|---|---|---|
| `login-desktop` | Wide landscape; keep the subject in the left 45%, form card sits on the right | Never stretched; wider screens crop from the right |
| `login-mobile` | Portrait, or the desktop photo cropped by `objectPosition` | Subject in the top 40% |
| `error-desktop` | Wide landscape used on the 404 page | Displayed at max 240 px wide, centered |
| `error-mobile` | Portrait variant for the 404 page | Same as above on narrow screens |
| `avatar-boy` / `avatar-girl` | Square portrait, no background | Displayed as circular avatar |
| `wallpapers` | Any orientation; faded under an 80% overlay | Avoid text and faces |
| **Tone** | Low saturation so the Gulabi pink brand colour leads in both light and dark mode | — |

## Registered Assets

| id | file | kind | objectPosition |
|---|---|---|---|
| `login-desktop` | `/assets/login-desktop.png` | login-desktop | `left center` |
| `login-mobile` | `/assets/login-mobile.png` | login-mobile | `center top` |
| `error-desktop` | `/assets/error-desktop.png` | error-desktop | `left center` |
| `error-mobile` | `/assets/error-mobile.png` | error-mobile | `center top` |
| `avatar-boy` | `/assets/avatar-boy.png` | avatar | `center` |
| `avatar-girl` | `/assets/avatar-girl.png` | avatar | `center` |
| `wallpaper-doodle-dark` | `/assets/wallpaper-doodle-dark.png` | wallpaper | `center` |
| `wallpaper-doodle-light` | `/assets/wallpaper-doodle-light.png` | wallpaper | `center` |

## How to Swap an Image

> **Never edit, resize, convert, or regenerate images.** Only byte-for-byte copies from `web/_originals/` are accepted.

1. Place the replacement file in `web/_originals/` (photographer's original, any format).
2. Copy it byte-for-byte to `public/assets/` (lowercase, hyphenated filename):
   ```
   cp _originals/my-photo.png public/assets/login-desktop.png
   ```
3. Update the lock + changelog:
   ```
   npm run assets:lock -- --reason "Swap login-desktop: new landscape photo from session 2026-10-01"
   ```
4. Update `src/config/assets.js` if the filename or `objectPosition` changes.
5. Run `npm run assets:check` — must exit 0.
6. Run `npm run verify` — must exit 0.

## Integrity Check

`public/assets/assets.lock.json` records `sha256`, `bytes`, `width`, `height` for every registered file.  
`npm run assets:check` fails if:
- A registered file is missing
- A file's hash differs from the lock
- A file in `public/assets/` (top-level, non-JSON) is not registered

`npm run assets:lock -- --reason "…"` is the **only** accepted way to update a lock entry.
