// Server timestamps look like "2026-10-01 02:06:06" (UTC, no "Z").
// Browsers read that as LOCAL time, so we mark it as UTC before parsing.
export function parseServerDate(v) {
  if (!v) return new Date(NaN);
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) {
    return new Date(s.replace(" ", "T") + "Z");
  }
  return new Date(s);
}