// Spike Mail inspired design tokens (clean, minimal, non-skeuomorphic)
export const colors = {
  primary: "#1E293B",        // Spike clean slate (headers)
  primaryLight: "#2563EB",   // Spike royal blue (buttons/accents)
  accent: "#2563EB",         // Spike action blue
  bubbleOut: "#EFF6FF",      // outgoing chat bubble (clean soft blue tint)
  bubbleIn: "#FFFFFF",       // incoming chat bubble (clean white card)
  bubbleBorderOut: "#DBEAFE",// subtle border for outgoing
  bubbleBorderIn: "#E2E8F0", // subtle border for incoming
  background: "#F8FAFC",     // chat wallpaper (clean off-white)
  listBackground: "#FFFFFF",
  divider: "#E2E8F0",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  unreadBadge: "#2563EB",
  danger: "#EF4444",
  chipActive: "#2563EB",
  chipInactive: "#F1F5F9",
  quoteBorder: "#2563EB",
  quoteBackground: "#F1F5F9",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const typography = {
  title: { fontSize: 18, fontWeight: "600", color: colors.textPrimary },
  body: { fontSize: 15, color: colors.textPrimary },
  caption: { fontSize: 12, color: colors.textSecondary },
};

export default { colors, spacing, typography };
