import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '..');
const srcDir = path.join(webDir, 'src');

const counts = {
  colors: 0,
  distortions: 0,
  imageLiterals: 0,
  brandPhoneMail: 0,
  darkModeNeutral: 0,
  contrast: 0,
  uiRules: 0
};

const violations = [];

function record(rule, file, lineNo, text, match) {
  counts[rule]++;
  const rel = path.relative(webDir, file).replace(/\\/g, '/');
  violations.push(`${rel}:${lineNo}: [${rule}] ${match ? `Found "${match}" in: ` : ''}${text.trim()}`);
}

// Color parsing helper
function parseHexColor(str) {
  if (!str) return null;
  str = str.trim();
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    } else if (hex.length === 4) {
      hex = hex.slice(0, 3).split('').map(c => c + c).join('');
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
  }
  const rgbMatch = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
  }
  return null;
}

// WCAG relative luminance and contrast calculation
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = getLuminance(...rgb1);
  const l2 = getLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// 1. Gather all files in src
function getFiles(dir) {
  const result = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...getFiles(full));
    } else if (/\.(jsx?|css)$/i.test(entry.name)) {
      result.push(full);
    }
  }
  return result;
}

const allSrcFiles = fs.existsSync(srcDir) ? getFiles(srcDir) : [];

// Regexes
const hexColorRegex = /(?<![\w-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g;
const rgbColorRegex = /\brgba?\s*\([^)]*\)/gi;
const hslColorRegex = /\bhsla?\s*\([^)]*\)/gi;
const distortionRegex = /background-size\s*:\s*100%\s+100%|scaleX\s*\(|loginCloudDrift|will-change\s*:\s*transform/i;
const imageLiteralRegex = /(?:'|"|`)[^'"`]*\.(?:webp|png|jpe?g|svg)[^'"`]*(?:'|"|`)/gi;
const phoneMailRegex = /(?:\bphone[\s-]?mail\b|phonemail)/gi;

for (const file of allSrcFiles) {
  const rel = path.relative(webDir, file).replace(/\\/g, '/');
  const isTokensCss = rel === 'src/theme/tokens.css' || rel === 'index.html';
  const isAssetsJs = rel === 'src/config/assets.js' || rel === 'index.html';

  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;

    // Rule 1: hex/rgb()/hsl() colours outside src/theme/tokens.css
    if (!isTokensCss) {
      let match;
      const hexRe = new RegExp(hexColorRegex);
      while ((match = hexRe.exec(line)) !== null) {
        record('colors', file, lineNo, line, match[0]);
      }

      const rgbRe = new RegExp(rgbColorRegex);
      while ((match = rgbRe.exec(line)) !== null) {
        record('colors', file, lineNo, line, match[0]);
      }

      const hslRe = new RegExp(hslColorRegex);
      while ((match = hslRe.exec(line)) !== null) {
        record('colors', file, lineNo, line, match[0]);
      }
    }

    // Rule 2: image distortions & prohibited animations
    if (distortionRegex.test(line)) {
      const m = line.match(distortionRegex);
      record('distortions', file, lineNo, line, m ? m[0] : '');
    }

    // Rule 3: image path literals outside src/config/assets.js
    if (!isAssetsJs) {
      const imgRe = new RegExp(imageLiteralRegex);
      let m;
      while ((m = imgRe.exec(line)) !== null) {
        if (m[0].includes('w3.org/2000/svg')) continue;
        record('imageLiterals', file, lineNo, line, m[0]);
      }
    }

    // Rule 4: phonemail / "phone mail" / "phone-mail"
    const pmRe = new RegExp(phoneMailRegex);
    let pmMatch;
    while ((pmMatch = pmRe.exec(line)) !== null) {
      const matchIndex = pmMatch.index;
      const matchedText = pmMatch[0];
      const matchEnd = matchIndex + matchedText.length;

      // Allow if part of @phonemail.com
      const isDomain = (matchIndex > 0 && line[matchIndex - 1] === '@') &&
                       line.slice(matchEnd).toLowerCase().startsWith('.com');

      // Allow if part of phonemail_* storage key
      const isStorageKey = line.slice(matchEnd).startsWith('_');

      if (!isDomain && !isStorageKey) {
        record('brandPhoneMail', file, lineNo, line, matchedText);
      }
    }
  });
}

// Rule 5 & 6: src/theme/tokens.css checks
const tokensCssPath = path.join(srcDir, 'theme', 'tokens.css');
if (!fs.existsSync(tokensCssPath)) {
  console.log('tokens rules skipped');
} else {
  const tokensContent = fs.readFileSync(tokensCssPath, 'utf-8');
  const tokensLines = tokensContent.split(/\r?\n/);

  // Extract tokens for light and dark themes
  const lightTokens = {};
  const darkTokens = {};

  let currentTheme = 'light';
  tokensLines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (line.includes('[data-theme="dark"]') || line.includes('.dark')) {
      currentTheme = 'dark';
    } else if (line.includes(':root') || line.includes('[data-theme="light"]')) {
      currentTheme = 'light';
    }

    const varMatch = line.match(/(--[\w-]+)\s*:\s*([^;]+);/);
    if (varMatch) {
      const varName = varMatch[1].trim();
      const varVal = varMatch[2].trim();
      if (currentTheme === 'light') {
        lightTokens[varName] = { val: varVal, lineNo };
      } else {
        darkTokens[varName] = { val: varVal, lineNo };
      }
    }
  });

  // Dark-mode neutral rule: --bg, --surface, --raised, --border, --border-strong, --text, --muted R=G=B within 2
  const neutralVars = ['--bg', '--surface', '--raised', '--border', '--border-strong', '--text', '--muted'];
  for (const v of neutralVars) {
    if (darkTokens[v]) {
      const rgb = parseHexColor(darkTokens[v].val);
      if (rgb) {
        const [r, g, b] = rgb;
        const diff = Math.max(r, g, b) - Math.min(r, g, b);
        if (diff > 2) {
          record('darkModeNeutral', tokensCssPath, darkTokens[v].lineNo, `Dark mode ${v}: ${darkTokens[v].val} (R=${r},G=${g},B=${b}, diff=${diff})`, v);
        }
      }
    }
  }

  // Contrast rule for both themes
  const contrastPairs = [
    { fg: '--text', bg: '--bg', min: 4.5, name: '--text on --bg' },
    { fg: '--muted', bg: '--surface', min: 4.5, name: '--muted on --surface' },
    { fg: '--on-primary', bg: '--primary', min: 4.5, name: '--on-primary on --primary' },
    { fg: '--link', bg: '--surface', min: 4.5, name: '--link on --surface' },
    { fg: '--text', bg: '--sent', min: 4.5, name: '--text on --sent' },
    { fg: '--danger', bg: '--danger-bg', min: 4.5, name: '--danger on --danger-bg' },
    { fg: '--border-strong', bg: '--surface', min: 3.0, name: '--border-strong on --surface' },
  ];

  for (const theme of ['light', 'dark']) {
    const tokens = theme === 'light' ? lightTokens : darkTokens;
    for (const pair of contrastPairs) {
      if (tokens[pair.fg] && tokens[pair.bg]) {
        const fgRgb = parseHexColor(tokens[pair.fg].val);
        const bgRgb = parseHexColor(tokens[pair.bg].val);
        if (fgRgb && bgRgb) {
          const ratio = getContrastRatio(fgRgb, bgRgb);
          if (ratio < pair.min) {
            record('contrast', tokensCssPath, tokens[pair.fg].lineNo, `${theme} theme: ${pair.name} contrast ratio is ${ratio.toFixed(2)} (required >= ${pair.min})`, pair.name);
          }
        }
      }
    }
  }
}

// UI rules: typeMessage has no "(", Mail.jsx must not import MailOpen, icon-only buttons carry no text label
{
  const stringsPath = path.join(srcDir, 'i18n', 'strings.js');
  if (fs.existsSync(stringsPath)) {
    fs.readFileSync(stringsPath, 'utf8').split(/\r?\n/).forEach((line, i) => {
      const m = line.match(/^\s*typeMessage\s*:\s*(["'`])(.*)\1/);
      if (m && m[2].includes('(')) record('uiRules', stringsPath, i + 1, line, '(');
    });
  }
  const mailPath = path.join(srcDir, 'pages', 'Mail.jsx');
  if (fs.existsSync(mailPath)) {
    fs.readFileSync(mailPath, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (/^\s*import\b.*\bMailOpen\b/.test(line)) record('uiRules', mailPath, i + 1, line, 'MailOpen');
    });
  }
  for (const f of allSrcFiles.filter((x) => x.endsWith('.jsx'))) {
    const code = fs.readFileSync(f, 'utf8');
    let from = 0;
    for (;;) {
      const start = code.indexOf('<button', from);
      if (start < 0) break;
      from = start + 7;
      let i = from;
      let depth = 0;
      for (; i < code.length; i++) {
        const c = code[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) break;
      }
      const attrs = code.slice(start, i);
      if (!/className=(?:"icon-btn"|\{"icon-btn"\})/.test(attrs)) continue;
      const end = code.indexOf('</button>', i);
      if (end < 0) continue;
      const inner = code.slice(i + 1, end).replace(/<[^>]*>/g, ' ').replace(/\{(?!\s*t\()[^{}]*\}/g, ' ');
      if (/[A-Za-z]{2,}/.test(inner) || /\{\s*t\(/.test(inner)) {
        record('uiRules', f, code.slice(0, start).split('\n').length, 'icon-btn contains a text label', 'icon-btn');
      }
    }
  }
  // D6: hex/rgb/hsl colour near "highlight" or "mark" in ChatView.jsx must not exist
  const chatViewPath = path.join(srcDir, 'components', 'ChatView.jsx');
  if (fs.existsSync(chatViewPath)) {
    const colorRE = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(/;
    fs.readFileSync(chatViewPath, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (/highlight|mark/i.test(line) && colorRE.test(line)) {
        record('uiRules', chatViewPath, i + 1, line, 'hex/rgb near highlight/mark');
      }
    });
  }

  // Prompt 7 FIX 3 B6: any Pencil/PenLine/SquarePen/Edit icon import from lucide-react outside ComposeIcon.jsx fails
  for (const f of allSrcFiles) {
    if (path.basename(f) === 'ComposeIcon.jsx') continue;
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/import\b.*?\b(Pencil|PenLine|SquarePen|FileEdit|Edit\d*)\b.*?from\s+['"]lucide-react['"]/.test(line)) {
        record('uiRules', f, i + 1, line, 'Compose/edit icon imported outside ComposeIcon.jsx');
      }
    });
  }
}

// Print results
console.log('=== LINT UI RESULTS ===');
if (violations.length > 0) {
  for (const v of violations) {
    console.error(v);
  }
  console.log('\n--- Violation Counts per Rule ---');
  console.log(`  hex/rgb/hsl colours:          ${counts.colors}`);
  console.log(`  distortions & animations:     ${counts.distortions}`);
  console.log(`  image path literals:          ${counts.imageLiterals}`);
  console.log(`  brand PhoneMail occurrences:  ${counts.brandPhoneMail}`);
  console.log(`  dark-mode neutral violation:  ${counts.darkModeNeutral}`);
  console.log(`  contrast violations:          ${counts.contrast}`);
  console.log(`  ui rule violations:           ${counts.uiRules}`);
  console.log(`\nTotal Violations: ${violations.length}`);
  process.exit(1);
} else {
  console.log('All UI lint checks passed!');
  process.exit(0);
}
