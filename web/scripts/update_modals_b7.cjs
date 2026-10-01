const fs = require('fs');
const path = require('path');

// 1. ComposeModal.jsx
const composePath = path.join(__dirname, '../src/components/ComposeModal.jsx');
let composeContent = fs.readFileSync(composePath, 'utf8');

if (!composeContent.includes('useIsMobile')) {
  composeContent = composeContent.replace(
    'import { useI18n } from "../i18n/I18nContext.jsx";',
    'import { useI18n } from "../i18n/I18nContext.jsx";\r\nimport { useIsMobile } from "../utils/useIsMobile.js";'
  );
  if (!composeContent.includes('useIsMobile')) {
    composeContent = composeContent.replace(
      'import { useI18n } from "../i18n/I18nContext.jsx";',
      'import { useI18n } from "../i18n/I18nContext.jsx";\nimport { useIsMobile } from "../utils/useIsMobile.js";'
    );
  }
}

composeContent = composeContent.replace(
  'const { t } = useI18n();\r\n  const isDark = theme === "dark";',
  'const { t } = useI18n();\r\n  const isMobile = useIsMobile(768);\r\n  const isDark = theme === "dark";'
);
composeContent = composeContent.replace(
  'const { t } = useI18n();\n  const isDark = theme === "dark";',
  'const { t } = useI18n();\n  const isMobile = useIsMobile(768);\n  const isDark = theme === "dark";'
);

const oldComposeBackdrop = /className=\{`formal-overlay-backdrop\$\{closing \? " closing" : ""\}`\}[\s\S]*?alignItems:\s*"center",\s*justifyContent:\s*"center",\s*padding:\s*24,/;
const newComposeBackdrop = `className={\`formal-overlay-backdrop\${closing ? " closing" : ""}\`}
      onClick={handleDiscard}
      style={{
        position: fixed ? "fixed" : "absolute",
        inset: 0,
        background: "var(--scrim)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 24,`;

if (oldComposeBackdrop.test(composeContent)) {
  composeContent = composeContent.replace(oldComposeBackdrop, newComposeBackdrop);
} else {
  console.error('oldComposeBackdrop not matched');
  process.exit(1);
}

const oldComposeCard = /style=\{\{\s*width:\s*"100%",\s*maxWidth:\s*680,\s*maxHeight:\s*"92%",\s*background:\s*colors\.surface,\s*borderRadius:\s*"var\(--r-xl\)",\s*border:\s*`1px solid \$\{colors\.borderStrong\}`,[\s\S]*?overflow:\s*"hidden",\s*\}\}/;
const newComposeCard = `style={{
          width: "100%",
          maxWidth: isMobile ? "100%" : 680,
          maxHeight: isMobile ? "92dvh" : "92%",
          background: "var(--surface)",
          borderRadius: isMobile ? "var(--r-xl) var(--r-xl) 0 0" : "var(--r-xl)",
          border: \`1px solid \${colors.borderStrong}\`,
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          margin: 0,
          paddingBottom: isMobile ? "calc(16px + env(safe-area-inset-bottom, 0px))" : 0,
        }}`;

if (oldComposeCard.test(composeContent)) {
  composeContent = composeContent.replace(oldComposeCard, newComposeCard);
  // Add decorative handle
  composeContent = composeContent.replace(
    '{/* Header */}',
    `{isMobile && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px", flexShrink: 0 }}>
            <div
              aria-hidden="true"
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                background: "var(--border-strong)",
              }}
            />
          </div>
        )}\r\n        {/* Header */}`
  );
} else {
  console.error('oldComposeCard not matched');
  process.exit(1);
}
fs.writeFileSync(composePath, composeContent, 'utf8');
console.log('ComposeModal updated for B7');

// 2. GroupInfoModal.jsx
const groupPath = path.join(__dirname, '../src/components/GroupInfoModal.jsx');
let groupContent = fs.readFileSync(groupPath, 'utf8');

if (!groupContent.includes('useIsMobile')) {
  groupContent = groupContent.replace(
    'import { useTheme } from "../theme/ThemeContext.jsx";',
    'import { useTheme } from "../theme/ThemeContext.jsx";\r\nimport { useIsMobile } from "../utils/useIsMobile.js";'
  );
  if (!groupContent.includes('useIsMobile')) {
    groupContent = groupContent.replace(
      'import { useTheme } from "../theme/ThemeContext.jsx";',
      'import { useTheme } from "../theme/ThemeContext.jsx";\nimport { useIsMobile } from "../utils/useIsMobile.js";'
    );
  }
}

groupContent = groupContent.replace(
  'export default function GroupInfoModal({ group, onClose, me, isDark }) {\r\n  const { colors } = useTheme();',
  'export default function GroupInfoModal({ group, onClose, me, isDark }) {\r\n  const { colors } = useTheme();\r\n  const isMobile = useIsMobile(768);'
);
groupContent = groupContent.replace(
  'export default function GroupInfoModal({ group, onClose, me, isDark }) {\n  const { colors } = useTheme();',
  'export default function GroupInfoModal({ group, onClose, me, isDark }) {\n  const { colors } = useTheme();\n  const isMobile = useIsMobile(768);'
);

const oldGroupBackdrop = /className=\{`formal-overlay-backdrop\$\{closing \? " closing" : ""\}`\}[\s\S]*?alignItems:\s*"center",\s*justifyContent:\s*"center",\s*padding:\s*16,/;
const newGroupBackdrop = `className={\`formal-overlay-backdrop\${closing ? " closing" : ""}\`}
      onClick={requestClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 9999,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 16,`;

if (oldGroupBackdrop.test(groupContent)) {
  groupContent = groupContent.replace(oldGroupBackdrop, newGroupBackdrop);
} else {
  console.error('oldGroupBackdrop not matched');
  process.exit(1);
}

const oldGroupCard = /style=\{\{\s*background:\s*colors\.surface,\s*borderRadius:\s*"var\(--r-xl\)",\s*border:\s*`1px solid \$\{colors\.border\}`,[\s\S]*?position:\s*"relative",\s*\}\}/;
const newGroupCard = `style={{
          background: "var(--surface)",
          borderRadius: isMobile ? "var(--r-xl) var(--r-xl) 0 0" : "var(--r-xl)",
          border: \`1px solid \${colors.border}\`,
          padding: 24,
          paddingBottom: isMobile ? "calc(16px + env(safe-area-inset-bottom, 0px))" : 24,
          maxWidth: isMobile ? "100%" : 380,
          width: "100%",
          maxHeight: isMobile ? "92dvh" : "88vh",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          position: "relative",
          margin: 0,
          overflowY: "auto",
        }}`;

if (oldGroupCard.test(groupContent)) {
  groupContent = groupContent.replace(oldGroupCard, newGroupCard);
  groupContent = groupContent.replace(
    'aria-label="Group details"\r\n        onClick={(e) => e.stopPropagation()}',
    `aria-label="Group details"\r\n        onClick={(e) => e.stopPropagation()}>\r\n        {isMobile && (\r\n          <div style={{ display: "flex", justifyContent: "center", padding: "0 0 8px", flexShrink: 0 }}>\r\n            <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 999, background: "var(--border-strong)" }} />\r\n          </div>\r\n        )}`
  );
  if (!groupContent.includes('width: 36, height: 4')) {
    groupContent = groupContent.replace(
      'aria-label="Group details"\n        onClick={(e) => e.stopPropagation()}',
      `aria-label="Group details"\n        onClick={(e) => e.stopPropagation()}>\n        {isMobile && (\n          <div style={{ display: "flex", justifyContent: "center", padding: "0 0 8px", flexShrink: 0 }}>\n            <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 999, background: "var(--border-strong)" }} />\n          </div>\n        )}`
    );
  }
} else {
  console.error('oldGroupCard not matched');
  process.exit(1);
}

fs.writeFileSync(groupPath, groupContent, 'utf8');
console.log('GroupInfoModal updated for B7');
