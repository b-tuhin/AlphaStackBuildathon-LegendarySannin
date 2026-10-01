export function exactRecipientMatch(addressList, address) {
  if (!address || typeof address !== "string") return false;
  const needle = address.trim().toLowerCase();
  return String(addressList || "").split(",").some((entry) => entry.trim().toLowerCase() === needle);
}

export function normalizeRecipientAddress(address) {
  return String(address || "").trim().toLowerCase();
}
