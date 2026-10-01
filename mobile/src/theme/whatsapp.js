// Balanced Tricolor tokens for PhoneMail
export const colors = {
  primary: "#18181a",        // Neutral charcoal (headers)
  primaryLight: "#e6820a",   // Saffron (buttons/accents)
  accent: "#e6820a",         // Saffron action
  accentLight: "#fef3e2",
  bubbleOut: "#fef3e2",      // outgoing chat bubble (warm saffron tint)
  bubbleIn: "#ffffff",       // incoming chat bubble (clean white card)
  bubbleBorderOut: "#fce0be",// subtle border for outgoing
  bubbleBorderIn: "#dcdcdc", // subtle border for incoming
  background: "#f4f4f5",     // chat wallpaper (neutral canvas)
  bg: "#f4f4f5",
  surface: "#ffffff",
  listBackground: "#ffffff",
  divider: "#dcdcdc",
  border: "#dcdcdc",
  textPrimary: "#18181a",
  textSecondary: "#5b6068",
  unreadBadge: "#e6820a",
  danger: "#c73a32",
  dangerBg: "#fde8e7",
  success: "#178a45",
  successBg: "#eaf6ee",
  navyMark: "#22337a",
  chipActive: "#e6820a",
  chipInactive: "#f0f0f1",
  quoteBorder: "#e6820a",
  quoteBackground: "#f0f0f1",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const typography = {
  title: { fontSize: 18, fontWeight: "600", color: colors.textPrimary },
  body: { fontSize: 15, color: colors.textPrimary },
  caption: { fontSize: 12, color: colors.textSecondary },
};

export default { colors, spacing, typography };
