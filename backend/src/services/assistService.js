import https from "node:https";
import http from "node:http";
import { translateFree } from "./translateService.js";

// ── Rate limiter: 15 requests per 60 seconds per user ────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;
const userRequestLog = new Map(); // userId -> number[] (timestamps)

export function checkRateLimit(userId) {
  const now = Date.now();
  const timestamps = (userRequestLog.get(userId) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    userRequestLog.set(userId, timestamps);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000),
    };
  }

  timestamps.push(now);
  userRequestLog.set(userId, timestamps);
  return { allowed: true };
}

// ── Subject cache: reuses subject for near-identical intents in same thread ──
const SUBJECT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const subjectCache = new Map(); // key -> { subject: string, timestamp: number }

function normalizeIntent(intent = "") {
  return intent
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function getCachedSubject(threadId, intent) {
  const norm = normalizeIntent(intent);
  if (!norm) return null;
  const key = `${threadId || "new"}:${norm}`;
  const cached = subjectCache.get(key);
  if (cached && Date.now() - cached.timestamp < SUBJECT_CACHE_TTL_MS) {
    return cached.subject;
  }
  return null;
}

export function setCachedSubject(threadId, intent, subject) {
  const norm = normalizeIntent(intent);
  if (!norm || !subject) return;
  const key = `${threadId || "new"}:${norm}`;
  subjectCache.set(key, { subject, timestamp: Date.now() });
}

// ── Fallback Template Generator (when no external LLM API key is present) ────
function generateFallbackDraft({ intent, threadMessages, isNewMessage, currentSubject, senderName }) {
  const rawIntent = (intent || "").trim();
  const lowerIntent = rawIntent.toLowerCase();

  // Determine subject
  let subject = currentSubject || "";
  if (isNewMessage || !subject) {
    if (lowerIntent.includes("appointment") || lowerIntent.includes("book") || lowerIntent.includes("schedule")) {
      subject = "Appointment Request / Scheduling Inquiry";
    } else if (lowerIntent.includes("follow") || lowerIntent.includes("status") || lowerIntent.includes("update")) {
      subject = "Follow-up Regarding Status";
    } else if (lowerIntent.includes("question") || lowerIntent.includes("ask") || lowerIntent.includes("inquir")) {
      subject = "Inquiry Regarding Recent Correspondence";
    } else if (lowerIntent.includes("request") || lowerIntent.includes("help") || lowerIntent.includes("need")) {
      subject = "Request for Assistance / Information";
    } else {
      const words = rawIntent.split(/\s+/).slice(0, 6).join(" ");
      subject = words ? words.charAt(0).toUpperCase() + words.slice(1) : "Correspondence Inquiry";
    }
  } else if (!subject.toLowerCase().startsWith("re:")) {
    subject = `Re: ${subject}`;
  }

  // Determine recipient salutation and extract reference context from thread history
  let salutation = "Dear Sir/Madam,";
  let referencedContext = "";
  if (threadMessages && threadMessages.length > 0) {
    const lastIncoming = [...threadMessages].reverse().find((m) => m.from_address);
    if (lastIncoming) {
      const namePart = (lastIncoming.from_address || "").split("@")[0].replace(/[^\w\s]/g, " ").trim();
      if (namePart && !/^\d+$/.test(namePart)) {
        const capitalized = namePart.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        salutation = `Dear ${capitalized},`;
      }

      // Extract subject and/or first ~15 words of body_text
      const cleanSub = (lastIncoming.subject || "").replace(/^re:\s*/i, "").trim().replace(/"/g, "'");
      const hasSub = cleanSub && cleanSub.toLowerCase() !== "(no subject)";

      let snippet = "";
      if (lastIncoming.body_text && lastIncoming.body_text.trim()) {
        const words = lastIncoming.body_text.trim().split(/\s+/);
        snippet = words.slice(0, 15).join(" ").replace(/"/g, "'");
        if (words.length > 15) snippet += "…";
      }

      if (hasSub && snippet) {
        referencedContext = `"${cleanSub}" ("${snippet}")`;
      } else if (hasSub) {
        referencedContext = `"${cleanSub}"`;
      } else if (snippet) {
        referencedContext = `"${snippet}"`;
      }
    }
  }

  // Construct body according to user intent with explicit placeholders
  let bodyParagraph = "";
  if (lowerIntent.includes("appointment") || lowerIntent.includes("book") || lowerIntent.includes("schedule")) {
    bodyParagraph =
      (referencedContext
        ? `Regarding your message about ${referencedContext}, I am writing to inquire about scheduling an appointment. `
        : "I am writing to inquire about scheduling an appointment. ") +
      "I would appreciate it if you could confirm your available time slots on [Insert Preferred Date, e.g. next Tuesday] or [Insert Alternative Date]. " +
      "If there are any documents or details needed prior to the meeting, please let me know.";
  } else if (lowerIntent.includes("follow up") || lowerIntent.includes("status") || lowerIntent.includes("update")) {
    bodyParagraph =
      "I hope this message finds you well. " +
      (referencedContext
        ? `Regarding your message about ${referencedContext}, I am writing to politely follow up on the status regarding [Insert Reference Number or Topic]. `
        : "I am writing to politely follow up on our previous correspondence regarding [Insert Reference Number or Topic]. ") +
      "Could you kindly provide an update on the current status at your earliest convenience?";
  } else if (lowerIntent.includes("question") || lowerIntent.includes("ask")) {
    bodyParagraph =
      (referencedContext ? `Regarding your message about ${referencedContext}, ` : "") +
      `I am writing to respectfully inquire regarding ${rawIntent ? `"${rawIntent}"` : "the matter discussed"}. ` +
      "Could you please provide clarification or further details regarding [Insert Specific Question / Details]?";
  } else if (lowerIntent.includes("request") || lowerIntent.includes("need")) {
    bodyParagraph =
      (referencedContext ? `Regarding your message about ${referencedContext}, ` : "") +
      `I am writing to formally request assistance with ${rawIntent ? `"${rawIntent}"` : "the matter at hand"}. ` +
      "Please advise if any reference details such as [Insert Account / Reference Number] are required to process this.";
  } else {
    // General intent expansion
    const cleanedIntent = rawIntent
      ? rawIntent.charAt(0).toUpperCase() + rawIntent.slice(1)
      : "I am writing to follow up on this matter";
    bodyParagraph =
      (referencedContext ? `Regarding your message about ${referencedContext}, ` : "") +
      `I am writing regarding the following: ${cleanedIntent}. ` +
      "Kindly let me know if you require any additional information from my side (such as [Insert Date / Reference Number if applicable]).";
  }

  const signOff = `Thank you for your time and assistance.\n\nSincerely,\n${senderName || "[Your Name]"}`;

  const body = `${salutation}\n\n${bodyParagraph}\n\n${signOff}`;

  return { subject, body };
}

// ── External LLM Call (Gemini or OpenAI) ────────────────────────────────────
async function callLLMApi({ prompt, systemInstruction }) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean);
    const postData = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const callModel = (model) =>
      new Promise((resolve, reject) => {
        const req = https.request(
          {
            hostname: "generativelanguage.googleapis.com",
            path: `/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(postData),
            },
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const jsonMatch = text.match(/\{[\s\S]*\}/);
                  resolve(JSON.parse(jsonMatch ? jsonMatch[0] : text));
                } else {
                  reject(new Error(`No valid response from Gemini (${model}): ${parsed?.error?.message || res.statusCode}`));
                }
              } catch (e) {
                reject(e);
              }
            });
          }
        );
        req.setTimeout(12000, () => req.destroy(new Error(`Gemini ${model} timed out`)));
        req.on("error", reject);
        req.write(postData);
        req.end();
      });

    // Older model names get retired; try the next one instead of failing outright.
    let lastErr = null;
    for (const model of models) {
      try {
        return await callModel(model);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Gemini call failed");
  }

  if (openAiKey) {
    const postData = JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const options = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const content = parsed?.choices?.[0]?.message?.content;
            if (content) {
              resolve(JSON.parse(content));
            } else {
              reject(new Error("No valid response from OpenAI"));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.setTimeout(12000, () => req.destroy(new Error("OpenAI request timed out")));
      req.on("error", reject);
      req.write(postData);
      req.end();
    });
  }

  return null;
}

// ── Main Service Method ─────────────────────────────────────────────────────
export async function generateAssistedDraft({
  userId,
  threadId,
  intent,
  isNewMessage,
  currentSubject,
  senderName,
  threadMessages = [],
}) {
  // 1. Check rate limit
  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    const err = new Error("Rate limit reached. Please wait before requesting another AI draft.");
    err.status = 429;
    err.retryAfter = rateLimit.retryAfterSeconds;
    throw err;
  }

  // 2. Check subject cache for near-identical repeated intents in thread
  const cachedSubject = getCachedSubject(threadId, intent);

  // 3. Prepare formatted thread context (last ~10 messages)
  const formattedThread = threadMessages
    .slice(-10)
    .map((m, idx) => `[Message ${idx + 1}] From: ${m.from_address} | Date: ${m.created_at || "N/A"}\nSubject: ${m.subject || "(no subject)"}\nBody:\n${m.body_text || ""}`)
    .join("\n\n---\n\n");

  const systemInstruction = `You are an expert email drafting assistant. Your job is to help users—especially people unfamiliar with formal correspondence—draft polite, clear, and appropriately formal emails.

CRITICAL RULES:
1. TONE: Keep the tone formal, polite, and neutral by default (appropriate for writing to an official, institution, business, or service provider), unless the thread context is clearly informal between close friends.
2. SUBJECT LINE: If isNewMessage is true or no subject is given, generate a concise, professional subject line (under 8 words). If replying in an existing thread, retain or adapt the thread subject (e.g. "Re: ...").
3. NEVER FABRICATE FACTS: Do NOT invent specific dates, times, reference numbers, account IDs, locations, or names not present in the thread or user intent.
4. PLACEHOLDERS: If specific missing details are required to complete the request, use clear placeholders in square brackets like [Insert Date], [Insert Time], [Insert Reference Number] and prompt the user to fill them in.
5. NEVER AUTO-SEND: The output is an editable draft for the user to review.
6. FORMAT: You MUST return ONLY a JSON object:
{
  "subject": "Concise Subject",
  "body": "Formal email body text with placeholders where details are needed."
}`;

  const prompt = `THREAD CONTEXT (last messages):
${formattedThread || "(No prior messages - new correspondence)"}

USER'S ROUGH INTENT:
"${intent || "Follow up on recent matter"}"

IS NEW MESSAGE: ${isNewMessage ? "true" : "false"}
CURRENT SUBJECT: ${currentSubject || cachedSubject || "(None)"}

Generate the assisted draft JSON:`;

  // 4. Attempt external LLM if configured
  try {
    const llmResult = await callLLMApi({ prompt, systemInstruction });
    if (llmResult && llmResult.body) {
      const finalSubject = cachedSubject || llmResult.subject || currentSubject || "Inquiry";
      setCachedSubject(threadId, intent, finalSubject);
      return {
        subject: finalSubject,
        body: llmResult.body,
        cached: !!cachedSubject,
      };
    }
  } catch (err) {
    console.warn("[assistService] LLM API call failed or not configured, using fallback generator:", err.message);
  }

  // 5. Use smart fallback generator
  const fallback = generateFallbackDraft({
    intent,
    threadMessages,
    isNewMessage,
    currentSubject: cachedSubject || currentSubject,
    senderName,
  });

  setCachedSubject(threadId, intent, fallback.subject);

  return {
    subject: fallback.subject,
    body: fallback.body,
    cached: !!cachedSubject,
  };
}

// ── Translation Service ─────────────────────────────────────────────────────
const LANG_MAP = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  mr: "Marathi",
  pa: "Punjabi",
  gu: "Gujarati",
};

const COMMON_TRANSLATIONS = {
  "hello": {
    en: "Hello",
    hi: "नमस्ते",
    ta: "வணக்கம்",
    te: "నమస్కారం",
    bn: "নমস্কার",
    mr: "नमस्कार",
    pa: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ",
    gu: "નમસ્તે",
  },
  "hi": {
    en: "Hi",
    hi: "नमस्ते",
    ta: "வணக்கம்",
    te: "నమస్కారం",
    bn: "নমস্কার",
    mr: "नमस्कार",
    pa: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ",
    gu: "નમસ્તે",
  },
  "hey": {
    en: "Hey",
    hi: "नमस्ते",
    ta: "வணக்கம்",
    te: "నమస్కారం",
    bn: "নমস্কার",
    mr: "नमस्कार",
    pa: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ",
    gu: "નમસ્તે",
  },
  "how are you": {
    en: "How are you?",
    hi: "आप कैसे हैं?",
    ta: "நீங்கள் எப்படி இருக்கிறீர்கள்?",
    te: "మీరు ఎలా ఉన్నారు?",
    bn: "আপনি কেমন আছেন?",
    mr: "तुम्ही कसे आहात?",
    pa: "ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?",
    gu: "તમે કેમ છો?",
  },
  "how are you?": {
    en: "How are you?",
    hi: "आप कैसे हैं?",
    ta: "நீங்கள் எப்படி இருக்கிறீர்கள்?",
    te: "మీరు ఎలా ఉన్నారు?",
    bn: "আপনি কেমন আছেন?",
    mr: "तुम्ही कसे आहात?",
    pa: "ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?",
    gu: "તમે કેમ છો?",
  },
  "good morning": {
    en: "Good morning",
    hi: "शुभ प्रभात",
    ta: "காலை வணக்கம்",
    te: "శుభోదయం",
    bn: "শুভ সকাল",
    mr: "शुभ प्रभात",
    pa: "ਸ਼ੁਭ ਸਵੇਰ",
    gu: "સુપ્રભાત",
  },
  "thank you": {
    en: "Thank you",
    hi: "धन्यवाद",
    ta: "நன்றி",
    te: "ధన్యవాదాలు",
    bn: "ধন্যবাদ",
    mr: "धन्यवाद",
    pa: "ਧੰਨਵਾਦ",
    gu: "આભાર",
  },
  "thanks": {
    en: "Thanks",
    hi: "धन्यवाद",
    ta: "நன்றி",
    te: "ధన్యవాదాలు",
    bn: "ধন্যবাদ",
    mr: "धन्यवाद",
    pa: "ਧੰਨਵਾਦ",
    gu: "આભાર",
  },
  "welcome to phonemail": {
    en: "Welcome to PhoneMail",
    hi: "फ़ोनमेल में आपका स्वागत है",
    ta: "போன்மெயிலுக்கு நல்வரவு",
    te: "ఫోన్‌మెయిల్‌కు స్వాగతం",
    bn: "ফোনমেইলে স্বাগতম",
    mr: "फोनमेलमध्ये आपले स्वागत आहे",
    pa: "ਫ਼ੋਨਮੇਲ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ",
    gu: "ફોનમેઇલમાં આપનું સ્વાગત છે",
  },
  "meeting at 4pm": {
    en: "Meeting at 4 PM",
    hi: "शाम 4 बजे बैठक",
    ta: "மாலை 4 மணிக்கு சந்திப்பு",
    te: "సాయంత్రం 4 గంటలకు సమావేశం",
    bn: "বিকেল ৪টায় মিটিং",
    mr: "संध्याकाळी ४ वाजता बैठक",
    pa: "ਸ਼ਾਮ 4 ਵਜੇ ਮੀਟਿੰਗ",
    gu: "સાંજે 4 વાગ્યે મીટિંગ",
  },
};

const NATIVE_PREFIXES = {
  ta: "வணக்கம், செய்தி: ",
  te: "నమస్కారం, సందేశం: ",
  bn: "নমস্কার, বার্তা: ",
  hi: "नमस्ते, संदेश: ",
  mr: "नमस्कार, संदेश: ",
  pa: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, ਸੁਨੇਹਾ: ",
  gu: "નમસ્તે, સંદેશ: ",
  en: "Hello, message: ",
};

export async function translateMessageText({ text, targetLangCode = "en" }) {
  const normCode = (targetLangCode || "en").toLowerCase().split("-")[0];
  const targetLangName = LANG_MAP[normCode] || targetLangCode;

  // 1. Tiny built-in dictionary for very common short phrases.
  const normalizedKey = text.toLowerCase().replace(/[^\w\s]/g, "").trim();
  if (COMMON_TRANSLATIONS[normalizedKey]?.[normCode]) {
    return { translatedText: COMMON_TRANSLATIONS[normalizedKey][normCode], targetLangCode: normCode };
  }

  // 2. If an LLM key is configured, it gives the most natural result.
  if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) {
    const systemInstruction = `You are a professional language translator.
Translate the user message accurately, naturally, and fluently into ${targetLangName}.
CRITICAL RULES:
1. Retain the exact tone, meaning, line breaks and intent of the original text.
2. Keep names, email addresses, phone numbers, and URLs intact.
3. You MUST respond ONLY with a valid JSON object in this format:
{
  "translatedText": "translated text here"
}`;
    const prompt = `Translate this message into ${targetLangName}:\n"""\n${text}\n"""\n\nReturn JSON:`;
    try {
      const llmResult = await callLLMApi({ prompt, systemInstruction });
      const translated = llmResult?.translatedText || llmResult?.text || llmResult?.translation;
      if (translated && typeof translated === "string" && translated.trim()) {
        return { translatedText: translated.trim(), targetLangCode: normCode };
      }
    } catch (err) {
      console.warn("[translate] LLM call failed, using free providers:", err.message);
    }
  }

  // 3. Free providers (no key needed). Throws TRANSLATION_UNAVAILABLE if all fail.
  const free = await translateFree(text, normCode);
  return { translatedText: free.translatedText, unchanged: !!free.unchanged, targetLangCode: normCode };
}
