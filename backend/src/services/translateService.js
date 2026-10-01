// STABLE MODULE — message translation without needing any paid API key.
// Providers are tried in order (Google web endpoint -> MyMemory). Long messages
// are split into chunks so nothing gets cut off, and newlines are preserved.
// Never silently echo the original text back as if it were a translation:
// callers get either a real translation, { unchanged: true }, or a thrown error.
import https from "node:https";

const SCRIPTS = [
  { code: "devanagari", re: /[\u0900-\u097F]/g },
  { code: "ta", re: /[\u0B80-\u0BFF]/g },
  { code: "te", re: /[\u0C00-\u0C7F]/g },
  { code: "bn", re: /[\u0980-\u09FF]/g },
  { code: "pa", re: /[\u0A00-\u0A7F]/g },
  { code: "gu", re: /[\u0A80-\u0AFF]/g },
  { code: "en", re: /[A-Za-z]/g },
];

/** Rough script-based source-language guess. Devanagari maps to "hi". */
export function guessSourceLang(text) {
  let best = { code: "en", n: 0 };
  for (const s of SCRIPTS) {
    const n = (text.match(s.re) || []).length;
    if (n > best.n) best = { code: s.code, n };
  }
  return best.code === "devanagari" ? "hi" : best.code;
}

function httpRequest(urlString, { method = "GET", body = null, headers = {}, timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, v) => {
      if (!settled) {
        settled = true;
        fn(v);
      }
    };
    try {
      const url = new URL(urlString);
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method,
          headers: { "User-Agent": "Mozilla/5.0 PhoneMail", ...headers },
        },
        (res) => {
          let data = "";
          res.setEncoding("utf8");
          res.on("data", (c) => (data += c));
          res.on("end", () => done(resolve, { status: res.statusCode, body: data }));
        }
      );
      req.setTimeout(timeout, () => req.destroy(new Error(`timeout after ${timeout}ms`)));
      req.on("error", (e) => done(reject, e));
      if (body) req.write(body);
      req.end();
    } catch (e) {
      done(reject, e);
    }
  });
}

/**
 * Split text into translatable pieces. Newline runs are kept as separators so
 * paragraph layout survives. Text pieces longer than `max` (per `measure`) are
 * packed sentence-by-sentence, hard-splitting only as a last resort.
 */
export function splitForTranslation(text, max, measure = (s) => s.length) {
  const tokens = text.split(/(\n+)/);
  const out = [];
  for (const tok of tokens) {
    if (!tok || /^\n+$/.test(tok) || !tok.trim() || measure(tok) <= max) {
      out.push({ text: tok, translate: !!tok.trim() && !/^\n+$/.test(tok) });
      continue;
    }
    const sentences = tok.split(/(?<=[.!?।])\s+/);
    let cur = "";
    const flush = () => {
      if (cur) {
        out.push({ text: cur, translate: true });
        cur = "";
      }
    };
    for (const s of sentences) {
      if (measure(s) > max) {
        // One very long sentence: pack whole words, hard-split only a giant word.
        flush();
        let piece = "";
        for (const word of s.split(/\s+/)) {
          const cand = piece ? `${piece} ${word}` : word;
          if (measure(cand) <= max) {
            piece = cand;
            continue;
          }
          if (piece) out.push({ text: piece, translate: true });
          piece = "";
          if (measure(word) <= max) {
            piece = word;
          } else {
            let frag = "";
            for (const ch of word) {
              if (measure(frag + ch) > max) {
                out.push({ text: frag, translate: true });
                frag = "";
              }
              frag += ch;
            }
            piece = frag;
          }
        }
        if (piece) cur = piece;
        continue;
      }
      const joined = cur ? `${cur} ${s}` : s;
      if (measure(joined) > max) {
        flush();
        cur = s;
      } else {
        cur = joined;
      }
    }
    flush();
    // Re-insert a space between packed sentence chunks of the same paragraph.
    for (let i = out.length - 1; i > 0; i--) {
      const a = out[i - 1];
      const b = out[i];
      if (a.translate && b.translate) out.splice(i, 0, { text: " ", translate: false });
    }
  }
  return out;
}

async function googleSegment(seg, tl) {
  const base = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t`;
  const q = encodeURIComponent(seg);
  const useGet = base.length + q.length < 1800;
  const res = useGet
    ? await httpRequest(`${base}&q=${q}`)
    : await httpRequest(base, {
        method: "POST",
        body: `q=${q}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(`q=${q}`),
        },
      });
  if (res.status !== 200) throw new Error(`google HTTP ${res.status}`);
  const parsed = JSON.parse(res.body);
  const text = (parsed?.[0] || []).map((s) => s?.[0] ?? "").join("");
  if (!text.trim()) throw new Error("google returned empty translation");
  return { text, detected: typeof parsed?.[2] === "string" ? parsed[2] : null };
}

async function myMemorySegment(seg, tl, sl) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(seg)}&langpair=${encodeURIComponent(`${sl}|${tl}`)}`;
  const res = await httpRequest(url);
  if (res.status !== 200) throw new Error(`mymemory HTTP ${res.status}`);
  const parsed = JSON.parse(res.body);
  const text = parsed?.responseData?.translatedText;
  if (Number(parsed?.responseStatus) !== 200 || !text || !text.trim()) {
    throw new Error(`mymemory status ${parsed?.responseStatus}`);
  }
  if (/QUERY LENGTH LIMIT|INVALID|MYMEMORY WARNING/i.test(text)) throw new Error("mymemory refused query");
  return { text, detected: sl };
}

async function runProvider(pieces, translateSeg) {
  const results = new Array(pieces.length);
  const jobs = pieces.map((p, i) => ({ p, i })).filter((j) => j.p.translate);
  let detected = null;
  // Small batches keep us polite to the free endpoints.
  for (let b = 0; b < jobs.length; b += 4) {
    await Promise.all(
      jobs.slice(b, b + 4).map(async ({ p, i }) => {
        const r = await translateSeg(p.text);
        results[i] = r.text;
        if (!detected && r.detected) detected = r.detected;
      })
    );
  }
  const joined = pieces.map((p, i) => (p.translate ? results[i] : p.text)).join("");
  return { text: joined, detected };
}

/**
 * Translate `text` into language code `tl` with free providers.
 * Resolves { translatedText, unchanged?, provider } or throws an Error with
 * code "TRANSLATION_UNAVAILABLE" (details in err.details).
 */
export async function translateFree(text, tl) {
  const target = (tl || "en").toLowerCase().split("-")[0];
  const guessed = guessSourceLang(text);
  // Unambiguous same-language short-circuit (Devanagari is ambiguous: hi vs mr).
  if (guessed === target && guessed !== "hi") {
    return { translatedText: text, unchanged: true, provider: "none" };
  }

  const providers = [
    {
      name: "google",
      run: () =>
        runProvider(splitForTranslation(text, 900), (s) => googleSegment(s, target)),
    },
    {
      name: "mymemory",
      run: () =>
        runProvider(
          splitForTranslation(text, 420, (s) => Buffer.byteLength(s, "utf8")),
          (s) => myMemorySegment(s, target, guessed)
        ),
    },
  ];

  const details = [];
  let sawUnchanged = false;
  for (const prov of providers) {
    try {
      const { text: out, detected } = await prov.run();
      const sameAsInput = out.trim().toLowerCase() === text.trim().toLowerCase();
      if (detected && detected.toLowerCase().split("-")[0] === target) {
        return { translatedText: text, unchanged: true, provider: prov.name };
      }
      if (!sameAsInput) return { translatedText: out.trim(), provider: prov.name };
      sawUnchanged = true;
    } catch (err) {
      details.push(`${prov.name}: ${err.message}`);
      console.warn(`[translate] provider ${prov.name} failed: ${err.message}`);
    }
  }
  if (sawUnchanged) return { translatedText: text, unchanged: true, provider: "none" };

  const error = new Error("Translation service is currently unreachable");
  error.code = "TRANSLATION_UNAVAILABLE";
  error.details = details;
  throw error;
}
