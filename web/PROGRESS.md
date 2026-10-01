Prompt 1 step 1: restarting lean
Prompt 1 step 1 done: web/package.json, web/scripts/lint-ui.mjs
Prompt 2 done: brand.js, strings.js (all 8 langs), AuthFlow.jsx, ChangePassword.jsx, ForgotPassword.jsx, NotFound.jsx, Settings.jsx, ComposeModal.jsx, index.css, translateFallback.js, contact.js, index.html, terms.html, package.json
Prompt 3 done: assets.js, assets.lock.json, assets-check.mjs, ASSETS.md, 8 PNGs copied+verified, AuthFlow.jsx, NotFound.jsx, TopBar.jsx hardcoded paths removed
Prompt 4 done: tokens.css, main.jsx, index.css, ThemeContext.jsx, contact.js, image.js, and components (zero color violations, pure neutral dark mode, lint:ui passed)
Prompt 5 done: TopBar.jsx, FilterChips.jsx, Mail.jsx, ThreadList.jsx, ChatView.jsx, Settings.jsx, index.css (geometry, heights, 68px aligned headers, 360px sidebar, 72px chat rows, 44px controls, 16px radius, tokens & focus-visible)

Prompt 6 done (repaired by Claude): src/theme/tokens.css, src/index.css, src/App.jsx, src/components/ChatView.jsx, src/components/TopBar.jsx, src/components/Sidebar.jsx, src/components/AccountMenu.jsx, src/pages/Mail.jsx, scripts/lint-ui.mjs

Prompt 6 Part A done: index.css (icon-btn/btn-text/menu-item/chip-btn rebuilt), ChatView.jsx (9 reclassified, menu tokens, star A6), Settings.jsx (btn-text Back to Mail)

Prompt 6 Part B done: Settings.jsx (display name & alias flex gap:12, width:auto, 110px banner removed, card padding:24 max-width:640, 44px Change Password/Log Out, dark theme sentence removed), index.css (ambient-bg-layer & path animations removed)

Prompt 6 Part C done: strings.js (typeMessage parens removed, pressEnterHint added across all 8 langs), index.css (placeholder ellipsis, .press-enter-hint pointer:fine), ChatView.jsx (single rounded composer, 40px subject divider, 16px textarea 5-line max-grow, mobile '+' popover for AI sparkle & template, 1 trailing action, 89px height <= 108px)

Prompt 6 Part A done: index.css (.kebab-btn 36x36/44px, :active hover), Settings.jsx (minHeight:64 Back to Mail nowrap), AccountMenu.jsx & EmailView.jsx (reclassified to menu-item and btn-text), ChatView.jsx (A4 36px header row avatar 24px, A5 absolute popover with flip logic, ordered menu items, 32px translate sub-list, A6 --important star)

Prompt 6 Part D done: EmptyState.jsx created (88px circle, 40px icon var(--link), 20px/700 title, 15px muted body max-width:320), strings.js (8 empty state keys in 8 langs), Mail.jsx (folder-based EmptyState mapping, folder.charAt removed, MailOpen import removed), ChatView.jsx & ThreadList.jsx (MailOpen empty state replaced)

Prompt 6 Part E done: index.css (.login-card <=768px sheet-up 280ms, 60dvh max-height, :focus-within 88dvh, 36x4 handle, fixed photo), AuthFlow.jsx (compact content, Globe lucide in var(--link), 52px language rows, 48px Continue), PasswordField.jsx (44px icon-btn toggle with Eye/EyeOff)

Prompt 6 Part F done: tokens.css (--r-sm/md/lg/xl), Mail.jsx (isNarrow canvas 12px pad/gap, floating panels --r-lg), ThreadList.jsx (inset 8px rows, --r-md, --primary-tint selected, transparent bg), Sidebar.jsx (44px items --r-md --primary-tint/--link active), index.css (filter-chips-scroll hidden scrollbar + mask fade), ChatView.jsx (bubbles --r-lg tail, --sent/--received, 12px 16px pad, 78%/560px max, 2px/12px group gap), ComposeModal.jsx + GroupInfoModal.jsx (--r-xl)
Prompt 7 Part A done: ChatView.jsx, index.css, strings.js
Prompt 7 Part B done: Mail.jsx (B1 canvas, B3/B4 floating cards, BottomNav), TopBar.jsx (B2 floating row), BottomNav.jsx (B5 floating pill), Sidebar.jsx (B6 floating drawer), ComposeModal.jsx+GroupInfoModal.jsx (B7 bottom sheets), Settings.jsx+ForgotPassword.jsx+ChangePassword.jsx (B9 canvas), index.css (B10 sweep clean)
Prompt 7 Part C done: assets.js, Logo.jsx, TopBar.jsx, Sidebar.jsx, Mail.jsx, AuthFlow.jsx, Settings.jsx, NotFound.jsx, ForgotPassword.jsx, ChangePassword.jsx, ComposeModal.jsx, strings.js, index.html, main.jsx, lint-ui.mjs
Prompt 7 Part D done: tokens.css (--highlight-bg/ring/mark-bg/fg), index.css (.msg-highlight+mark), ChatView.jsx (D3 inline fix, D4 highlightText+searchQuery prop), textHighlight.jsx, ThreadList.jsx (D4 snippet highlight), Mail.jsx (query prop), lint-ui.mjs (D6)

Prompt 7 FIX done: main.jsx (double-rAF splash timing, pointer-events:none, 600ms hard-remove), Logo.jsx (safeGetAsset try/catch, no path literal), index.html (TEMP-ERROR-CATCHER)

Prompt 7 FIX done: main.jsx (double-rAF splash timing, pointer-events:none, 600ms hard-remove), Logo.jsx (safeGetAsset try/catch, no path literal), index.html (TEMP-ERROR-CATCHER)

Prompt 7 FIX 2 done: ThreadList.jsx (query passed to ThreadRow + added to ThreadRow destructuring)

Prompt 7 FIX 3 Part A done: ComposeModal.jsx, GroupInfoModal.jsx, Sidebar.jsx (Part A5 skipped: eslint missing)

Prompt 7 FIX 3 Part B done: ComposeIcon.jsx, Mail.jsx, ChatView.jsx, PlaceholderResolverBar.jsx, lint-ui.mjs

Prompt 8 Part A done: src/theme/tokens.css, src/index.css, src/components/FilterChips.jsx
IN PROGRESS: Prompt 8 Part B
