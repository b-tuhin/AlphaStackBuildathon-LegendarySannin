import React from "react";

/**
 * Splits text by query and wraps matches in <mark> elements.
 * Styled via CSS tokens: --mark-bg and --mark-fg.
 */
export function highlightText(text, query) {
  if (!text || typeof text !== "string" || !query || typeof query !== "string") return text;
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={i}>{part}</mark>
    ) : (
      part
    )
  );
}
