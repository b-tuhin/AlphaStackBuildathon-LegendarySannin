const fs = require('fs');
const path = require('path');

const mailPath = path.join(__dirname, '../src/pages/Mail.jsx');
let content = fs.readFileSync(mailPath, 'utf8');

// 1. Imports: add useNavigate and BottomNav
content = content.replace(
  'import React, { useEffect, useState, useCallback, useRef } from "react";',
  'import React, { useEffect, useState, useCallback, useRef } from "react";\r\nimport { useNavigate } from "react-router-dom";\r\nimport BottomNav from "../components/BottomNav.jsx";'
);
if (!content.includes('import BottomNav from "../components/BottomNav.jsx";')) {
  content = content.replace(
    'import React, { useEffect, useState, useCallback, useRef } from "react";',
    'import React, { useEffect, useState, useCallback, useRef } from "react";\nimport { useNavigate } from "react-router-dom";\nimport BottomNav from "../components/BottomNav.jsx";'
  );
}

// 2. Add navigate = useNavigate()
content = content.replace(
  'export default function Mail() {\r\n  const { colors } = useTheme();',
  'export default function Mail() {\r\n  const { colors } = useTheme();\r\n  const navigate = useNavigate();'
);
content = content.replace(
  'export default function Mail() {\n  const { colors } = useTheme();',
  'export default function Mail() {\n  const { colors } = useTheme();\n  const navigate = useNavigate();'
);

// 3. Canvas outer padding
const oldCanvas = /padding:\s*isNarrow\s*\?\s*0\s*:\s*12,\s*gap:\s*isNarrow\s*\?\s*0\s*:\s*12/;
const newCanvas = 'padding: isNarrow ? "calc(8px + env(safe-area-inset-top, 0px)) 8px 8px 8px" : 12, gap: isNarrow ? 8 : 12';
content = content.replace(oldCanvas, newCanvas);

// 4. Center list pane styling on narrow and desktop
const oldListPane = /ref=\{listPaneRef\}[\s\S]*?style=\{\{[\s\S]*?width:\s*isMobile\s*\?\s*"100%"\s*:\s*360,[\s\S]*?overflow:\s*"hidden",[\s\S]*?\}\}/m;
const newListPane = `ref={listPaneRef}
            {...coveredProps}
            style={{
              position: "relative",
              width: isNarrow ? "100%" : 360,
              display: "flex",
              flexDirection: "column",
              background: "var(--surface)",
              flexShrink: 0,
              overflow: "hidden",
              borderRadius: "var(--r-lg)",
              border: "1px solid var(--border)",
              margin: 0,
              flex: isNarrow ? 1 : undefined,
            }}`;
if (oldListPane.test(content)) {
  content = content.replace(oldListPane, newListPane);
  console.log('List pane updated');
} else {
  console.error('List pane pattern not matched');
  process.exit(1);
}

// 5. FAB position: 16px inside card corner, above bottom nav on mobile
content = content.replace(
  'bottom: 20,\r\n                  right: 20,',
  'bottom: isNarrow ? "calc(80px + env(safe-area-inset-bottom, 0px))" : 16,\r\n                  right: 16,'
);
content = content.replace(
  'bottom: 20,\n                  right: 20,',
  'bottom: isNarrow ? "calc(80px + env(safe-area-inset-bottom, 0px))" : 16,\n                  right: 16,'
);

// 6. Thread list scroll container: bottom padding on mobile so content isn't covered by bottom nav
content = content.replace(
  '<div key={folder} className="view-fade" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>',
  '<div key={folder} className="view-fade" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", paddingBottom: isNarrow ? "calc(72px + env(safe-area-inset-bottom, 0px))" : 0 }}>'
);

// 7. Full-screen chat on phone (B4 floating card)
const oldMobileChat = /\/\/ Phones: the conversation slides in over the list[\s\S]*?if \(isMobile\) \{[\s\S]*?return chatItem \? \([\s\S]*?className=\{`chat-pane--mobile\$\{chatClosing \? " closing" : ""\}`\}[\s\S]*?style=\{\{[\s\S]*?\}\}[\s\S]*?>[\s\S]*?\{chatView\}[\s\S]*?<\/div>[\s\S]*?\) : null;[\s\S]*?\}/m;

const newMobileChat = `// Phone / narrow: conversation slides in over the list as a floating card (B4)
            if (isNarrow) {
              return chatItem ? (
                <div
                  className={\`chat-pane--mobile\${chatClosing ? " closing" : ""}\`}
                  style={{
                    position: "fixed",
                    inset: "calc(8px + env(safe-area-inset-top, 0px)) 8px calc(8px + env(safe-area-inset-bottom, 0px)) 8px",
                    zIndex: 1001,
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--bg)",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  {chatView}
                </div>
              ) : null;
            }`;

if (oldMobileChat.test(content)) {
  content = content.replace(oldMobileChat, newMobileChat);
  console.log('Mobile chat card updated');
} else {
  console.error('oldMobileChat pattern not matched');
  process.exit(1);
}

// 8. Render BottomNav when isNarrow && !chatItem
const bottomNavSnippet = `{/* Floating Bottom Nav (B5) */}
      {isNarrow && !chatItem && (
        <BottomNav
          folder={folder}
          onSelect={(newFolder) => {
            setFolder(newFolder);
            setSelectedItem(null);
            setTrashSelectionMode(false);
            setSelectedTrashIds(new Set());
          }}
          onOpenProfile={() => navigate("/settings/profile")}
          isProfileActive={false}
        />
      )}
    </div>`;

content = content.replace(
  /\{\/\* Undo Send Toast \*\/\}[\s\S]*?<\/div>\s*<\/div>/m,
  (match) => {
    // replace trailing </div> with bottomNavSnippet
    return match.replace(/<\/div>$/, bottomNavSnippet);
  }
);

fs.writeFileSync(mailPath, content, 'utf8');
console.log('Mail.jsx updated for Part B OK');
