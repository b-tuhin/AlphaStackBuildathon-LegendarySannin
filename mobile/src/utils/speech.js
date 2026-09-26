import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { Alert, Platform } from "react-native";

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

export async function getSavedVoiceLang() {
  try {
    const saved = await AsyncStorage.getItem(SPEECH_LANG_STORAGE_KEY);
    if (saved && VOICE_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
  } catch {}
  return "en-IN";
}

export async function saveVoiceLang(langCode) {
  try {
    await AsyncStorage.setItem(SPEECH_LANG_STORAGE_KEY, langCode);
  } catch {}
}

export async function checkVoiceAvailability(langCode) {
  try {
    if (typeof Speech.getAvailableVoicesAsync === "function") {
      const voices = await Speech.getAvailableVoicesAsync();
      if (Array.isArray(voices) && voices.length > 0) {
        const target = (langCode || "en-IN").toLowerCase().replace("_", "-");
        const targetBase = target.split("-")[0];
        const match = voices.some((v) => {
          const vLang = (v.language || "").toLowerCase().replace("_", "-");
          return vLang === target || vLang.startsWith(`${targetBase}-`) || vLang === targetBase;
        });
        return match;
      }
    }
  } catch (err) {
    console.warn("[speech] checkVoiceAvailability error:", err);
  }
  return true;
}

// ── Text to Speech (TTS) ────────────────────────────────────────────────────
export async function speakText(text, langCode, { onDone, onError, onStopped } = {}) {
  if (!text) return;
  const targetCode = langCode || "en-IN";
  try {
    const isAvailable = await checkVoiceAvailability(targetCode);
    if (!isAvailable) {
      const langObj = VOICE_LANGUAGES.find((l) => l.code === targetCode);
      const langName = langObj ? langObj.name : targetCode;
      Alert.alert(
        "Voice Not Available",
        `This language's voice isn't installed on this device. Enable it in your phone's Text-to-Speech settings, or pick another language.`
      );
      if (onError) {
        onError({
          code: "VOICE_NOT_INSTALLED",
          message: `Voice for ${langName} not installed on this device.`,
        });
      }
      return;
    }

    await Speech.stop();
    Speech.speak(text, {
      language: targetCode,
      rate: 0.95,
      onDone,
      onError: (err) => {
        if (onError) onError(err);
      },
      onStopped,
    });
  } catch (err) {
    if (onError) onError(err);
  }
}

export async function stopSpeaking() {
  try {
    await Speech.stop();
  } catch {}
}

// ── Speech to Text (STT) ────────────────────────────────────────────────────
let NativeSpeechModule = null;
try {
  const mod = require("expo-speech-recognition");
  NativeSpeechModule = mod.ExpoSpeechRecognitionModule || null;
} catch {}

export async function startVoiceRecognition({
  lang,
  onStart,
  onEnd,
  onError,
  onResult,
}) {
  const targetLang = lang || (await getSavedVoiceLang());

  // 1. Try native module if linked
  if (NativeSpeechModule && typeof NativeSpeechModule.start === "function") {
    try {
      if (typeof NativeSpeechModule.requestPermissionsAsync === "function") {
        const perm = await NativeSpeechModule.requestPermissionsAsync();
        if (perm && !perm.granted) {
          Alert.alert("Permission Required", "Microphone access is needed for voice-to-text.");
          if (onError) onError({ error: "permission_denied" });
          return null;
        }
      }

      const subscriptions = [];
      if (onStart) subscriptions.push(NativeSpeechModule.addListener("start", onStart));
      if (onEnd) subscriptions.push(NativeSpeechModule.addListener("end", onEnd));
      if (onError) subscriptions.push(NativeSpeechModule.addListener("error", onError));
      if (onResult) {
        subscriptions.push(
          NativeSpeechModule.addListener("result", (event) => {
            const transcript =
              event.results?.[0]?.transcript ||
              event.results?.[event.results.length - 1]?.transcript ||
              "";
            const isFinal = Boolean(event.isFinal);
            onResult({
              transcript,
              isFinal,
              finalTranscript: isFinal ? transcript : "",
              interimTranscript: isFinal ? "" : transcript,
            });
          })
        );
      }

      NativeSpeechModule.start({
        lang: targetLang,
        interimResults: true,
        continuous: true,
      });

      return {
        stop: () => {
          try {
            NativeSpeechModule.stop();
            subscriptions.forEach((s) => s?.remove?.());
          } catch {}
        },
      };
    } catch (err) {
      if (onError) onError(err);
    }
  }

  // 2. Try Web Speech API (if running in browser/web view)
  if (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
    try {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognizer = new SpeechRec();
      recognizer.lang = targetLang;
      recognizer.continuous = true;
      recognizer.interimResults = true;

      let lastFinalIndex = -1;

      if (onStart) {
        recognizer.onstart = (ev) => {
          lastFinalIndex = -1;
          onStart(ev);
        };
      }
      if (onEnd) recognizer.onend = onEnd;
      if (onError) recognizer.onerror = onError;
      if (onResult) {
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
          finalTranscript = finalTranscript.trim();
          interimTranscript = interimTranscript.trim();
          const transcript = (finalTranscript + " " + interimTranscript).trim();
          const isFinal = Boolean(finalTranscript);
          onResult({
            transcript,
            isFinal,
            finalTranscript,
            interimTranscript,
          });
        };
      }

      recognizer.start();
      return {
        stop: () => {
          try {
            recognizer.stop();
          } catch {}
        },
      };
    } catch (err) {
      if (onError) onError(err);
      return null;
    }
  }

  // 3. Graceful fallback notice
  Alert.alert(
    "Voice-to-Text",
    "Speech recognition is active. On mobile devices without custom dev clients, please use the microphone key on your device keyboard, or launch via Chrome/Safari on web."
  );
  if (onError) onError({ error: "not_supported" });
  return null;
}
