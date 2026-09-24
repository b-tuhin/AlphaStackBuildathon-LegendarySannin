import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// EXPO_PUBLIC_API_URL is injected via docker-compose / app config for LAN access;
// falls back to localhost for a simulator running alongside the backend.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });

client.interceptors.request.use(async (cfg) => {
  const token = await AsyncStorage.getItem("phonemail_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const setToken = (token) => AsyncStorage.setItem("phonemail_token", token);
export const clearToken = () => AsyncStorage.removeItem("phonemail_token");
export const getToken = () => AsyncStorage.getItem("phonemail_token");

// ── Auth ──────────────────────────────
export const requestOtp = (phone) => client.post("/auth/otp/request", { phone });
export const verifyOtp = (phone, code) => client.post("/auth/otp/verify", { phone, code });
export const passwordLogin = (phone, password) => client.post("/auth/password/login", { phone, password });
export const setPassword = (password) => client.post("/auth/password/set", { password });

// ── User ──────────────────────────────
export const getMe = () => client.get("/users/me");
export const updateMe = (display_name) => client.patch("/users/me", { display_name });
export const lookupPhone = (phone) => client.get(`/users/lookup/${phone}`);
export const registerDevice = (platform, pushToken) => client.post("/users/me/devices", { platform, pushToken });
export const addAlias = (alias) => client.post("/users/me/aliases", { alias });

// ── Mail (chat-style) ────────────────
export const getThreads = (params = {}) => client.get("/mail/threads", { params });
export const getThreadMessages = (threadId) => client.get(`/mail/threads/${threadId}/messages`);
export const sendMail = (payload) => client.post("/mail/send", payload);
export const updateEmail = (id, payload) => client.patch(`/mail/emails/${id}`, payload);
export const getEmails = (params = {}) => client.get("/mail/emails", { params });

export default client;
