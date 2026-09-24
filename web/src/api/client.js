import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("phonemail_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export const setToken = (t) => localStorage.setItem("phonemail_token", t);
export const clearToken = () => localStorage.removeItem("phonemail_token");
export const getToken = () => localStorage.getItem("phonemail_token");

export const requestOtp = (phone) => client.post("/auth/otp/request", { phone });
export const verifyOtp = (phone, code) => client.post("/auth/otp/verify", { phone, code });

export const getMe = () => client.get("/users/me");
export const updateMe = (display_name) => client.patch("/users/me", { display_name });
export const addAlias = (alias) => client.post("/users/me/aliases", { alias });

export const getEmails = (params = {}) => client.get("/mail/emails", { params });
export const sendMail = (payload) => client.post("/mail/send", payload);
export const updateEmail = (id, payload) => client.patch(`/mail/emails/${id}`, payload);

export default client;
