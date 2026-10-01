const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../src/i18n/strings.js");
let content = fs.readFileSync(filePath, "utf8");

const replacements = [
  { from: 'welcomeTitle: "Welcome to Bharat Chat",', to: 'welcomeTitle: "Welcome",' },
  { regex: /welcomeTitle:\s*"Bharat Chat[^"]*",/g, to: [
    'welcomeTitle: "आपका स्वागत है",', // hi
    'welcomeTitle: "வரவேற்கிறோம்",', // ta
    'welcomeTitle: "స్వాగతం",', // te
    'welcomeTitle: "স্বাগতম",', // bn
    'welcomeTitle: "आपले स्वागत आहे",', // mr
    'welcomeTitle: "ਤੁਹਾਡਾ ਸਵਾਗਤ ਹੈ",', // pa
    'welcomeTitle: "આપનું સ્વાગત છે",' // gu
  ]}
];

// Step 1: English
content = content.replace(replacements[0].from, replacements[0].to);

// Step 2: The other 7 languages in order
let idx = 0;
content = content.replace(replacements[1].regex, () => {
  const repl = replacements[1].to[idx];
  idx++;
  return repl;
});

fs.writeFileSync(filePath, content, "utf8");
console.log("Updated welcomeTitle in strings.js across all languages. Replaced count:", idx + 1);
