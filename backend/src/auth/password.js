import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export const hashPassword = (plain) => bcrypt.hashSync(plain, 10);
export const verifyPassword = (plain, hash) => !!hash && bcrypt.compareSync(plain, hash);

const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTempPassword(length = 10) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]).join("");
}

/** Normalize user input to canonical E.164. Unprefixed input defaults to India. */
export function normalizePhone(value, defaultCountry = "IN") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  return parsed?.isValid() ? parsed.number : "";
}

export function isValidPhone(phone) {
  return /^\+[1-9]\d{6,14}$/.test(String(phone || ""));
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
