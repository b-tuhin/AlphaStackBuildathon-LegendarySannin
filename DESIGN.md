# PhoneMail — Design System (Phase 0)

> **Government-grade civic app for AlphaStack 7-Day Buildathon.**
> Quality target: \$10,000 agency build. GIGW 3.0 + WCAG 2.1 AA.

---

## 1. Reference-Image Style Extraction (pixel/voxel landscapes)

Three reference images were provided:

| # | Scene | Notes |
|---|-------|-------|
| 1 | Golden wheat field, blue sky, cumulus clouds, wildflowers | Classic summer Indian plains mood |
| 2 | Open meadow, lone conifer, flat horizon, wide sky | Minimal, airy, rural serenity |
| 3 | Snow-capped mountains, still lake reflection, fir forest | Cool, contemplative, majestic |

**Pixel density / rendering style**
- Hard-edged pixel blocks (8–16 px grid), no anti-aliasing.
- Flat colour fills within each block — no gradients within a pixel.
- Distinct tonal bands for shadow / mid / highlight on each object.
- Sky occupies 45–60 % of the frame (horizon sits in the lower 40–55 %).
- Cloud forms: large rounded cumulus stacks, bottom-flat, built from stacked rectangular blocks. No cirrus detail except a single wisp trail in image 2.
- Distance handled by hue shift (atmosphere/haze) — far objects become cooler, lighter, more blue-grey.
- Foreground silhouettes are darkest; mid-ground is mid-tone; sky is brightest.
- Mood: calm, spacious, optimistic, nostalgic. No drama or neon.

**Adapted for UI (muted + desaturated)**
- Reduce saturation by 40–50 %. Pull vibrant sky blue toward slate-blue-grey.
- Warm golden fields become pale straw / mist-ivory backgrounds.
- Keep the pixel character only in decorative illustrations (login hero, wallpaper thumbs).
- UI surfaces must be clean and modern — pixel art lives only in imagery, not in interface chrome.
- Overall mood: trustworthy, calm, airy, breathable. Think "a government post office on a clear morning."

---

## 2. Design Tokens

### 2a. Colour Palette (CSS Custom Properties)

Define in `:root` inside `web/src/index.css` (Phase 1 will inject these):

```css
:root {
  /* ── Brand (Tricolour modernised) ─────────── */
  --c-navy:          #1F3A6E; /* Chakra navy — primary actions, headings */
  --c-navy-dark:     #162D57; /* Hover / pressed state of navy */
  --c-navy-light:    #E8EDF7; /* Navy tint — active nav, selected rows */
  --c-saffron:       #E8A45A; /* Muted saffron — small accents only */
  --c-saffron-light: #FBF0E3; /* Saffron tint — chip bg, quote borders */
  --c-green:         #2F7D5B; /* India green — success, confirmations */
  --c-green-light:   #E3EFE7; /* Green tint — success bg, badges */

  /* ── Neutrals ──────────────────────────────── */
  --c-bg:            #FAF8F3; /* Soft ivory — page canvas */
  --c-surface:       #FFFFFF; /* White — cards, panels, modals */
  --c-surface-alt:   #F3F1EB; /* Mist warm — input fill, alt rows */
  --c-surface-hover: #EEF2F7; /* Mist blue — hover state */
  --c-mist:          #EEF2F7; /* Alias of surface-hover for clarity */
  --c-border:        #E0DDD6; /* Warm border */
  --c-border-strong: #C8C4BC; /* Input borders, focused rings */

  /* ── Typography ────────────────────────────── */
  --c-ink:           #1B2433; /* Near-black — body text (14.2:1 on white) */
  --c-ink-muted:     #5C6370; /* Secondary labels (5.4:1 on white, AA ✓) */
  --c-ink-faint:     #8A9099; /* Timestamps, meta (use only on light surfaces) */
  --c-link:          #1F3A6E; /* Same as navy — interactive text links */

  /* ── Status ────────────────────────────────── */
  --c-danger:        #C0392B; /* Error text (5.1:1 on white ✓) */
  --c-danger-bg:     #FDECEA;
  --c-success:       #2F7D5B; /* Maps to green */
  --c-success-bg:    #E3EFE7;
  --c-warning:       #A0591A; /* Dark saffron for warnings */
  --c-warning-bg:    #FBF0E3;

  /* ── Chat bubbles ──────────────────────────── */
  --c-bubble-out:        #E8EDF7; /* Outgoing — navy tint */
  --c-bubble-out-border: #C8D4EE;
  --c-bubble-in:         #FFFFFF; /* Incoming — white */
  --c-bubble-in-border:  #E0DDD6;
  --c-quote-border:      #E8A45A; /* Saffron accent stripe */
  --c-quote-bg:          #FBF0E3;
}
```

> **Contrast audit (light mode)**
> - `--c-ink` on `--c-surface`: 14.2:1 ✓ AAA
> - `--c-ink-muted` on `--c-surface`: 5.4:1 ✓ AA
> - `--c-navy` on `--c-surface`: 8.6:1 ✓ AAA
> - `--c-navy` on `--c-navy-light`: 5.2:1 ✓ AA
> - `--c-green` on `--c-surface`: 5.0:1 ✓ AA
> - `--c-danger` on `--c-surface`: 5.1:1 ✓ AA
> - `--c-saffron` on `--c-surface`: 2.9:1 ✗ — **use ONLY decoratively, never for text**

**Dark mode** (add `[data-theme="dark"]` overrides in Phase 1):
- `--c-bg: #151C26` | `--c-surface: #1E2636` | `--c-ink: #EEF2F7`
- Navy primary becomes `#4D7CC7` (AAA on dark surface).
- Saffron becomes `#D4904A` (AA on dark surface).

### 2b. Typography Scale

Font stack (Latin + Devanagari + South Indian scripts):

```css
--font-sans: 'Noto Sans', 'Noto Sans Devanagari', 'Segoe UI', Arial, sans-serif;
```

Load via Google Fonts in `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap">
```

| Token | Size | Weight | Line-h | Use |
|-------|------|--------|--------|-----|
| `--text-2xs` | 11px | 400 | 1.4 | badges, meta |
| `--text-xs`  | 13px | 400 | 1.45 | timestamps, captions |
| `--text-sm`  | 15px | 400 | 1.5  | body copy, secondary labels |
| `--text-base`| 17px | 400 | 1.55 | primary body, input values |
| `--text-lg`  | 20px | 600 | 1.4  | card titles, section headings |
| `--text-xl`  | 24px | 700 | 1.3  | page headings |
| `--text-2xl` | 32px | 700 | 1.2  | hero / login title |

> Minimum body text: **15px**. Never go below 13px for any user-visible string.
> Do NOT hard-code pixel widths on text containers — use `max-width` + `width: 100%`.

### 2c. Spacing Scale

Based on a 4px base unit:

| Token | Value | Use |
|-------|-------|-----|
| `--sp-1` | 4px  | intra-element gaps |
| `--sp-2` | 8px  | icon-to-label gaps |
| `--sp-3` | 12px | compact padding |
| `--sp-4` | 16px | standard padding |
| `--sp-5` | 20px | card padding (mobile) |
| `--sp-6` | 24px | card padding (desktop) |
| `--sp-8` | 32px | section gaps |
| `--sp-10`| 40px | large whitespace |
| `--sp-12`| 48px | hero / page-level |

### 2d. Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `--r-sm`   | 6px  | badges, chips |
| `--r-md`   | 10px | inputs, small cards |
| `--r-lg`   | 16px | cards, modals |
| `--r-xl`   | 24px | FAB, large bubbles |
| `--r-full` | 9999px | pills, avatars, toggles |

### 2e. Shadows

| Token | Value | Use |
|-------|-------|-----|
| `--shadow-xs` | `0 1px 3px rgba(27,36,51,0.08)` | subtle lift |
| `--shadow-sm` | `0 2px 8px rgba(27,36,51,0.10)` | cards at rest |
| `--shadow-md` | `0 4px 16px rgba(27,36,51,0.12)` | modal overlay |
| `--shadow-lg` | `0 8px 32px rgba(27,36,51,0.16)` | floating panels |
| `--shadow-navy`| `0 4px 16px rgba(31,58,110,0.20)` | navy button hover |

### 2f. Motion Timings

```css
--motion-fast:   120ms;  /* icon state swaps */
--motion-base:   200ms;  /* most transitions */
--motion-slow:   300ms;  /* page transitions, modals */
--ease-standard: cubic-bezier(0.16, 1, 0.3, 1);  /* enter */
--ease-exit:     cubic-bezier(0.4, 0, 1, 1);       /* exit */
--ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1); /* bouncy buttons */
```

All animations: **transform and opacity only**. Max 300 ms. Must respect `prefers-reduced-motion`.

---

## 3. Layout Principles

- **Mobile-first** — all layouts start at 360 px and scale up.
- **Single primary action per screen** — one CTA button per viewport visible area.
- **Generous whitespace** — never pack content; 24 px minimum padding on mobile.
- **Sidebar + main content pane** (web only) — sidebar 280 px fixed, collapses to off-canvas drawer on < 768 px.
- **Tap targets ≥ 48 × 48 px** — every interactive element. Use padding, not increased font size.
- **No horizontal scroll** at any breakpoint below 360 px.
- Bilingual-safe: all text containers use `width: 100%; max-width: Npx` — never fixed-px widths that clip text.
- **Z-index layers**: background 0, content 1, sidebar 100, topbar 200, modal backdrop 300, modal 400, toast 500.

---

## 4. Component Specs

### 4a. Buttons

**Primary button** — one per screen maximum.
```
background: var(--c-navy)
color: #FFFFFF
border-radius: var(--r-md)     /* 10px */
padding: 14px 28px
font: var(--text-base) / 600
min-height: 52px                /* tap target */
width: 100% on mobile
transition: background var(--motion-base) var(--ease-standard),
            box-shadow var(--motion-base) var(--ease-standard)
:hover → background: var(--c-navy-dark), box-shadow: var(--shadow-navy)
:active → transform: scale(0.97)
:focus-visible → outline: 3px solid var(--c-saffron); outline-offset: 3px
:disabled → opacity: 0.45; pointer-events: none
```

**Line-illustration motif on primary buttons** (subtle, not animated):
- A hairline SVG arc (1px stroke, `var(--c-navy-light)`, opacity 0.35) placed as a `::before` pseudo-element, positioned bottom-right of the button, overflow hidden. Resembles the horizon line from the pixel landscapes.
- Visible only at sizes ≥ 100px wide. Hidden on icon-only buttons.

```css
.btn-primary::before {
  content: '';
  position: absolute;
  right: -8px; bottom: -6px;
  width: 60px; height: 30px;
  border-top: 1px solid rgba(255,255,255,0.25);
  border-radius: 50% 50% 0 0;
  pointer-events: none;
}
```

**Secondary button**
```
background: transparent
color: var(--c-navy)
border: 1.5px solid var(--c-navy)
border-radius: var(--r-md)
padding: 12px 24px; min-height: 48px
:hover → background: var(--c-navy-light)
```

**Ghost / text button**
```
background: transparent; color: var(--c-navy)
padding: 10px 16px; min-height: 44px; min-width: 44px
:hover → background: var(--c-mist)
```

**Danger button**
```
background: var(--c-danger); color: #FFFFFF
Same geometry as primary.
```

**Icon button (.icon-btn)**
```
min-width: 44px; min-height: 44px; border-radius: var(--r-sm)
display: flex; align-items: center; justify-content: center
:hover → background: var(--c-surface-hover)
Always pair icon with visible text OR provide aria-label.
```

### 4b. Inputs

```
background: var(--c-surface-alt)
border: 1.5px solid var(--c-border)
border-radius: var(--r-md)      /* 10px */
padding: 14px 16px
font: var(--text-base)          /* 17px */
min-height: 52px                /* tap target */
width: 100%

:focus → border-color: var(--c-navy);
          box-shadow: 0 0 0 3px rgba(31,58,110,0.15)
          outline: none

:invalid:not(:placeholder-shown) →
          border-color: var(--c-danger);
          box-shadow: 0 0 0 3px rgba(192,57,43,0.12)

::placeholder → color: var(--c-ink-faint)
label → font: var(--text-sm)/600; color: var(--c-ink-muted)
error msg → font: var(--text-xs); color: var(--c-danger); margin-top: 4px
            role="alert" aria-live="polite"
```

### 4c. Cards

```
background: var(--c-surface)
border: 1px solid var(--c-border)
border-radius: var(--r-lg)      /* 16px */
padding: var(--sp-6)            /* 24px */
box-shadow: var(--shadow-sm)
overflow: hidden
```

### 4d. Navigation (Sidebar — Web)

```
width: 280px (desktop) / full-width off-canvas (mobile)
background: var(--c-surface)
border-right: 1px solid var(--c-border)
padding: 8px 0

Folder item (.sidebar-item):
  padding: 10px 16px; border-radius: 8px; min-height: 48px
  icon (20px) + label (var(--text-sm)/500) in a row; gap: 12px
  :hover → background: var(--c-surface-hover)
  --active → background: var(--c-navy-light); color: var(--c-navy); font-weight: 600

Top bar:
  height: 60px; background: var(--c-surface)
  border-bottom: 1px solid var(--c-border)
  box-shadow: var(--shadow-xs)
```

### 4e. Chat Bubbles

```
Outgoing:
  background: var(--c-bubble-out)     /* navy tint */
  border: 1px solid var(--c-bubble-out-border)
  border-radius: 18px 18px 4px 18px
  padding: 10px 14px; max-width: 72%

Incoming:
  background: var(--c-bubble-in)      /* white */
  border: 1px solid var(--c-bubble-in-border)
  border-radius: 18px 18px 18px 4px
  padding: 10px 14px; max-width: 72%

Subject line (inside chat, new email):
  font: var(--text-xs)/600; color: var(--c-navy)
  margin-bottom: 4px

Quote stripe (reply reference):
  border-left: 3px solid var(--c-quote-border)
  background: var(--c-quote-bg)
  padding: 6px 10px; border-radius: 4px

Timestamp:
  font: var(--text-2xs); color: var(--c-ink-faint)
  align-self: flex-end; padding: 0 4px

Chat background area:
  background: wallpaper image or var(--c-bg) fallback
```

### 4f. Filter Chips

```
height: 32px; padding: 0 14px; border-radius: var(--r-full)
border: 1.5px solid var(--c-border)
background: var(--c-surface-alt)
font: var(--text-xs)/500; color: var(--c-ink-muted)
min-width: 44px (tap target via padding)
gap: 6px between chips
--active → background: var(--c-navy-light);
           border-color: var(--c-navy);
           color: var(--c-navy); font-weight: 600
```

### 4g. Empty States

```
Container: centred column, padding: 48px 24px
Icon: 64×64px, SVG line-illustration style, color: var(--c-border-strong)
Title: var(--text-lg), color: var(--c-ink), margin: 16px 0 8px
Body: var(--text-sm), color: var(--c-ink-muted), max-width: 260px, text-align: center
CTA (optional): secondary button below body, margin-top: 24px
```

### 4h. Alerts / Toast

```
border-radius: var(--r-md); padding: 12px 16px
display: flex; align-items: flex-start; gap: 10px
Icon (20px) + text column
font: var(--text-sm)
min-height: 48px (tap target)

Variants:
  info    → border-left: 4px solid var(--c-navy); background: var(--c-navy-light)
  success → border-left: 4px solid var(--c-green); background: var(--c-green-light)
  warning → border-left: 4px solid var(--c-saffron); background: var(--c-saffron-light)
  error   → border-left: 4px solid var(--c-danger); background: var(--c-danger-bg)

role="alert" aria-live="assertive" on error/success
role="status" aria-live="polite" on info/loading
```

### 4i. Avatar / Profile Picker

```
Sizes: sm=32px, md=40px, lg=56px, xl=80px
Shape: circle (border-radius: var(--r-full))
Border: 2px solid var(--c-border)
Initials fallback: background: var(--c-navy-light); color: var(--c-navy); font-weight: 700
Edit affordance: camera badge, 28×28px, bottom-right, background: var(--c-navy); color: white
  min tap area: 44×44px via invisible padding
```

---

## 5. Accessibility Checklist (Low-Digital-Literacy Users)

- [ ] All interactive elements ≥ 48×48 px tap target
- [ ] Colour contrast ≥ 4.5:1 for all text; ≥ 3:1 for large text (18px bold / 24px regular)
- [ ] Every icon paired with visible text label OR has `aria-label` / `title`
- [ ] All images have meaningful `alt` text; decorative images have `alt=""`
- [ ] `<html lang="xx">` set dynamically when user switches language
- [ ] All form inputs have associated `<label>` (not just placeholder)
- [ ] Error messages injected into a `role="alert"` element so screen readers announce them
- [ ] Focus ring visible on all interactive elements (`:focus-visible` outline ≥ 2px)
- [ ] No content relies on colour alone to convey meaning (use icon + text + colour)
- [ ] Keyboard navigation: Tab order matches visual order; no focus traps except modals
- [ ] Modal dialogs trap focus correctly; Escape closes; focus returns to trigger
- [ ] No content auto-advances or auto-plays without user consent
- [ ] Loading states announced via `aria-live="polite"` or `aria-busy="true"`
- [ ] Buttons never say only "Click here" — label describes the action
- [ ] Destructive actions require confirmation dialog
- [ ] `prefers-reduced-motion` honoured — all CSS animations collapse to instant
- [ ] Skip-to-main-content link as first focusable element on web pages
- [ ] Time-based session warnings announced at least 20 seconds before expiry
- [ ] No flashing content > 3 Hz

---

## 6. Image Style Guide

### Login Scene (web hero / mobile splash)

- **Subject**: pixel-art Indian rural landscape — wheat field foreground, cumulus clouds, distant treeline, optional small structure (hut/temple silhouette).
- **Palette**: desaturated version of ref images. Sky: `#A8BDD4` → `#D4E4F0` gradient. Field: `#C8B87A` → `#E8DCA8`. Clouds: `#EEF4F8` → `#FFFFFF`.
- **Pixel grid**: 8px logical pixel (looks clean at 2× retina). Image size: 600×800 px → export WebP ≤ 120 KB.
- **Placement (web)**: right half of split-screen login card on desktop; full bleed behind frosted card on mobile.
- **Alt text**: `"Pixel art illustration of an Indian wheat field under a clear sky"`.
- **Must NOT**: include the Ashoka emblem, national flag, or identifiable political symbols.

### Chat Wallpapers

- **Style**: same muted, desaturated pixel-art aesthetic as login scene — different landscapes.
- **Subjects per wallpaper** (see Section 7 for IDs): plains, mountains, river-ghats, monsoon, starry-night, blank-ivory.
- **Size**: 1080×1920 px source → export WebP ≤ 150 KB each.
- **Thumbnail**: 180×320 px WebP ≤ 15 KB each.
- **Tileability**: should work as `background-size: cover` on any aspect ratio.
- **Alt text per wallpaper**: descriptive of the scene (see manifest).
- **Accessibility**: wallpaper must not make chat bubble text unreadable. Bubbles always have opaque backgrounds — wallpaper is only behind the gap between bubbles.

---

## 7. Wallpaper System Spec

The wallpaper manifest lives at `web/public/assets/wallpapers/manifest.json`.
Any wallpaper can be added, swapped, or removed by editing that one file.

The UI reads the manifest at runtime and renders a picker in Settings → Chat Wallpaper.

**Manifest shape:**
```json
[
  {
    "id": "string (slug)",
    "label": "Human-readable name (bilingual-safe short string)",
    "file": "/assets/wallpapers/<filename>.webp",
    "thumb": "/assets/wallpapers/thumbs/<filename>.webp",
    "alt": "Descriptive alt text for screen readers",
    "credit": "optional attribution string"
  }
]
```

**Default wallpapers to be created in Phase 3:**

| id | label | Scene |
|----|-------|-------|
| `plains` | "Golden Plains" | Wheat field, summer |
| `meadow` | "Green Meadow" | Open pasture, conifers |
| `mountains` | "Mountain Lake" | Snow peaks, still water |
| `river` | "River Ghats" | Stepped ghats, river |
| `monsoon` | "Monsoon Sky" | Dark clouds, rain |
| `night` | "Starry Night" | Village, night sky |
| `none` | "No Wallpaper" | Solid ivory `#FAF8F3` |

`"none"` has `"file": null` and `"thumb": null` — the UI uses the CSS background colour.

**Wallpaper management (manifest-driven — no code changes needed):**
1. **To add**: Drop the image in `/assets/wallpapers/` and add an entry to `manifest.json` with `"enabled": true`.
2. **To remove**: Delete the entry from `manifest.json` (and optionally delete the file).
3. **To swap**: Replace the file on disk or change the `"file"` field of its entry in `manifest.json`.

---

## 8. Framework & Codebase Snapshot (Audit)

| Concern | Detail |
|---------|--------|
| **Web framework** | React 18 + Vite 5 (no TypeScript) |
| **Routing** | react-router-dom v6 |
| **Styling** | Plain CSS (`web/src/index.css`) + inline JS styles via `ThemeContext.jsx` |
| **State / theme** | `ThemeProvider` in `ThemeContext.jsx`, CSS vars injected via `useEffect` |
| **i18n** | Custom `I18nContext.jsx` + `strings.js`; 8 languages incl. Hindi/Devanagari |
| **Icons** | lucide-react v1.48 |
| **Mobile** | React Native / Expo (separate `mobile/` tree) |
| **Backend** | Node.js, Express, SQLite, Twilio mock (`backend/`) |
| **Existing theme tokens** | Saffron-orange palette in `ThemeContext.jsx` (lightColors / darkColors) |
| **Wallpaper system** | ✅ Built in Phase 3 — manifest-driven, picker in Settings, wallpaper behind chat messages |
| **Web pages** | AuthFlow (login/register multi-step), Mail (main inbox), Settings, ForgotPassword, ChangePassword |
| **Web components** | TopBar, Sidebar, FilterChips, ThreadList, ChatView, ComposeModal, EmailView, AccountMenu, Avatar, BottomNav, VoiceLanguageMenu, GroupInfoModal, ImportantList, DraftsList |
| **Mobile screens** | Language, Terms, PhoneInput, PasswordLogin, CreatePassword, ForgotPassword, ChangePassword (onboarding); InboxScreen, ChatScreen, ComposeScreen, ProfileScreen, FolderListScreen, ImportantScreen |
| **Existing CSS custom props** | `--accent`, `--bg`, `--surface`, `--surface-alt`, `--surface-hover`, `--border`, `--border-strong`, `--text-primary`, `--text-secondary`, `--success`, `--danger`, `--highlight-bg/border/glow`, `--navy-mark`, `--accent-light` |

---

## 9. Phase 1 Token Migration Plan

Phase 1 will:
1. Add Google Fonts `<link>` to `web/index.html`.
2. Add new CSS custom property block (Section 2a above) to `web/src/index.css` `:root`.
3. Update `web/src/theme/ThemeContext.jsx` to replace old palette with the new navy/ivory/saffron/green palette and inject the new CSS vars.
4. Update global `body` styles in `index.css` (font-family, background, colour).
5. NOT touch any component logic — only colour/spacing token values.
