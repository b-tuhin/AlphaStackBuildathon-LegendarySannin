const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../src/index.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Replace the filter-chips-scroll block
const oldFilterChips = /\/\* ── Filter Chips scroll: hidden scrollbar \+ right-edge fade ─────────────────── \*\/\s*\.filter-chips-scroll \{[\s\S]*?\}\s*\.filter-chips-scroll::-webkit-scrollbar \{[\s\S]*?\}\s*/;

const newFilterChips = `/* ── Filter Chips scroll: right-edge fade mask ─────────────────── */
.filter-chips-scroll {
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 24px), transparent 100%);
  mask-image: linear-gradient(to right, black calc(100% - 24px), transparent 100%);
}

/* ── Hide scrollbars only inside @media (pointer: coarse) ───────────── */
@media (pointer: coarse) {
  .chat-scroll-container,
  .filter-chips-scroll,
  .themed-menu-scrollbar,
  .msg-actions-menu {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .chat-scroll-container::-webkit-scrollbar,
  .filter-chips-scroll::-webkit-scrollbar,
  .themed-menu-scrollbar::-webkit-scrollbar,
  .msg-actions-menu::-webkit-scrollbar {
    display: none;
  }
}

/* ── Chat polish: bubble long text and attachments ───────────────── */
.msg-bubble-appear {
  overflow-wrap: anywhere;
}

.msg-bubble-appear img,
.msg-bubble-appear .attachment-item {
  max-width: 100%;
  border-radius: var(--r-md);
}
`;

if (oldFilterChips.test(css)) {
  css = css.replace(oldFilterChips, newFilterChips);
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('index.css updated for Part A OK');
} else {
  console.error('filter-chips-scroll pattern not found in index.css');
  process.exit(1);
}
