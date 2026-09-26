import crypto from "node:crypto";
import bcrypt from "bcryptjs";

export const hashPassword = (plain) => bcrypt.hashSync(plain, 10);
export const verifyPassword = (plain, hash) => !!hash && bcrypt.compareSync(plain, hash);

const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTempPassword(length = 10) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]).join("");
}

export function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

export function isValidPhone(phone) {
  return /^\d{7,15}$/.test(phone);
}

export function assertPassword(password, confirmPassword) {
  if (!password || String(password).length < 8) {
    return "Password must be at least 8 characters";
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return "Passwords do not match";
  }
  return null;
}
