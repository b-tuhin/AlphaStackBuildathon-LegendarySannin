import React, { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { getAvatarInitials, getAvatarColor } from "../utils/contact.js";
import { avatarUrl } from "../api/client.js";
import { getAsset } from "../config/assets.js";

/**
 * One avatar for the whole app.
 *  - `src`      relative path from the API (e.g. "/mail/attachments/<id>") or a full URL / blob URL
 *  - `isGroup`  no picture -> a Users icon on the coloured circle (instead of a plain "G")
 *  - otherwise  no picture -> initials on the coloured circle
 */
export default function Avatar({
  src,
  name = "",
  colorKey,
  isGroup = false,
  size = 40,
  fontSize,
  style,
  title,
}) {
  const resolved = src ? (/^(https?:|blob:|data:)/.test(src) ? src : avatarUrl(src)) : null;
  // Everyone without their own picture gets a default avatar (girl/boy picked from their name until gender is known).
  let defaultUrl = null;
  if (!isGroup) {
    try {
      let h = 0;
      for (const ch of String(colorKey ?? name ?? "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      defaultUrl = getAsset(h % 2 === 0 ? "avatar-girl" : "avatar-boy").url;
    } catch (_) { defaultUrl = null; }
  }
  const sources = [resolved, defaultUrl].filter(Boolean);
  const [idx, setIdx] = useState(0);

  useEffect(() => setIdx(0), [resolved, defaultUrl]);

  const current = sources[idx];
  const showImage = Boolean(current);

  return (
    <div
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: showImage ? "transparent" : getAvatarColor(colorKey ?? name),
        color: "var(--avatar-fg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: fontSize || Math.round(size * 0.4),
        flexShrink: 0,
        overflow: "hidden",
        userSelect: "none",
        ...style,
      }}
    >
      {showImage ? (
        <img
          src={current}
          alt=""
          draggable={false}
          onError={() => setIdx((i) => i + 1)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : isGroup ? (
        <Users size={Math.round(size * 0.5)} strokeWidth={2} />
      ) : (
        getAvatarInitials(name)
      )}
    </div>
  );
}
