import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuid } from "uuid";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { ingestEmail, normalizeAddress } from "../smtp/mailEngine.js";
import { requireAuth, isValidAvatarAttachment, avatarPath } from "./user.routes.js";
import { generateAssistedDraft, translateMessageText } from "../services/assistService.js";
import { exactRecipientMatch, normalizeRecipientAddress } from "../security/recipients.js";

const router = Router();
const exactJsonMember = (list, address) => {
  try { const parsed = JSON.parse(list || "[]"); return Array.isArray(parsed) && parsed.some((value) => normalizeRecipientAddress(value) === normalizeRecipientAddress(address)); }
  catch { return false; }
};
db.function("recipient_list_has", { deterministic: true }, (list, address) => Number(exactRecipientMatch(list, address)));
db.function("participant_list_has", { deterministic: true }, (list, address) => Number(exactJsonMember(list, address)));

function threadHasMember(thread, address) {
  if (!thread || !address) return false;
  if (!thread.is_group) return normalizeRecipientAddress(thread.participant_a) === normalizeRecipientAddress(address) || normalizeRecipientAddress(thread.participant_b) === normalizeRecipientAddress(address);
  return exactJsonMember(thread.participants, address);
}
function mayReadAttachment(userId, attachmentId) {
  const viewer = db.prepare("SELECT email_address FROM users WHERE id = ?").get(userId)?.email_address;
  if (!viewer) return false;
  const owner = db.prepare("SELECT id,email_address FROM users WHERE avatar_id = ?").get(attachmentId);
  if (owner && owner.email_address === viewer) return true;
  if (owner) {
    const shared = db.prepare("SELECT * FROM threads WHERE is_group=0 AND (participant_a=? OR participant_b=?)").all(viewer, viewer);
    if (shared.some((thread) => thread.participant_a === owner.email_address || thread.participant_b === owner.email_address)) return true;
  }
  const avatarThreads = db.prepare("SELECT participants FROM threads WHERE is_group=1 AND group_avatar_id=?").all(attachmentId);
  if (avatarThreads.some((row) => exactJsonMember(row.participants, viewer))) return true;
  const emails = db.prepare("SELECT thread_id,attachments FROM emails WHERE attachments IS NOT NULL AND attachments != '[]'").all();
  for (const email of emails) {
    try {
      const list = JSON.parse(email.attachments || "[]");
      if (!Array.isArray(list) || !list.some((item) => item?.id === attachmentId)) continue;
      const thread = db.prepare("SELECT * FROM threads WHERE id=?").get(email.thread_id);
      if (threadHasMember(thread, viewer)) return true;
    } catch {}
  }
  return false;
}
function streamAttachment(req, res, att) {
  const filePath = (att.disk_path && fs.existsSync(att.disk_path)) ? att.disk_path : path.join(uploadDir, att.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Attachment file not found on disk" });
  const filename = String(att.original_name || "attachment").replace(/[\"\r\n]/g, "_");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", att.mime_type || "application/octet-stream");
  res.setHeader("Content-Length", att.size);
  const inl = !/\/download$/.test(req.path) && /^(image\/|application\/pdf)/i.test(String(att.mime_type || "")); res.setHeader("Content-Disposition", `${inl ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`);
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => { if (!res.headersSent) res.status(500).json({ error: "Read error" }); });
  stream.pipe(res);
}

// ── Attachments storage & multer setup ──────────────────────────────────────
const uploadDir = path.join(path.dirname(config.dbPath), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB strict limit
});

// ── Protected attachment serving ────────────────────────────────────────────
const attAuth = (req, res, next) => { if (!req.headers.authorization && req.query.token) req.headers.authorization = "Bearer " + req.query.token; return requireAuth(req, res, next); }; router.get("/attachments/:id", attAuth, (req, res) => {
  const att = db.prepare(`SELECT * FROM attachments WHERE id = ?`).get(req.params.id);
  if (!att || !mayReadAttachment(req.user.sub, req.params.id)) return res.status(404).json({ error: "Attachment not found" });
  return streamAttachment(req, res, att);
});
router.get("/attachments/:id/download", attAuth, (req, res) => {
  const att = db.prepare(`SELECT * FROM attachments WHERE id = ?`).get(req.params.id);
  if (!att || !mayReadAttachment(req.user.sub, req.params.id)) return res.status(404).json({ error: "Attachment not found" });
  return streamAttachment(req, res, att);
});

// ── Protected mail routes ───────────────────────────────────────────────────
router.use(requireAuth);

const me = (req) => req.user.email;

// ── Helper to resolve display name from address ──────────────────────────────
function getDisplayNameForAddress(addr) {
  if (!addr) return null;
  const local = addr.split("@")[0].replace(/[^\d]/g, "");
  const phone = `+${local}`;
  if (!phone) return null;
  const user = db.prepare(`SELECT display_name FROM users WHERE phone = ? OR lower(email_address) = lower(?)`).get(phone, addr);
  return user?.display_name || null;
}

// ── Helper to resolve a user's profile-picture URL from an address ───────────
function getAvatarUrlForAddress(addr) {
  if (!addr) return null;
  const local = addr.split("@")[0].replace(/[^\d]/g, "");
  const phone = `+${local}`;
  if (!phone) return null;
  const user = db.prepare(`SELECT avatar_id FROM users WHERE phone = ? OR lower(email_address) = lower(?)`).get(phone, addr);
  return avatarPath(user?.avatar_id);
}

// ── Helper to calculate WhatsApp-style ticks: sent -> delivered -> read ─────
function enrichMessage(m, myAddr) {
  let delivery_status = "sent";
  if (m.from_address === myAddr) {
    if (m.is_read) {
      delivery_status = "read";
    } else {
      // Delivered if recipient exists in PhoneMail and has device/inbox
      const recipients = (m.to_address || "").split(",").map((s) => s.trim());
      const hasDelivery = recipients.some((rcpt) => {
        const phoneDigits = rcpt.split("@")[0].replace(/[^\d]/g, "");
        const user = db.prepare(`SELECT id FROM users WHERE phone = ? OR lower(email_address) = lower(?)`).get(`+${phoneDigits}`, rcpt);
        return !!user;
      });
      delivery_status = hasDelivery ? "delivered" : "sent";
    }
  } else {
    delivery_status = m.is_read ? "read" : "delivered";
  }

  let parsedAttachments = [];
  try {
    parsedAttachments = typeof m.attachments === "string" ? JSON.parse(m.attachments || "[]") : (m.attachments || []);
  } catch {
    parsedAttachments = [];
  }

  const from_display = getDisplayNameForAddress(m.from_address);
  const to_display = (m.to_address || "").split(",").map((s) => getDisplayNameForAddress(s.trim())).filter(Boolean).join(", ") || null;

  return {
    ...m,
    from_name: from_display,
    from_display: from_display,
    from_avatar_url: getAvatarUrlForAddress(m.from_address),
    to_display: to_display,
    delivery_status,
    attachments: parsedAttachments,
  };
}

// ── Upload attachment endpoint ──────────────────────────────────────────────
router.post("/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File size exceeds 10MB limit." });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const id = uuid();
    db.prepare(
      `INSERT INTO attachments (id, filename, original_name, mime_type, size, disk_path)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.file.path
    );

    res.status(201).json({
      id,
      filename: req.file.originalname,
      size: req.file.size,
      contentType: req.file.mimetype,
      url: `/mail/attachments/${id}`,
    });
  });
});

// ── Threads: unified Inbox + Sent, chat-style (mobile & web) ────────────────
router.get("/threads", (req, res) => {
  const addr = me(req);
  const { q, filter, folder = "home" } = req.query;

  let stateFolderCondition = "COALESCE(ts.folder, 'home') != 'trash' AND COALESCE(ts.folder, 'home') != 'spam' AND COALESCE(ts.folder, 'home') != 'drafts'";
  if (folder === "trash") {
    stateFolderCondition = "COALESCE(ts.folder, 'home') = 'trash'";
  } else if (folder === "spam") {
    stateFolderCondition = "COALESCE(ts.folder, 'home') = 'spam'";
  } else if (folder === "drafts") {
    stateFolderCondition = "COALESCE(ts.folder, 'home') = 'drafts'";
  } else if (folder === "archive") {
    stateFolderCondition = "COALESCE(ts.folder, 'home') = 'archive'";
  } else if (folder === "all") {
    stateFolderCondition = "1=1";
  }

  const oneToOne = db.prepare(
    `SELECT t.*,
       COALESCE(ts.folder, 'home') AS folder,
       COALESCE(ts.is_read, 1) AS is_read,
       COALESCE(ts.is_favorite, 0) AS is_favorite,
       COALESCE(ts.pinned, 0) AS pinned,
       (SELECT body_text FROM emails e WHERE e.thread_id = t.id ORDER BY e.created_at DESC LIMIT 1) AS last_message,
       (SELECT subject   FROM emails e WHERE e.thread_id = t.id ORDER BY e.created_at ASC  LIMIT 1) AS subject,
       (SELECT COUNT(*)  FROM emails e WHERE e.thread_id = t.id AND recipient_list_has(e.to_address, ?) = 1 AND e.is_read = 0) AS unread_emails_count,
       (SELECT MAX(has_attachments) FROM emails e WHERE e.thread_id = t.id) AS has_attachments, (SELECT e2.has_attachments FROM emails e2 WHERE e2.thread_id = t.id ORDER BY e2.created_at DESC LIMIT 1) AS last_has_attachments,
       COALESCE((SELECT e.created_at FROM emails e WHERE e.thread_id = t.id ORDER BY e.created_at DESC LIMIT 1), t.last_message_at) AS last_message_at
     FROM threads t
     LEFT JOIN thread_state ts ON ts.thread_id = t.id AND ts.user_address = ?
     WHERE t.is_group = 0 AND (t.participant_a = ? OR t.participant_b = ?)
       AND ${stateFolderCondition}
       AND ts.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM emails e WHERE e.thread_id = t.id)`
  ).all(addr, addr, addr, addr).map((t) => {
    const counterpartAddr = t.participant_a === addr ? t.participant_b : t.participant_a;
    const cpName = getDisplayNameForAddress(counterpartAddr);
    const unread_count = (t.is_read === 0) ? Math.max(1, t.unread_emails_count || 0) : 0;
    return {
      ...t,
      unread_count,
      counterpart: counterpartAddr,
      counterpart_name: cpName,
      counterpart_phone: counterpartAddr ? counterpartAddr.split("@")[0] : "",
      avatar_url: getAvatarUrlForAddress(counterpartAddr),
      is_group: false,
    };
  });

  const groups = db.prepare(
    `SELECT t.*,
       COALESCE(ts.folder, 'home') AS folder,
       COALESCE(ts.is_read, 1) AS is_read,
       COALESCE(ts.is_favorite, 0) AS is_favorite,
       COALESCE(ts.pinned, 0) AS pinned,
       (SELECT body_text FROM emails e WHERE e.thread_id = t.id ORDER BY e.created_at DESC LIMIT 1) AS last_message,
       (SELECT subject   FROM emails e WHERE e.thread_id = t.id ORDER BY e.created_at ASC  LIMIT 1) AS subject,
       (SELECT COUNT(*)  FROM emails e WHERE e.thread_id = t.id AND recipient_list_has(e.to_address, ?) = 1 AND e.is_read = 0) AS unread_emails_count,
       (SELECT MAX(has_attachments) FROM emails e WHERE e.thread_id = t.id) AS has_attachments, (SELECT e2.has_attachments FROM emails e2 WHERE e2.thread_id = t.id ORDER BY e2.created_at DESC LIMIT 1) AS last_has_attachments,
       COALESCE((SELECT e.created_at FROM emails e WHERE e.thread_id = t.id ORDER BY e.created_at DESC LIMIT 1), t.last_message_at) AS last_message_at
     FROM threads t
     LEFT JOIN thread_state ts ON ts.thread_id = t.id AND ts.user_address = ?
     WHERE t.is_group = 1 AND participant_list_has(t.participants, ?) = 1
       AND ${stateFolderCondition}
       AND ts.deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM emails e WHERE e.thread_id = t.id)`
  ).all(addr, addr, addr).map((t) => {
    const unread_count = (t.is_read === 0) ? Math.max(1, t.unread_emails_count || 0) : 0;
    return {
      ...t,
      unread_count,
      counterpart: t.group_name,
      counterpart_name: t.group_name,
      participants: JSON.parse(t.participants || "[]"),
      avatar_url: avatarPath(t.group_avatar_id),
      is_group: true,
    };
  });

  let threads = [...oneToOne, ...groups]
    .filter((t) => !q || `${t.counterpart} ${t.counterpart_name || ""} ${t.subject} ${t.last_message}`.toLowerCase().includes(String(q).toLowerCase()))
    .filter((t) =>
      filter === "unread"      ? t.unread_count > 0 || t.is_read === 0 :
      filter === "attachments" ? t.has_attachments  :
      filter === "favorites"   ? t.is_favorite      : true
    )
    .sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) {
        return bPinned - aPinned; // pinned first
      }
      if (aPinned === 1) {
        // multiple pinned: sort alphabetically by counterpart name
        const nameA = String(a.counterpart_name || a.counterpart || "").toLowerCase();
        const nameB = String(b.counterpart_name || b.counterpart || "").toLowerCase();
        return nameA.localeCompare(nameB);
      }
      // unpinned: most recent first
      return new Date(b.last_message_at) - new Date(a.last_message_at);
    });

  res.json(threads);
});

router.get("/threads/:id/messages", (req, res) => {
  const addr = me(req);
  const thread = db.prepare(`SELECT * FROM threads WHERE id = ?`).get(req.params.id);
  if (!thread) {
    return res.status(404).json({ error: "Thread not found" });
  }

  let authorized = false;
  if (!thread.is_group) {
    authorized = (thread.participant_a === addr || thread.participant_b === addr);
  } else {
    try {
      const parts = JSON.parse(thread.participants || "[]");
      authorized = Array.isArray(parts) && parts.some((part) => normalizeRecipientAddress(part) === normalizeRecipientAddress(addr));
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    return res.status(404).json({ error: "Thread not found" });
  }

  // Check if thread was purged by this user
  const state = db.prepare(`SELECT * FROM thread_state WHERE thread_id = ? AND user_address = ?`).get(req.params.id, addr);
  if (state?.deleted_at) {
    return res.status(404).json({ error: "Thread not found" });
  }

  // Mark thread as read for requesting user in thread_state
  db.prepare(`
    INSERT INTO thread_state (thread_id, user_address, is_read)
    VALUES (?, ?, 1)
    ON CONFLICT(thread_id, user_address) DO UPDATE SET is_read = 1
  `).run(req.params.id, addr);

  db.prepare(`UPDATE emails SET is_read = 1 WHERE thread_id = ? AND recipient_list_has(to_address, ?) = 1`)
    .run(req.params.id, addr);

  const messages = db.prepare(`SELECT * FROM emails WHERE thread_id = ? AND (? IS NULL OR julianday(created_at) > julianday(?)) ORDER BY created_at ASC`).all(req.params.id, state?.cleared_at ?? null, state?.cleared_at ?? null);

  const enriched = messages.map((m) => enrichMessage(m, addr));
  res.json(enriched);
});

// ── Important (starred) emails across all threads ───────────────────────────
router.get("/important", (req, res) => {
  const addr = me(req);
  const rows = db.prepare(
    `SELECT e.*,
            t.is_group AS thread_is_group,
            t.participant_a AS thread_participant_a,
            t.participant_b AS thread_participant_b,
            t.participants AS thread_participants,
            t.group_name AS thread_group_name,
            t.group_avatar_id AS thread_group_avatar_id,
            t.subject_root AS thread_subject_root,
            t.last_message_at AS thread_last_message_at
     FROM emails e
     JOIN threads t ON t.id = e.thread_id
     LEFT JOIN thread_state ts ON ts.thread_id = t.id AND ts.user_address = ?
     WHERE (e.is_favorite = 1)
       AND (recipient_list_has(e.to_address, ?) = 1 OR e.from_address = ?)
       AND COALESCE(ts.folder, 'home') != 'trash'
       AND ts.deleted_at IS NULL
     ORDER BY e.created_at DESC`
  ).all(addr, addr, addr);

  const enriched = rows.map((row) => {
    const isGroup = Boolean(row.thread_is_group);
    let counterpart = "";
    let counterpartName = null;
    let counterpartPhone = "";
    let participants = [];
    let threadAvatarUrl = null;

    if (!isGroup) {
      counterpart = row.thread_participant_a === addr ? row.thread_participant_b : row.thread_participant_a;
      threadAvatarUrl = getAvatarUrlForAddress(counterpart);
      counterpartName = getDisplayNameForAddress(counterpart);
      counterpartPhone = counterpart ? counterpart.split("@")[0] : "";
    } else {
      counterpart = row.thread_group_name;
      counterpartName = row.thread_group_name;
      threadAvatarUrl = avatarPath(row.thread_group_avatar_id);
      try {
        participants = JSON.parse(row.thread_participants || "[]");
      } catch {
        participants = [];
      }
    }

    const threadObj = {
      id: row.thread_id,
      is_group: isGroup,
      counterpart,
      counterpart_name: counterpartName,
      counterpart_phone: counterpartPhone,
      participants: isGroup ? participants : undefined,
      avatar_url: threadAvatarUrl,
      group_avatar_id: isGroup ? (row.thread_group_avatar_id || null) : undefined,
      subject: row.thread_subject_root || row.subject,
      last_message_at: row.thread_last_message_at,
    };

    const enrichedEmail = enrichMessage(row, addr);

    return {
      ...enrichedEmail,
      counterpart,
      counterpart_name: counterpartName,
      counterpart_phone: counterpartPhone,
      avatar_url: threadAvatarUrl,
      is_group: isGroup,
      thread: threadObj,
    };
  });

  res.json(enriched);
});

// ── Flat email list (web Gmail view) ────────────────────────────────────────
router.get("/emails", (req, res) => {
  const addr = me(req);
  const { folder = "home", q } = req.query;
  let rows = db.prepare(
    `SELECT e.*
     FROM emails e
     JOIN threads t ON t.id = e.thread_id
     LEFT JOIN thread_state ts ON ts.thread_id = t.id AND ts.user_address = ?
     WHERE (recipient_list_has(e.to_address, ?) = 1 OR e.from_address = ?)
       AND COALESCE(ts.folder, 'home') = ?
       AND ts.deleted_at IS NULL
     ORDER BY e.created_at DESC`
  ).all(addr, addr, addr, folder);
  if (q) rows = rows.filter((e) => `${e.subject} ${e.body_text} ${e.from_address}`.toLowerCase().includes(String(q).toLowerCase()));
  const enriched = rows.map((m) => enrichMessage(m, addr));
  res.json(enriched);
});

// ── Send / reply / draft with attachments ───────────────────────────────────
router.post("/send", async (req, res) => {
  try {
    const { to, subject, text, html, inReplyTo, attachments } = req.body;
    if (!to || (Array.isArray(to) && to.length === 0)) return res.status(400).json({ error: "'to' is required" });
    const result = await ingestEmail({
      from: me(req),
      to,
      subject: inReplyTo ? undefined : subject,
      text,
      html,
      attachments: attachments || [],
      inReplyTo: inReplyTo || null,
      source: "api",
      folder: "home",
    });

    const createdEmail = db.prepare(`SELECT * FROM emails WHERE id = ?`).get(result.emailId);
    res.status(201).json({
      ...result,
      email: createdEmail ? enrichMessage(createdEmail, me(req)) : null,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, unregistered: err.unregistered });
    console.error("[mail] send or notification failed:", err.code || err.name || "Error");
    return res.status(502).json({ error: "Unable to complete message delivery right now." });
  }
});

// ── Drafts (Drafts folder) ──────────────────────────────────────────────────
const draftOut = (d) => ({
  id: d.id,
  to: d.to_address,
  subject: d.subject || "",
  body: d.body_text || "",
  threadId: d.thread_id || null,
  inReplyTo: d.in_reply_to || null,
  lockedRecipient: !!d.locked_recipient,
  updatedAt: d.updated_at,
});

router.get("/drafts", (req, res) => {
  const rows = db.prepare(`SELECT * FROM drafts WHERE owner = ? ORDER BY updated_at DESC`).all(me(req));
  res.json(rows.map(draftOut));
});

router.put("/drafts/:id", (req, res) => {
  const { to, subject, text, threadId, inReplyTo, lockedRecipient } = req.body || {};
  const id = String(req.params.id || "");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return res.status(400).json({ error: "Invalid draft id" });

  const existing = db.prepare(`SELECT owner FROM drafts WHERE id = ?`).get(id);
  if (existing && existing.owner !== me(req)) return res.status(404).json({ error: "Draft not found" });

  const toStr = Array.isArray(to) ? to.join(", ") : String(to || "");
  db.prepare(
    `INSERT INTO drafts (id, owner, to_address, subject, body_text, thread_id, in_reply_to, locked_recipient, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       to_address = excluded.to_address, subject = excluded.subject, body_text = excluded.body_text,
       thread_id = excluded.thread_id, in_reply_to = excluded.in_reply_to,
       locked_recipient = excluded.locked_recipient, updated_at = excluded.updated_at`
  ).run(id, me(req), toStr, subject || "", text || "", threadId || null, inReplyTo || null, lockedRecipient ? 1 : 0, new Date().toISOString());

  res.json(draftOut(db.prepare(`SELECT * FROM drafts WHERE id = ?`).get(id)));
});

router.delete("/drafts/:id", (req, res) => {
  db.prepare(`DELETE FROM drafts WHERE id = ? AND owner = ?`).run(req.params.id, me(req));
  res.json({ ok: true });
});

// ── Assisted Reply / Compose Endpoint ─────────────────────────────────────────
router.post("/assist", async (req, res) => {
  try {
    const { threadId, intent, isNewMessage, currentSubject } = req.body;
    if (!intent || typeof intent !== "string" || !intent.trim()) {
      return res.status(400).json({ error: "'intent' is required" });
    }

    const userId = req.user.id || req.user.phone || req.user.email;
    const senderName = req.user.display_name || req.user.email?.split("@")[0] || "";

    // Fetch prior messages if threadId is provided (last ~10)
    let threadMessages = [];
    if (threadId) {
      threadMessages = db
        .prepare(
          `SELECT from_address, to_address, subject, body_text, created_at
           FROM emails
           WHERE thread_id = ? AND folder != 'trash' AND folder != 'spam'
           ORDER BY created_at ASC
           LIMIT 10`
        )
        .all(threadId);
    }

    const draft = await generateAssistedDraft({
      userId,
      threadId,
      intent: intent.trim(),
      isNewMessage: Boolean(isNewMessage || !threadId),
      currentSubject,
      senderName,
      threadMessages,
    });

    res.json(draft);
  } catch (err) {
    if (err.status === 429) {
      if (err.retryAfter) res.setHeader("Retry-After", String(err.retryAfter));
      return res.status(429).json({ error: err.message });
    }
    res.status(err.status || 500).json({ error: err.message || "Failed to generate assisted draft" });
  }
});

// ── Message Translation Endpoint ──────────────────────────────────────────────
router.post("/translate", async (req, res) => {
  try {
    const { text, targetLangCode } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "'text' is required" });
    }
    if (!targetLangCode || typeof targetLangCode !== "string") {
      return res.status(400).json({ error: "'targetLangCode' is required" });
    }

    const result = await translateMessageText({
      text: text.trim(),
      targetLangCode: targetLangCode.trim(),
    });

    res.json(result);
  } catch (err) {
    console.error("[translate] Error translating message:", err.message, err.details || "");
    if (err.code === "TRANSLATION_UNAVAILABLE") {
      return res.status(502).json({ error: "translation_unavailable", message: err.message });
    }
    res.status(500).json({ error: err.message || "Failed to translate text" });
  }
});

// ── Actions: read, favorite, move folder (spam/trash/home), pin ─────────────
router.patch("/threads/:id", (req, res) => {
  const { is_read, is_favorite, folder, pinned } = req.body;
  const hasGroupAvatar = req.body && "group_avatar_id" in req.body;
  const addr = me(req);
  const thread = db.prepare(`SELECT * FROM threads WHERE id = ?`).get(req.params.id);
  if (!thread) {
    return res.status(404).json({ error: "Thread not found" });
  }

  let authorized = false;
  if (!thread.is_group) {
    authorized = (thread.participant_a === addr || thread.participant_b === addr);
  } else {
    try {
      const parts = JSON.parse(thread.participants || "[]");
      authorized = Array.isArray(parts) && parts.some((part) => normalizeRecipientAddress(part) === normalizeRecipientAddress(addr));
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    return res.status(404).json({ error: "Thread not found" });
  }

  // Group picture: shared by every member, so any participant may change it.
  if (hasGroupAvatar) {
    if (!thread.is_group) {
      return res.status(400).json({ error: "Only group conversations have a group picture." });
    }
    const avatarId = req.body.group_avatar_id || null;
    if (avatarId && !isValidAvatarAttachment(avatarId)) {
      return res.status(400).json({ error: "Group picture must be a JPEG, PNG, WebP or GIF image." });
    }
    db.prepare(`UPDATE threads SET group_avatar_id = ? WHERE id = ?`).run(avatarId, req.params.id);

    const touchesState = [is_read, is_favorite, folder, pinned].some((v) => v !== undefined);
    if (!touchesState) {
      return res.json({ ok: true, group_avatar_id: avatarId, avatar_url: avatarPath(avatarId) });
    }
  }

  // Update per-user thread_state via read-then-write to preserve unspecified columns
  const existingState = db.prepare(
    `SELECT folder, is_read, is_favorite, pinned, deleted_at FROM thread_state WHERE thread_id = ? AND user_address = ?`
  ).get(req.params.id, addr);

  if (existingState) {
    const newFolder = folder !== undefined ? folder : existingState.folder;
    const newIsRead = is_read !== undefined ? (is_read ? 1 : 0) : existingState.is_read;
    const newIsFav = is_favorite !== undefined ? (is_favorite ? 1 : 0) : existingState.is_favorite;
    const newPinned = pinned !== undefined ? (pinned ? 1 : 0) : existingState.pinned;
    const newDeletedAt = (folder !== undefined && folder === 'home') ? null : existingState.deleted_at;

    db.prepare(`
      UPDATE thread_state
      SET folder = ?, is_read = ?, is_favorite = ?, pinned = ?, deleted_at = ?
      WHERE thread_id = ? AND user_address = ?
    `).run(newFolder, newIsRead, newIsFav, newPinned, newDeletedAt, req.params.id, addr);
  } else {
    const newFolder = folder !== undefined ? folder : 'home';
    const newIsRead = is_read !== undefined ? (is_read ? 1 : 0) : 1;
    const newIsFav = is_favorite !== undefined ? (is_favorite ? 1 : 0) : 0;
    const newPinned = pinned !== undefined ? (pinned ? 1 : 0) : 0;

    db.prepare(`
      INSERT INTO thread_state (thread_id, user_address, folder, is_read, is_favorite, pinned, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `).run(req.params.id, addr, newFolder, newIsRead, newIsFav, newPinned);
  }

  res.json({ ok: true });
});

router.patch("/emails/:id", (req, res) => {
  const { is_read, is_favorite, folder, body_text } = req.body;
  const addr = me(req);
  const email = db.prepare(`SELECT * FROM emails WHERE id = ?`).get(req.params.id);
  if (!email || (!exactRecipientMatch(email.to_address, addr) && email.from_address !== addr)) {
    return res.status(404).json({ error: "Not found" });
  }

  if (body_text !== undefined && email.from_address !== addr) {
    return res.status(403).json({ error: "Cannot edit messages from other users" });
  }

  const now = new Date().toISOString();
  const willUpdateBody = body_text !== undefined;

  db.prepare(
    `UPDATE emails SET
       is_read     = COALESCE(?, is_read),
       is_favorite = COALESCE(?, is_favorite),
       folder      = COALESCE(?, folder),
       body_text   = COALESCE(?, body_text),
       edited_at   = CASE WHEN ? THEN ? ELSE edited_at END
     WHERE id = ?`
  ).run(
    is_read ?? null,
    is_favorite ?? null,
    folder ?? null,
    body_text !== undefined ? body_text : null,
    willUpdateBody ? 1 : 0,
    now,
    req.params.id
  );

  // Also update thread_state for this user if folder or is_favorite or is_read were passed
  if (folder !== undefined || is_favorite !== undefined || is_read !== undefined) {
    const existingState = db.prepare(
      `SELECT folder, is_read, is_favorite, pinned, deleted_at FROM thread_state WHERE thread_id = ? AND user_address = ?`
    ).get(email.thread_id, addr);

    if (existingState) {
      const newFolder = folder !== undefined ? folder : existingState.folder;
      const newIsRead = is_read !== undefined ? (is_read ? 1 : 0) : existingState.is_read;
      const newIsFav = is_favorite !== undefined ? (is_favorite ? 1 : 0) : existingState.is_favorite;
      const newDeletedAt = (folder !== undefined && folder === 'home') ? null : existingState.deleted_at;

      db.prepare(`
        UPDATE thread_state
        SET folder = ?, is_read = ?, is_favorite = ?, deleted_at = ?
        WHERE thread_id = ? AND user_address = ?
      `).run(newFolder, newIsRead, newIsFav, newDeletedAt, email.thread_id, addr);
    } else {
      const newFolder = folder !== undefined ? folder : 'home';
      const newIsRead = is_read !== undefined ? (is_read ? 1 : 0) : 1;
      const newIsFav = is_favorite !== undefined ? (is_favorite ? 1 : 0) : 0;

      db.prepare(`
        INSERT INTO thread_state (thread_id, user_address, folder, is_read, is_favorite, pinned, deleted_at)
        VALUES (?, ?, ?, ?, ?, 0, NULL)
      `).run(email.thread_id, addr, newFolder, newIsRead, newIsFav);
    }
  }

  const updated = db.prepare(`SELECT * FROM emails WHERE id = ?`).get(req.params.id);
  res.json({ ok: true, email: updated ? enrichMessage(updated, addr) : null });
});

router.delete("/emails/:id", (req, res) => {
  const addr = me(req);
  const email = db.prepare(`SELECT * FROM emails WHERE id = ?`).get(req.params.id);
  if (!email || (!exactRecipientMatch(email.to_address, addr) && email.from_address !== addr)) {
    return res.status(404).json({ error: "Not found" });
  }

  db.prepare(`DELETE FROM emails WHERE id = ?`).run(req.params.id);

  const remaining = db.prepare(`SELECT COUNT(*) as count FROM emails WHERE thread_id = ?`).get(email.thread_id);
  if (remaining && remaining.count === 0) {
    db.prepare(`DELETE FROM thread_state WHERE thread_id = ?`).run(email.thread_id);
    db.prepare(`DELETE FROM threads WHERE id = ?`).run(email.thread_id);
  }

  res.json({ ok: true });
});

router.delete("/threads/:id", (req, res) => {
  const addr = me(req);
  const thread = db.prepare(`SELECT * FROM threads WHERE id = ?`).get(req.params.id);
  if (!thread) {
    return res.status(404).json({ error: "Thread not found" });
  }

  let authorized = false;
  if (!thread.is_group) {
    authorized = (thread.participant_a === addr || thread.participant_b === addr);
  } else {
    try {
      const parts = JSON.parse(thread.participants || "[]");
      authorized = Array.isArray(parts) && parts.some((part) => normalizeRecipientAddress(part) === normalizeRecipientAddress(addr));
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    return res.status(404).json({ error: "Thread not found" });
  }

  const folder = req.query.folder;
  const isPurge = folder === "trash";

  if (isPurge) {
    // Permanent purge for this user
    db.prepare(`
      INSERT INTO thread_state (thread_id, user_address, folder, deleted_at, cleared_at)
      VALUES (?, ?, 'trash', datetime('now'), datetime('now'))
      ON CONFLICT(thread_id, user_address) DO UPDATE SET
        folder = 'trash',
        deleted_at = datetime('now'),
        cleared_at = datetime('now')
    `).run(req.params.id, addr);

    // Determine all participants of this thread
    let allParticipants = [];
    if (!thread.is_group) {
      if (thread.participant_a) allParticipants.push(thread.participant_a);
      if (thread.participant_b && thread.participant_b !== thread.participant_a) allParticipants.push(thread.participant_b);
    } else {
      try {
        allParticipants = JSON.parse(thread.participants || "[]");
      } catch {}
    }

    // Check if every participant has deleted_at set
    const states = db.prepare(`SELECT user_address, deleted_at FROM thread_state WHERE thread_id = ?`).all(req.params.id);
    const purgedUsers = new Set(states.filter(s => s.deleted_at != null).map(s => s.user_address));
    const allPurged = allParticipants.length > 0 && allParticipants.every(p => purgedUsers.has(p));

    if (allPurged) {
      db.prepare(`DELETE FROM thread_state WHERE thread_id = ?`).run(req.params.id);
      db.prepare(`DELETE FROM emails WHERE thread_id = ?`).run(req.params.id);
      db.prepare(`DELETE FROM threads WHERE id = ?`).run(req.params.id);
    }
  } else {
    // Normal delete: move to trash for requesting user only
    db.prepare(`
      INSERT INTO thread_state (thread_id, user_address, folder)
      VALUES (?, ?, 'trash')
      ON CONFLICT(thread_id, user_address) DO UPDATE SET
        folder = 'trash'
    `).run(req.params.id, addr);
  }

  res.json({ ok: true });
});

export default router;
