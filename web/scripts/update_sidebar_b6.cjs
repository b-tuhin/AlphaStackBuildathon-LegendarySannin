const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(__dirname, '../src/components/Sidebar.jsx');
let content = fs.readFileSync(sidebarPath, 'utf8');

// Replace isMobile with isNarrow
content = content.replace('const isMobile = useIsMobile(768);', 'const isNarrow = useIsMobile(1023);');

// Replace touchHandlers
content = content.replace('const touchHandlers = isMobile', 'const touchHandlers = isNarrow');

// Replace asideStyle
const oldAsideStyle = /const asideStyle = isMobile[\s\S]*?: \{\s*width: isOpen \? 240 : 0,/;
const newAsideStyle = `const asideStyle = isNarrow
    ? {
        position: "fixed",
        top: 8,
        bottom: 8,
        left: 8,
        width: "min(320px, 86vw)",
        maxWidth: "min(320px, 86vw)",
        borderRadius: "var(--r-xl)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 1011,
        transform: dragging ? \`translateX(\${dragX}px)\` : isOpen ? "translateX(0)" : "translateX(calc(-100% - 16px))",
        transition: dragging
          ? "none"
          : \`transform \${isOpen ? OPEN_MS : CLOSE_MS}ms \${EASE}, box-shadow \${CLOSE_MS}ms ease, visibility 0s linear \${isOpen ? 0 : CLOSE_MS}ms\`,
        boxShadow: isOpen ? "var(--shadow-sm)" : "none",
        visibility: isOpen ? "visible" : "hidden",
        pointerEvents: isOpen ? "auto" : "none",
        overflowY: "auto",
        touchAction: "pan-y",
      }
    : {
        width: isOpen ? 240 : 0,`;

if (oldAsideStyle.test(content)) {
  content = content.replace(oldAsideStyle, newAsideStyle);
} else {
  console.error('oldAsideStyle not matched');
  process.exit(1);
}

// In scrim check isMobile -> isNarrow
content = content.replace('{isMobile && (', '{isNarrow && (');

// Inner container width
content = content.replace('width: 240,', 'width: "100%",');
content = content.replace('...(isMobile', '...(isNarrow');

fs.writeFileSync(sidebarPath, content, 'utf8');
console.log('Sidebar.jsx updated for B6 OK');
