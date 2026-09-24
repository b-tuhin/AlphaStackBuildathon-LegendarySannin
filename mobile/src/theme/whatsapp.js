// WhatsApp-inspired design tokens
export const colors = {
  primary: "#075E54",      // dark teal (headers)
  primaryLight: "#128C7E", // teal (buttons/accents)
  accent: "#25D366",       // green (FAB / online)
  bubbleOut: "#DCF8C6",    // outgoing chat bubble
  bubbleIn: "#FFFFFF",     // incoming chat bubble
  background: "#ECE5DD",   // chat wallpaper
  listBackground: "#FFFFFF",
  divider: "#E6E6E6",
  textPrimary: "#111B21",
  textSecondary: "#667781",
  unreadBadge: "#25D366",
  danger: "#E53935",
  chipActive: "#075E54",
  chipInactive: "#F0F2F5",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const typography = {
  title: { fontSize: 19, fontWeight: "600", color: colors.textPrimary },
  body: { fontSize: 15, color: colors.textPrimary },
  caption: { fontSize: 12, color: colors.textSecondary },
};

export default { colors, spacing, typography };
