/**
 * PhoneMail i18n string dictionaries.
 * Keys are camelCase identifiers; values are translated strings.
 * Add new languages by adding a new object with the same keys.
 */

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "bn", label: "বাংলা" },
  { code: "mr", label: "मराठी" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "gu", label: "ગુજરાતી" },
];

const en = {
  // App name
  appName: "PhoneMail",

  // Sidebar / Folders
  folders: "Folders",
  folderHome: "Inbox & Sent",
  folderImportant: "Important",
  folderSpam: "Spam",
  folderTrash: "Trash",

  // TopBar
  searchPlaceholder: "Search name, phone, subject or messages",

  // ChatView header actions
  openAsLetter: "Open as Letter",
  moveToTrash: "Move to trash",
  backToConversations: "Back to conversations",
  groupConversation: "Group Conversation",
  groupParticipants: (n) => `Group · ${n} participants`,

  // ChatView empty state
  welcomeTitle: "Welcome to PhoneMail",
  welcomeBody: "Select a conversation on the left to view messages and reply.",

  // ChatView compose bar
  subjectOptional: "Subject (optional)",
  typeMessage: "Type a message… (Press Enter to send)",
  typeMessageListening: "Listening…",
  sendMessage: "Send message",
  attachFile: "Attach file (max 10MB)",
  voiceToText: "Voice to text",
  openFormalComposer: "Compose formal letter",
  composeFormalLetter: "Compose formal letter",
  formalReply: "Formal Reply",
  conversationReply: "Conversation Reply",
  aiDraftAssistant: "AI draft assistant",
  replyingTo: "Replying to",
  replied: "Replied",
  replyDirectly: "Reply",
  replyPrivate: "Private reply",
  readAloud: "Read aloud",
  stopReading: "Stop reading",
  importantMessage: "Important message",
  markImportant: "Mark as important",
  unmarkImportant: "Mark as not important",
  download: "Download",
  copy: "Copy",
  copied: "Copied!",
  edit: "Edit",
  delete: "Delete",
  messageDetails: "Message Details",
  searchInChat: "Search in conversation",
  searchChatPlaceholder: "Search messages…",
  noMessagesFound: "No matching messages",

  // Mail page
  composeFab: "Compose new message",
  messageSending: (s) => `Message sending (${s}s)`,
  undo: "Undo",

  // ComposeModal
  newMessage: "New Message",
  toPlaceholder: "To (phone or number, comma-separated for group)",
  subjectPlaceholder: "Subject",
  messagePlaceholder: "Message",
  send: "Send",
  attach: "Attach",
  voice: "Voice",
  helpMeWrite: "Help me write this",
  drafting: "Drafting…",
  aiAssistedDraft: "AI-assisted draft — please review before sending",
  recipientLocked: "Recipient locked",

  // AccountMenu / Settings
  backToMail: "Back to Mail",
  emailAddress: "Email address",
  displayName: "Display Name",
  aliasIds: "Alias IDs",
  language: "Language",
  darkMode: "Dark Mode",
  darkModeDesc: "Toggle light / dark theme",
  switchToLight: "Switch to light mode",
  switchToDark: "Switch to dark mode",
  save: "Save",
  add: "Add",
  logOut: "Log Out",
  profileSettings: "Profile & Settings",
  importantMessages: "Important",
  noImportantMessagesDesc: "Tap the star on any message to save it here for quick access.",

  // Empty states
  noConversations: "No conversations yet. Start a chat or compose a new message.",
  noFavorites: "No conversations with an important message.",
  noMessages: (folder) => `No messages in ${folder}.`,

  // Filter chips
  filterAll: "All",
  filterUnread: "Unread",
  filterAttachments: "Attachments",
  filterImportant: "Important",

  // Conversation view labels (for mobile/narrow switcher)
  conversationView: "Conversation View",
  letterView: "Letter View",
};

const hi = {
  appName: "फ़ोनमेल",
  folders: "फ़ोल्डर",
  folderHome: "इनबॉक्स और भेजे गए",
  folderImportant: "महत्वपूर्ण",
  folderSpam: "स्पैम",
  folderTrash: "ट्रैश",
  searchPlaceholder: "नाम, फ़ोन, विषय या संदेश खोजें",
  openAsLetter: "पत्र के रूप में खोलें",
  moveToTrash: "ट्रैश में भेजें",
  backToConversations: "बातचीत पर वापस जाएं",
  groupConversation: "समूह वार्तालाप",
  groupParticipants: (n) => `समूह · ${n} प्रतिभागी`,
  welcomeTitle: "फ़ोनमेल में आपका स्वागत है",
  welcomeBody: "संदेश देखने के लिए बाईं ओर कोई बातचीत चुनें।",
  subjectOptional: "विषय (वैकल्पिक)",
  typeMessage: "संदेश लिखें…",
  typeMessageListening: "सुन रहा है…",
  sendMessage: "संदेश भेजें",
  attachFile: "फ़ाइल संलग्न करें",
  voiceToText: "वॉइस से टेक्स्ट",
  openFormalComposer: "औपचारिक पत्र लिखें",
  composeFormalLetter: "औपचारिक पत्र लिखें",
  formalReply: "औपचारिक जवाब",
  conversationReply: "बातचीत में जवाब दें",
  aiDraftAssistant: "AI ड्राफ़्ट सहायक",
  replyingTo: "उत्तर दे रहे हैं",
  replied: "उत्तर दिया",
  replyDirectly: "उत्तर दें",
  replyPrivate: "निजी उत्तर",
  readAloud: "पढ़कर सुनाएं",
  stopReading: "पढ़ना बंद करें",
  importantMessage: "महत्वपूर्ण संदेश",
  markImportant: "महत्वपूर्ण चिह्नित करें",
  unmarkImportant: "महत्वपूर्ण हटाएं",
  download: "डाउनलोड",
  messageDetails: "संदेश विवरण",
  searchInChat: "बातचीत में खोजें",
  searchChatPlaceholder: "संदेश खोजें…",
  noMessagesFound: "कोई संदेश नहीं मिला",
  composeFab: "नया संदेश",
  messageSending: (s) => `संदेश भेजा जा रहा है (${s}s)`,
  undo: "पूर्ववत करें",
  newMessage: "नया संदेश",
  toPlaceholder: "प्राप्तकर्ता (फ़ोन नंबर, कई के लिए अल्पविराम से)",
  subjectPlaceholder: "विषय",
  messagePlaceholder: "संदेश",
  send: "भेजें",
  attach: "संलग्न करें",
  voice: "वॉइस",
  helpMeWrite: "लिखने में मदद करें",
  drafting: "ड्राफ़्ट बन रहा है…",
  aiAssistedDraft: "AI-सहायक ड्राफ़्ट — भेजने से पहले समीक्षा करें",
  recipientLocked: "प्राप्तकर्ता लॉक",
  backToMail: "मेल पर वापस जाएं",
  emailAddress: "ईमेल पता",
  displayName: "प्रदर्शन नाम",
  aliasIds: "उपनाम IDs",
  language: "भाषा",
  darkMode: "डार्क मोड",
  darkModeDesc: "लाइट / डार्क थीम बदलें",
  switchToLight: "लाइट मोड में बदलें",
  switchToDark: "डार्क मोड में बदलें",
  save: "सहेजें",
  add: "जोड़ें",
  logOut: "लॉग आउट",
  profileSettings: "प्रोफ़ाइल और सेटिंग्स",
  importantMessages: "महत्वपूर्ण",
  noImportantMessagesDesc: "त्वरित पहुंच के लिए किसी भी संदेश पर स्टार दबाएं।",
  noConversations: "अभी तक कोई बातचीत नहीं। नया संदेश लिखें।",
  noFavorites: "महत्वपूर्ण संदेश वाली कोई बातचीत नहीं।",
  noMessages: (folder) => `${folder} में कोई संदेश नहीं।`,
  filterAll: "सभी",
  filterUnread: "अपठित",
  filterAttachments: "अनुलग्नक",
  filterImportant: "महत्वपूर्ण",
  conversationView: "वार्तालाप दृश्य",
  letterView: "पत्र दृश्य",
};

// For other languages, fall back to English (partial translations can be added later)
const partial = (overrides) => ({ ...en, ...overrides });

export const STRINGS = {
  en,
  hi,
  ta: partial({ appName: "போன்மெயில்", folderHome: "இன்பாக்ஸ் & அனுப்பியவை", language: "மொழி" }),
  te: partial({ appName: "ఫోన్‌మెయిల్", folderHome: "ఇన్‌బాక్స్ & పంపినవి", language: "భాష" }),
  bn: partial({ appName: "ফোনমেইল", folderHome: "ইনবক্স ও প্রেরিত", language: "ভাষা" }),
  mr: partial({ appName: "फोनमेल", folderHome: "इनबॉक्स आणि पाठवलेले", language: "भाषा" }),
  pa: partial({ appName: "ਫ਼ੋਨਮੇਲ", folderHome: "ਇਨਬਾਕਸ ਅਤੇ ਭੇਜੇ ਗਏ", language: "ਭਾਸ਼ਾ" }),
  gu: partial({ appName: "ફોનમેઇલ", folderHome: "ઇનબૉક્સ & મોકલ્યા", language: "ભાષા" }),
};

export default STRINGS;
