// Last-resort translation straight from the browser, used only when the
// Bharat Chat server can't reach a translation provider (e.g. no outbound
// internet from the backend container). Throws if it can't translate.
const MAX_CHARS = 1200;

function chunk(text) {
  const parts = text.split(/(\n+)/);
  const out = [];
  for (const p of parts) {
    if (!p.trim() || /^\n+$/.test(p) || p.length <= MAX_CHARS) {
      out.push({ text: p, translate: !!p.trim() && !/^\n+$/.test(p) });
      continue;
    }
    let cur = "";
    for (const s of p.split(/(?<=[.!?।])\s+/)) {
      if ((cur + " " + s).length > MAX_CHARS && cur) {
        out.push({ text: cur, translate: true }, { text: " ", translate: false });
        cur = s;
      } else {
        cur = cur ? `${cur} ${s}` : s;
      }
    }
    if (cur) out.push({ text: cur, translate: true });
  }
  return out;
}

async function translateSegment(seg, tl) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t" +
    `&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(seg)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = (data?.[0] || []).map((s) => s?.[0] ?? "").join("");
  if (!text.trim()) throw new Error("empty translation");
  return text;
}

export async function translateInBrowser(text, targetLangCode) {
  const tl = (targetLangCode || "en").toLowerCase().split("-")[0];
  const pieces = chunk(text);
  const out = [];
  for (const p of pieces) out.push(p.translate ? await translateSegment(p.text, tl) : p.text);
  return out.join("").trim();
}
