const fs = require('fs');
const path = require('path');

const stringsPath = path.join(__dirname, '../src/i18n/strings.js');
let content = fs.readFileSync(stringsPath, 'utf8');

const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';

const newKeysByLang = {
  en: {
    cancelSelection: "Cancel selection",
    previousMatch: "Previous match",
    nextMatch: "Next match",
    closeSearch: "Close search",
    cancelReply: "Cancel reply",
    removeAttachment: "Remove attachment",
    moreOptions: "More options",
    stopListening: "Stop listening",
    logoAlt: "Bharat Chat",
  },
  hi: {
    cancelSelection: "चयन रद्द करें",
    previousMatch: "पिछला परिणाम",
    nextMatch: "अगला परिणाम",
    closeSearch: "खोज बंद करें",
    cancelReply: "उत्तर रद्द करें",
    removeAttachment: "संलग्नक हटाएं",
    moreOptions: "अधिक विकल्प",
    stopListening: "सुनना बंद करें",
    logoAlt: "Bharat Chat",
  },
  ta: {
    cancelSelection: "தேர்வை ரத்துசெய்",
    previousMatch: "முந்தைய பொருத்தம்",
    nextMatch: "அடுத்த பொருத்தம்",
    closeSearch: "தேடலை மூடு",
    cancelReply: "பதிலை ரத்துசெய்",
    removeAttachment: "இணைப்பை நீக்கு",
    moreOptions: "கூடுதல் விருப்பங்கள்",
    stopListening: "கேட்பதை நிறுத்து",
    logoAlt: "Bharat Chat",
  },
  te: {
    cancelSelection: "ఎంపికను రద్దు చేయండి",
    previousMatch: "మునుపటి ఫలితం",
    nextMatch: "తదుపరి ఫలితం",
    closeSearch: "శోధనను మూసివేయి",
    cancelReply: "ప్రత్యుత్తరాన్ని రద్దు చేయండి",
    removeAttachment: "జోడింపును తొలగించండి",
    moreOptions: "మరిన్ని ఎంపికలు",
    stopListening: "వినడం ఆపు",
    logoAlt: "Bharat Chat",
  },
  bn: {
    cancelSelection: "নির্বাচন বাতিল করুন",
    previousMatch: "পূর্ববর্তী মিল",
    nextMatch: "পরবর্তী মিল",
    closeSearch: "অনুসন্ধান বন্ধ করুন",
    cancelReply: "উত্তর বাতিল করুন",
    removeAttachment: "সংযুক্তি সরান",
    moreOptions: "আরও বিকল্প",
    stopListening: "শোনা বন্ধ করুন",
    logoAlt: "Bharat Chat",
  },
  mr: {
    cancelSelection: "निवड रद्द करा",
    previousMatch: "मागील जुळणी",
    nextMatch: "पुढील जुळणी",
    closeSearch: "शोध बंद करा",
    cancelReply: "उत्तर रद्द करा",
    removeAttachment: "संलग्नक काढा",
    moreOptions: "अधिक पर्याय",
    stopListening: "ऐकणे थांबवा",
    logoAlt: "Bharat Chat",
  },
  pa: {
    cancelSelection: "ਚੋਣ ਰੱਦ ਕਰੋ",
    previousMatch: "ਪਿਛਲਾ ਨਤੀਜਾ",
    nextMatch: "ਅਗਲਾ ਨਤੀਜਾ",
    closeSearch: "ਖੋਜ ਬੰਦ ਕਰੋ",
    cancelReply: "ਜਵਾਬ ਰੱਦ ਕਰੋ",
    removeAttachment: "ਨੱਥੀ ਹਟਾਓ",
    moreOptions: "ਹੋਰ ਵਿਕਲਪ",
    stopListening: "ਸੁਣਨਾ ਬੰਦ ਕਰੋ",
    logoAlt: "Bharat Chat",
  },
  gu: {
    cancelSelection: "પસંદગી રદ કરો",
    previousMatch: "પાછલું પરિણામ",
    nextMatch: "આગલું પરિણામ",
    closeSearch: "શોધ બંધ કરો",
    cancelReply: "જવાબ રદ કરો",
    removeAttachment: "જોડાણ દૂર કરો",
    moreOptions: "વધુ વિકલ્પો",
    stopListening: "સાંભળવાનું બંધ કરો",
    logoAlt: "Bharat Chat",
  },
};

// Insert before `pinned: "` in each language block
for (const [lang, keys] of Object.entries(newKeysByLang)) {
  const linesToInsert = Object.entries(keys)
    .map(([k, v]) => `  ${k}: "${v}",`)
    .join(eol);

  // Match the block end or pinned key for that language
  // e.g. for en, find `const en = { ... pinned: ... };`
  const langRegex = new RegExp(`(const\\s+${lang}\\s*=\\s*\\{[\\s\\S]*?)(pinned:\\s*[^,\\r\\n]+,?)`, 'm');
  const match = content.match(langRegex);
  if (match) {
    content = content.replace(langRegex, `$1${linesToInsert}${eol}  $2`);
    console.log(`Inserted keys into ${lang}`);
  } else {
    console.error(`Could not match language: ${lang}`);
    process.exit(1);
  }
}

fs.writeFileSync(stringsPath, content, 'utf8');
console.log('Successfully updated strings.js with new keys');
