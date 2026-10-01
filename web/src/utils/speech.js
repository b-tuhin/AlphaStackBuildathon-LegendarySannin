// STABLE MODULE — multi-language TTS/STT engine. Supports all languages in VOICE_LANGUAGES below.
// Do NOT rewrite this file wholesale or simplify its voice-loading/queueing/fallback logic while working on unrelated bug fixes elsewhere in the app.
// If a future task touches this file, re-run the manual language check below before considering that task done.
//
// MANUAL REGRESSION CHECK:
// Pick at least 3 different languages from VOICE_LANGUAGES (e.g. English, Hindi, Tamil)
// and confirm both (a) dictation/mic input and (b) read-aloud actually produce audible,
// correctly-pronounced speech for each, before marking any task that touched
// ChatView.jsx, ComposeModal.jsx, or speech.js as complete.

export const VOICE_LANGUAGES = [
  { code: "en-IN", name: "English", label: "English" },
  { code: "hi-IN", name: "Hindi", label: "हिन्दी (Hindi)" },
  { code: "ta-IN", name: "Tamil", label: "தமிழ் (Tamil)" },
  { code: "te-IN", name: "Telugu", label: "తెలుగు (Telugu)" },
  { code: "kn-IN", name: "Kannada", label: "ಕನ್ನಡ (Kannada)" },
  { code: "ml-IN", name: "Malayalam", label: "മലയാളം (Malayalam)" },
  { code: "bn-IN", name: "Bengali", label: "বাংলা (Bengali)" },
  { code: "mr-IN", name: "Marathi", label: "मराठी (Marathi)" },
  { code: "gu-IN", name: "Gujarati", label: "ગુજરાતી (Gujarati)" },
  { code: "pa-IN", name: "Punjabi", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "ur-IN", name: "Urdu", label: "اردو (Urdu)" },
];

export const SPEECH_LANG_STORAGE_KEY = "phonemail_speech_lang";
export const READ_ALOUD_LANG_STORAGE_KEY = "phonemail_read_aloud_lang";

export function getSavedSpeechLang() {
  try {
    const saved = localStorage.getItem(SPEECH_LANG_STORAGE_KEY);
    if (saved && VOICE_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
  } catch {}
  return "en-IN";
}

export function saveSpeechLang(code) {
  try {
    localStorage.setItem(SPEECH_LANG_STORAGE_KEY, code);
  } catch {}
}

export function getSavedReadAloudLang(defaultLang = "en-IN") {
  try {
    const saved = localStorage.getItem(READ_ALOUD_LANG_STORAGE_KEY);
    if (saved && VOICE_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
  } catch {}
  return defaultLang;
}

export function saveReadAloudLang(code) {
  try {
    localStorage.setItem(READ_ALOUD_LANG_STORAGE_KEY, code);
  } catch {}
}

export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported() {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
}

let cachedVoices = [];
let voicesPromise = null;

/**
 * Asynchronously loads voices, preventing the classic race condition where
 * window.speechSynthesis.getVoices() returns an empty list on first call.
 */
export function getVoicesAsync() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve([]);
  }
  if (cachedVoices.length > 0) {
    return Promise.resolve(cachedVoices);
  }
  const immediate = window.speechSynthesis.getVoices();
  if (immediate && immediate.length > 0) {
    cachedVoices = immediate;
    return Promise.resolve(cachedVoices);
  }
  if (voicesPromise) {
    return voicesPromise;
  }
  voicesPromise = new Promise((resolve) => {
    let timer = null;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      } catch {}
    };
    const onVoicesChanged = () => {
      cleanup();
      cachedVoices = window.speechSynthesis.getVoices() || [];
      voicesPromise = null;
      resolve(cachedVoices);
    };
    try {
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
    } catch {}
    timer = setTimeout(() => {
      cleanup();
      cachedVoices = window.speechSynthesis.getVoices() || [];
      voicesPromise = null;
      resolve(cachedVoices);
    }, 1500);
  });
  return voicesPromise;
}

export function createSpeechRecognizer({ lang, onResult, onStart, onEnd, onError }) {
  if (!isSpeechRecognitionSupported()) return null;

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognizer = new SpeechRec();

  recognizer.lang = lang || getSavedSpeechLang();
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.maxAlternatives = 1;

  let lastFinalIndex = -1;

  if (onStart) {
    recognizer.onstart = (ev) => {
      lastFinalIndex = -1;
      onStart(ev);
    };
  }
  if (onEnd) recognizer.onend = onEnd;
  if (onError) recognizer.onerror = onError;

  recognizer.onresult = (event) => {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const trans = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        if (i > lastFinalIndex) {
          finalTranscript += trans + " ";
          lastFinalIndex = i;
        }
      } else {
        interimTranscript += trans;
      }
    }

    if (onResult) {
      onResult({
        finalTranscript: finalTranscript.trim(),
        interimTranscript: interimTranscript.trim(),
        rawEvent: event,
      });
    }
  };

  return recognizer;
}

/**
 * Splits text into sentence-sized chunks so long messages do not cut off partway.
 */
export function chunkTextForSpeech(text, maxChunkLen = 180) {
  if (!text) return [];
  const clean = text.trim();
  if (clean.length <= maxChunkLen) return [clean];

  // Match sentences ending in . ? ! । or newline
  const sentenceRegex = /[^.?!।\n]+[.?!।\n]+|[^.?!।\n]+$/g;
  const rawMatches = clean.match(sentenceRegex) || [clean];
  const chunks = [];
  let buffer = "";

  for (const match of rawMatches) {
    const s = match.trim();
    if (!s) continue;

    if (buffer && (buffer.length + s.length + 1) > maxChunkLen) {
      chunks.push(buffer);
      buffer = "";
    }

    if (s.length > maxChunkLen) {
      // Split long clauses by punctuation or spaces
      const parts = s.split(/([,;:\s]+)/);
      for (const part of parts) {
        if (!part) continue;
        if (buffer && (buffer.length + part.length) > maxChunkLen) {
          chunks.push(buffer.trim());
          buffer = "";
        }
        buffer += part;
      }
    } else {
      buffer = buffer ? (buffer + " " + s) : s;
    }
  }

  if (buffer && buffer.trim()) {
    chunks.push(buffer.trim());
  }

  return chunks.length > 0 ? chunks : [clean];
}

let currentPlaybackSessionId = 0;

/**
 * Stops any ongoing or queued speech synthesis immediately.
 */
export function stopSpeaking() {
  currentPlaybackSessionId++;
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * Speaks text using sentence-sized chunk queue, async voice matching,
 * cancellation race condition handling, and missing voice reporting.
 */
export async function speakText(text, langCode, { onStart, onEnd, onError, onVoiceUnavailable } = {}) {
  if (!isSpeechSynthesisSupported() || !text) return null;

  stopSpeaking();
  const sessionId = currentPlaybackSessionId;

  // Chrome cancel-then-speak race condition fix: wait 50ms after cancel
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (sessionId !== currentPlaybackSessionId) return null;

  try {
    const targetLang = langCode || getSavedSpeechLang();
    const langPrefix = targetLang.split("-")[0].toLowerCase();

    // Ensure voices are loaded
    const voices = await getVoicesAsync();
    if (sessionId !== currentPlaybackSessionId) return null;

    let matchedVoice = null;
    if (voices && voices.length) {
      matchedVoice =
        voices.find((v) => v.lang && v.lang.toLowerCase() === targetLang.toLowerCase()) ||
        voices.find((v) => v.lang && v.lang.toLowerCase().replace("_", "-") === targetLang.toLowerCase()) ||
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
    }

    if (!matchedVoice && onVoiceUnavailable) {
      try {
        onVoiceUnavailable(targetLang);
      } catch {}
    }

    const chunks = chunkTextForSpeech(text);
    if (!chunks.length) return null;

    let chunkIndex = 0;
    let hasStarted = false;

    const playNextChunk = () => {
      if (sessionId !== currentPlaybackSessionId) return;

      if (chunkIndex >= chunks.length) {
        if (onEnd) onEnd();
        return;
      }

      const chunk = chunks[chunkIndex];
      const utter = new SpeechSynthesisUtterance(chunk);
      utter.lang = targetLang;
      utter.rate = 0.95;
      if (matchedVoice) {
        utter.voice = matchedVoice;
      }

      utter.onstart = () => {
        if (sessionId !== currentPlaybackSessionId) return;
        if (!hasStarted) {
          hasStarted = true;
          if (onStart) onStart();
        }
      };

      utter.onend = () => {
        if (sessionId !== currentPlaybackSessionId) return;
        chunkIndex++;
        playNextChunk();
      };

      utter.onerror = (err) => {
        if (sessionId !== currentPlaybackSessionId) return;
        if (err && (err.error === "canceled" || err.error === "interrupted")) {
          return;
        }
        stopSpeaking();
        if (onError) onError(err);
      };

      window.speechSynthesis.speak(utter);
    };

    playNextChunk();
    return sessionId;
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

/**
 * Lightweight script-based language detector based on Unicode code points.
 * Returns language code: "hi", "mr", "ta", "te", "bn", "pa", "gu", or "en".
 * When ambiguous (Devanagari = Hindi or Marathi), defaults to preferredLang if matching,
 * else defaults to "hi".
 */
export function detectScriptLanguage(text, preferredLang = "en") {
  if (!text || typeof text !== "string") return preferredLang || "en";

  let devanagariCount = 0;
  let tamilCount = 0;
  let teluguCount = 0;
  let bengaliCount = 0;
  let gurmukhiCount = 0;
  let gujaratiCount = 0;
  let latinCount = 0;

  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp >= 0x0900 && cp <= 0x097f) devanagariCount++;
    else if (cp >= 0x0b80 && cp <= 0x0bff) tamilCount++;
    else if (cp >= 0x0c00 && cp <= 0x0c7f) teluguCount++;
    else if (cp >= 0x0980 && cp <= 0x09ff) bengaliCount++;
    else if (cp >= 0x0a00 && cp <= 0x0a7f) gurmukhiCount++;
    else if (cp >= 0x0a80 && cp <= 0x0aff) gujaratiCount++;
    else if ((cp >= 0x0041 && cp <= 0x005a) || (cp >= 0x0061 && cp <= 0x007a)) latinCount++;
  }

  const counts = [
    { lang: "devanagari", count: devanagariCount },
    { lang: "ta", count: tamilCount },
    { lang: "te", count: teluguCount },
    { lang: "bn", count: bengaliCount },
    { lang: "pa", count: gurmukhiCount },
    { lang: "gu", count: gujaratiCount },
    { lang: "en", count: latinCount },
  ];

  counts.sort((a, b) => b.count - a.count);
  const top = counts[0];
  if (!top || top.count === 0) return preferredLang || "en";

  if (top.lang === "devanagari") {
    // If preferredLang is Marathi, prefer Marathi; otherwise default to Hindi
    return preferredLang === "mr" ? "mr" : "hi";
  }

  return top.lang;
}

/**
 * Returns matching voice code for speech synthesis from a language code (e.g. "hi" -> "hi-IN").
 */
export function getVoiceLangForCode(langCode) {
  if (!langCode) return "en-IN";
  const norm = langCode.toLowerCase().split("-")[0];
  const map = {
    en: "en-IN",
    hi: "hi-IN",
    ta: "ta-IN",
    te: "te-IN",
    bn: "bn-IN",
    mr: "mr-IN",
    pa: "pa-IN",
    gu: "gu-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    ur: "ur-IN",
  };
  return map[norm] || `${norm}-IN`;
}

