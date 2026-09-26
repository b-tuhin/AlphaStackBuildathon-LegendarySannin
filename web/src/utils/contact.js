// Spike Mail styled contact & sender legibility helpers

export function formatPhoneNumber(input) {
  if (!input) return "";
  let str = String(input).trim();
  // Strip phonemail.com domain if present
  if (str.toLowerCase().endsWith("@phonemail.com")) {
    str = str.slice(0, -("@phonemail.com".length));
  }
  // If it still contains @, it's an external email
  if (str.includes("@")) {
    return str;
  }
  const digits = str.replace(/[^\d]/g, "");
  if (!digits) return str;

  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length >= 7) {
    return `+${digits.slice(0, digits.length - 4)} ${digits.slice(-4)}`;
  }
  return str;
}

export function getSenderDisplayName(item, myAddress) {
  if (!item) return "";
  if (item.is_group) {
    return item.group_name || item.counterpart_name || item.counterpart || "Group Conversation";
  }
  if (item.from_name && item.from_name.trim()) return item.from_name.trim();
  if (item.from_display && item.from_display.trim()) return item.from_display.trim();
  if (item.counterpart_name && item.counterpart_name.trim()) return item.counterpart_name.trim();
  if (item.display_name && item.display_name.trim()) return item.display_name.trim();

  const addr = item.from_address || item.counterpart || item.phone || "";
  return formatPhoneNumber(addr);
}

export function getAvatarInitials(nameOrAddress, isGroup = false) {
  if (isGroup) return "G";
  if (!nameOrAddress) return "?";
  const str = String(nameOrAddress).trim();
  if (!str) return "?";

  // If display name with words
  const words = str.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && /^[a-zA-Z]/.test(words[0]) && /^[a-zA-Z]/.test(words[1])) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  // Match first alphanumeric character
  const match = str.match(/[a-zA-Z0-9]/);
  return match ? match[0].toUpperCase() : str.charAt(0).toUpperCase();
}

const AVATAR_PALETTE = [
  "#2563EB", // Royal Blue
  "#7C3AED", // Purple
  "#059669", // Emerald
  "#D97706", // Amber
  "#DC2626", // Red
  "#0891B2", // Cyan
  "#4F46E5", // Indigo
  "#0284C7", // Sky
];

export function getAvatarColor(key) {
  if (!key) return AVATAR_PALETTE[0];
  const str = String(key);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}
