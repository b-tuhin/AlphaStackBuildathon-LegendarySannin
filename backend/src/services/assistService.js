import https from "node:https";
import http from "node:http";

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

  // Determine recipient salutation from thread history
  let salutation = "Dear Sir/Madam,";
  if (threadMessages && threadMessages.length > 0) {
    const lastIncoming = [...threadMessages].reverse().find((m) => m.from_address);
    if (lastIncoming) {
      const namePart = (lastIncoming.from_address || "").split("@")[0].replace(/[^\w\s]/g, " ").trim();
      if (namePart && !/^\d+$/.test(namePart)) {
        const capitalized = namePart.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        salutation = `Dear ${capitalized},`;
      }
    }
  }

  // Construct body according to user intent with explicit placeholders
  let bodyParagraph = "";
  if (lowerIntent.includes("appointment") || lowerIntent.includes("book") || lowerIntent.includes("schedule")) {
    bodyParagraph =
      "I am writing to inquire about scheduling an appointment. " +
      "I would appreciate it if you could confirm your available time slots on [Insert Preferred Date, e.g. next Tuesday] or [Insert Alternative Date]. " +
      "If there are any documents or details needed prior to the meeting, please let me know.";
  } else if (lowerIntent.includes("follow up") || lowerIntent.includes("status") || lowerIntent.includes("update")) {
    bodyParagraph =
      "I hope this message finds you well. I am writing to politely follow up on our previous correspondence regarding [Insert Reference Number or Topic]. " +
      "Could you kindly provide an update on the current status at your earliest convenience?";
  } else if (lowerIntent.includes("question") || lowerIntent.includes("ask")) {
    bodyParagraph =
      `I am writing to respectfully inquire regarding ${rawIntent ? `"${rawIntent}"` : "the matter discussed"}. ` +
      "Could you please provide clarification or further details regarding [Insert Specific Question / Details]?";
  } else if (lowerIntent.includes("request") || lowerIntent.includes("need")) {
    bodyParagraph =
      `I am writing to formally request assistance with ${rawIntent ? `"${rawIntent}"` : "the matter at hand"}. ` +
      "Please advise if any reference details such as [Insert Account / Reference Number] are required to process this.";
  } else {
    // General intent expansion
    const cleanedIntent = rawIntent
      ? rawIntent.charAt(0).toUpperCase() + rawIntent.slice(1)
      : "I am writing to follow up on this matter";
    bodyParagraph =
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
    const postData = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              resolve(JSON.parse(text));
            } else {
              reject(new Error("No valid response from Gemini"));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on("error", reject);
      req.write(postData);
      req.end();
    });
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
