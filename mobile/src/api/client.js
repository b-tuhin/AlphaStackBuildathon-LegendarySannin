import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") return `http://${ip}:4000`;
  }
  if (Platform.OS === "android") return "http://10.0.2.2:4000";
  return "http://localhost:4000";
};
const BASE_URL = getBaseUrl();
const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });
client.interceptors.request.use(async (cfg) => {
  const token = await AsyncStorage.getItem("phonemail_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
const SECURE_REFRESH_KEY = "phonemail_refresh_token";
const phoneForApi = (value) => {
  const raw = String(value || "").trim();
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 && digits.startsWith("91") ? `+${digits}` : raw;
};
export const setToken = (token) => AsyncStorage.setItem("phonemail_token", token);
export const clearToken = () => AsyncStorage.removeItem("phonemail_token");
export const getToken = () => AsyncStorage.getItem("phonemail_token");
export const setRefreshToken = async (token) => {
  try { if (await SecureStore.isAvailableAsync()) { await SecureStore.setItemAsync(SECURE_REFRESH_KEY, token); return; } } catch {}
  return AsyncStorage.setItem(SECURE_REFRESH_KEY, token);
};
export const getRefreshToken = async () => {
  try { if (await SecureStore.isAvailableAsync()) return await SecureStore.getItemAsync(SECURE_REFRESH_KEY); } catch {}
  return AsyncStorage.getItem(SECURE_REFRESH_KEY);
};
export const clearRefreshToken = async () => {
  try { if (await SecureStore.isAvailableAsync()) await SecureStore.deleteItemAsync(SECURE_REFRESH_KEY); } catch {}
  return AsyncStorage.removeItem(SECURE_REFRESH_KEY);
};
export const startPhoneOtp = (phone, purpose = "signup") => client.post("/auth/phone/start", { phone: phoneForApi(phone), purpose });
export const checkPhoneOtp = (phone, code, purpose = "signup") => client.post("/auth/phone/check", { phone: phoneForApi(phone), code, purpose });
export const registerAccount = (phone, password, confirmPassword, tosAccepted = true, signupGrant) =>
  client.post("/auth/register", { phone: phoneForApi(phone), password, confirmPassword, tosAccepted, signupGrant });
export const login = (phone, password) => client.post("/auth/login", { phone: phoneForApi(phone), password });
export const refreshSession = (refreshToken) => client.post("/auth/refresh", { refreshToken });
export const requestPasswordReset = (phone) => client.post("/auth/password/reset-request", { phone: phoneForApi(phone) });
export const confirmPasswordReset = (phone, code, password, confirmPassword) => client.post("/auth/password/reset-confirm", { phone: phoneForApi(phone), code, password, confirmPassword });
export const setPassword = (password, confirmPassword) => client.post("/auth/password/set", { password, confirmPassword });
export const getMe = () => client.get("/users/me");
export const updateMe = (display_name) => client.patch("/users/me", { display_name });
export const lookupPhone = (phone) => client.get(`/users/lookup/${encodeURIComponent(phoneForApi(phone))}`);
export const getFamiliarRecipients = () => client.get("/users/familiar");
export const registerDevice = (platform, pushToken) => client.post("/users/me/devices", { platform, pushToken });
export const addAlias = (alias) => client.post("/users/me/aliases", { alias });
export const deleteAlias = (alias) => client.delete(`/users/me/aliases/${encodeURIComponent(alias)}`);
export const acceptTos = () => client.post("/users/me/tos");
export const getThreads = (params = {}) => client.get("/mail/threads", { params });
export const getThreadMessages = (threadId, params = {}) => client.get(`/mail/threads/${threadId}/messages`, { params });
export const sendMail = (payload) => client.post("/mail/send", payload);
export const updateEmail = (id, payload) => client.patch(`/mail/emails/${id}`, payload);
export const deleteEmail = (id) => client.delete(`/mail/emails/${id}`);
export const updateThread = (id, payload) => client.patch(`/mail/threads/${id}`, payload);
export const deleteThread = (id, params = {}) => client.delete(`/mail/threads/${id}`, { params });
export const getEmails = (params = {}) => client.get("/mail/emails", { params });
export const getImportantMessages = () => client.get("/mail/important");
export const assistDraft = (payload) => client.post("/mail/assist", payload);
export const uploadAttachment = (fileObj) => {
  const formData = new FormData();
  formData.append("file", { uri: fileObj.uri, name: fileObj.name || fileObj.filename || "file", type: fileObj.mimeType || fileObj.type || "application/octet-stream" });
  return client.post("/mail/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
};
export { BASE_URL };
export default client;
