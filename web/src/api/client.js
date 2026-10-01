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

export const registerAccount = (phone, password, confirmPassword, tosAccepted = true, signupGrant) =>
  client.post("/auth/register", { phone, password, confirmPassword, tosAccepted, signupGrant });
export const login = (phone, password) => client.post("/auth/login", { phone, password });
export const requestPasswordReset = (phone) => client.post("/auth/password/reset-request", { phone });
export const confirmPasswordReset = (phone, code, password, confirmPassword) =>
  client.post("/auth/password/reset-confirm", { phone, code, password, confirmPassword });
export const setPassword = (password, confirmPassword) =>
  client.post("/auth/password/set", { password, confirmPassword });

export const getMe = () => client.get("/users/me");
export const updateMe = (display_name) => client.patch("/users/me", { display_name });
export const updateMyAvatar = (avatar_id) => client.patch("/users/me", { avatar_id });
export const addAlias = (alias) => client.post("/users/me/aliases", { alias });
export const deleteAlias = (alias) => client.delete(`/users/me/aliases/${encodeURIComponent(alias)}`);
export const acceptTos = () => client.post("/users/me/tos");
export const lookupPhone = (phone) => client.get(`/users/lookup/${phone}`);
export const getFamiliarRecipients = () => client.get("/users/familiar");

export const getThreads = (params = {}) => client.get("/mail/threads", { params });
export const getThreadMessages = (threadId, params = {}) => client.get(`/mail/threads/${threadId}/messages`, { params });
export const getEmails = (params = {}) => client.get("/mail/emails", { params });
export const getImportantMessages = () => client.get("/mail/important");
export const sendMail = (payload) => client.post("/mail/send", payload);
export const updateEmail = (id, payload) => client.patch(`/mail/emails/${id}`, payload);
export const deleteEmail = (id) => client.delete(`/mail/emails/${id}`);
export const updateThread = (id, payload) => client.patch(`/mail/threads/${id}`, payload);
export const deleteThread = (id, params = {}) => client.delete(`/mail/threads/${id}`, { params });
export const assistDraft = (payload) => client.post("/mail/assist", payload);
export const translateMessage = (payload) => client.post("/mail/translate", payload);
export const uploadAttachment = (file) => {
  const data = new FormData();
  data.append("file", file);
  // Omit manual Content-Type so browser sets correct boundary
  return client.post("/mail/upload", data);
};

export const downloadAttachment = async (id, filename) => {
  const res = await client.get(`/mail/attachments/${id}/download`, {
    responseType: "blob", // Raw binary response to prevent string encoding corruption
  });
  const blob = new Blob([res.data], {
    type: res.headers["content-type"] || "application/octet-stream",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "attachment";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// Turns an API-relative picture path ("/mail/attachments/<id>") into a full URL.
export const avatarUrl = (path) => { if (!path) return null; const tk = localStorage.getItem("phonemail_token"); return path.startsWith("/mail/attachments/") && tk ? `${BASE_URL}${path}?token=${encodeURIComponent(tk)}` : `${BASE_URL}${path}`; };

export const updateGroupAvatar = (threadId, attachmentId) =>
  client.patch(`/mail/threads/${threadId}`, { group_avatar_id: attachmentId });

export { BASE_URL };
export default client;

// Drafts (unsent messages saved when the compose window is closed)
export const getDrafts = () => client.get("/mail/drafts");
export const saveDraft = (id, payload) => client.put(`/mail/drafts/${id}`, payload);
export const deleteDraft = (id) => client.delete(`/mail/drafts/${id}`);

export const startPhoneOtp = (phone, purpose) => client.post("/auth/phone/start", { phone, purpose });
export const checkPhoneExists = (phone) => client.post("/auth/phone/exists", { phone });
export const checkPhoneOtp = (phone, code, purpose) => client.post("/auth/phone/check", { phone, code, purpose });
export const changePassword = (currentPassword, password, confirmPassword) =>
  client.post("/auth/password/change", { currentPassword, password, confirmPassword });