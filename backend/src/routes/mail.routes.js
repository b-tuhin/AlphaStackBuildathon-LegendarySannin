import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuid } from "uuid";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { ingestEmail, normalizeAddress } from "../smtp/mailEngine.js";
import { requireAuth } from "./user.routes.js";
import { generateAssistedDraft } from "../services/assistService.js";

const router = Router();

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

// ── Public attachment serving (for <img> thumbnails and <a> download links) ─
router.get("/attachments/:id", (req, res) => {
  const att = db.prepare(`SELECT * FROM attachments WHERE id = ?`).get(req.params.id);
  if (!att) {
    return res.status(404).json({ error: "Attachment not found" });
  }
  const filePath = (att.disk_path && fs.existsSync(att.disk_path))
    ? att.disk_path
    : path.join(uploadDir, att.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Attachment file not found on disk" });
  }
  res.setHeader("Content-Type", att.mime_type || "application/octet-stream");
  res.setHeader("Content-Length", att.size);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(att.original_name)}"`);
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.status(500).json({ error: "Read error" });
  });
  stream.pipe(res);
});

router.get("/attachments/:id/download", (req, res) => {
  const att = db.prepare(`SELECT * FROM attachments WHERE id = ?`).get(req.params.id);
  if (!att) {
    return res.status(404).json({ error: "Attachment not found" });
  }
  const filePath = (att.disk_path && fs.existsSync(att.disk_path))
    ? att.disk_path
    : path.join(uploadDir, att.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Attachment file not found on disk" });
  }
  res.setHeader("Content-Type", att.mime_type || "application/octet-stream");
  res.setHeader("Content-Length", att.size);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(att.original_name)}"; filename*=UTF-8''${encodeURIComponent(att.original_name)}`
  );
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.status(500).json({ error: "Read error" });
  });
  stream.pipe(res);
});

// ── Protected mail routes ───────────────────────────────────────────────────
router.use(requireAuth);

const me = (req) => req.user.email;

// ── Helper to resolve display name from address ──────────────────────────────
function getDisplayNameForAddress(addr) {
  if (!addr) return null;
  const phone = addr.split("@")[0].replace(/[^\d]/g, "");
  if (!phone) return null;
  const user = db.prepare(`SELECT display_name FROM users WHERE phone = ?`).get(phone);
  return user?.display_name || null;
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
        const phone = rcpt.split("@")[0].replace(/[^\d]/g, "");
        const user = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
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

  let folderCondition = "e.folder != 'trash' AND e.folder != 'spam' AND e.folder != 'drafts'";
  let unreadFolder = "e.folder = 'home'";
  if (folder === "trash") {
    folderCondition = "e.folder = 'trash'";
    unreadFolder = "e.folder = 'trash'";
  } else if (folder === "spam") {
    folderCondition = "e.folder = 'spam'";
    unreadFolder = "e.folder = 'spam'";
  } else if (folder === "drafts") {
    folderCondition = "e.folder = 'drafts'";
    unreadFolder = "e.folder = 'drafts'";
  }

  const oneToOne = db.prepare(
    `SELECT t.*,
       (SELECT body_text FROM emails e WHERE e.thread_id = t.id AND ${folderCondition} ORDER BY e.created_at DESC LIMIT 1) AS last_message,
       (SELECT subject   FROM emails e WHERE e.thread_id = t.id ORDER BY e.created_at ASC  LIMIT 1) AS subject,
       (SELECT COUNT(*)  FROM emails e WHERE e.thread_id = t.id AND e.to_address LIKE '%' || ? || '%' AND e.is_read = 0 AND ${unreadFolder}) AS unread_count,
       (SELECT MAX(has_attachments) FROM emails e WHERE e.thread_id = t.id AND ${folderCondition}) AS has_attachments,
       (SELECT MAX(is_favorite)     FROM emails e WHERE e.thread_id = t.id AND ${folderCondition}) AS is_favorite,
       COALESCE((SELECT e.created_at FROM emails e WHERE e.thread_id = t.id AND ${folderCondition} ORDER BY e.created_at DESC LIMIT 1), t.last_message_at) AS last_message_at
     FROM threads t
     WHERE t.is_group = 0 AND (t.participant_a = ? OR t.participant_b = ?)
       AND EXISTS (SELECT 1 FROM emails e WHERE e.thread_id = t.id AND ${folderCondition})`
  ).all(addr, addr, addr).map((t) => {
    const counterpartAddr = t.participant_a === addr ? t.participant_b : t.participant_a;
    const cpName = getDisplayNameForAddress(counterpartAddr);
    return {
      ...t,
      counterpart: counterpartAddr,
      counterpart_name: cpName,
      counterpart_phone: counterpartAddr ? counterpartAddr.split("@")[0] : "",
      is_group: false,
    };
  });

  const groups = db.prepare(
    `SELECT t.*,
       (SELECT body_text FROM emails e WHERE e.thread_id = t.id AND ${folderCondition} ORDER BY e.created_at DESC LIMIT 1) AS last_message,
       (SELECT subject   FROM emails e WHERE e.thread_id = t.id ORDER BY e.created_at ASC  LIMIT 1) AS subject,
       (SELECT COUNT(*)  FROM emails e WHERE e.thread_id = t.id AND e.to_address LIKE '%' || ? || '%' AND e.is_read = 0 AND ${unreadFolder}) AS unread_count,
       (SELECT MAX(has_attachments) FROM emails e WHERE e.thread_id = t.id AND ${folderCondition}) AS has_attachments,
       (SELECT MAX(is_favorite)     FROM emails e WHERE e.thread_id = t.id AND ${folderCondition}) AS is_favorite,
       COALESCE((SELECT e.created_at FROM emails e WHERE e.thread_id = t.id AND ${folderCondition} ORDER BY e.created_at DESC LIMIT 1), t.last_message_at) AS last_message_at
     FROM threads t
     WHERE t.is_group = 1 AND t.participants LIKE '%' || ? || '%'
       AND EXISTS (SELECT 1 FROM emails e WHERE e.thread_id = t.id AND ${folderCondition})`
  ).all(addr, addr).map((t) => ({
    ...t,
    counterpart: t.group_name,
    counterpart_name: t.group_name,
    participants: JSON.parse(t.participants || "[]"),
    is_group: true,
  }));

  let threads = [...oneToOne, ...groups]
    .filter((t) => !q || `${t.counterpart} ${t.counterpart_name || ""} ${t.subject} ${t.last_message}`.toLowerCase().includes(String(q).toLowerCase()))
    .filter((t) =>
      filter === "unread"      ? t.unread_count > 0 :
      filter === "attachments" ? t.has_attachments  :
      filter === "favorites"   ? t.is_favorite      : true
    )
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

  res.json(threads);
});

router.get("/threads/:id/messages", (req, res) => {
  const addr = me(req);
  const folder = req.query.folder || "home";

  let folderCondition = "folder != 'trash' AND folder != 'spam'";
  if (folder === "trash") {
    folderCondition = "folder = 'trash'";
  } else if (folder === "spam") {
    folderCondition = "folder = 'spam'";
  } else if (folder === "drafts") {
    folderCondition = "folder = 'drafts'";
  } else if (folder === "all") {
    folderCondition = "1=1";
  }

  const messages = db.prepare(
    `SELECT * FROM emails WHERE thread_id = ? AND ${folderCondition} ORDER BY created_at ASC`
  ).all(req.params.id);
  db.prepare(`UPDATE emails SET is_read = 1 WHERE thread_id = ? AND to_address LIKE '%' || ? || '%'`)
    .run(req.params.id, addr);

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
            t.subject_root AS thread_subject_root,
            t.last_message_at AS thread_last_message_at
     FROM emails e
     JOIN threads t ON t.id = e.thread_id
     WHERE e.is_favorite = 1
       AND (e.to_address LIKE '%' || ? || '%' OR e.from_address = ?)
       AND e.folder != 'trash'
     ORDER BY e.created_at DESC`
  ).all(addr, addr);

  const enriched = rows.map((row) => {
    const isGroup = Boolean(row.thread_is_group);
    let counterpart = "";
    let counterpartName = null;
    let counterpartPhone = "";
    let participants = [];

    if (!isGroup) {
      counterpart = row.thread_participant_a === addr ? row.thread_participant_b : row.thread_participant_a;
      counterpartName = getDisplayNameForAddress(counterpart);
      counterpartPhone = counterpart ? counterpart.split("@")[0] : "";
    } else {
      counterpart = row.thread_group_name;
      counterpartName = row.thread_group_name;
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
      subject: row.thread_subject_root || row.subject,
      last_message_at: row.thread_last_message_at,
    };

    const enrichedEmail = enrichMessage(row, addr);

    return {
      ...enrichedEmail,
      counterpart,
      counterpart_name: counterpartName,
      counterpart_phone: counterpartPhone,
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
    `SELECT * FROM emails WHERE (to_address LIKE '%' || ? || '%' OR from_address = ?) AND folder = ? ORDER BY created_at DESC`
  ).all(addr, addr, folder);
  if (q) rows = rows.filter((e) => `${e.subject} ${e.body_text} ${e.from_address}`.toLowerCase().includes(String(q).toLowerCase()));
  const enriched = rows.map((m) => enrichMessage(m, addr));
  res.json(enriched);
});

// ── Send / reply / draft with attachments ───────────────────────────────────
router.post("/send", (req, res) => {
  try {
    const { to, subject, text, html, inReplyTo, attachments } = req.body;
    if (!to || (Array.isArray(to) && to.length === 0)) return res.status(400).json({ error: "'to' is required" });
    const result = ingestEmail({
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
    res.status(err.status || 500).json({ error: err.message, unregistered: err.unregistered });
  }
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

// ── Actions: read, favorite, move folder (spam/trash/home) ──────────────────
router.patch("/threads/:id", (req, res) => {
  const { is_read, is_favorite, folder } = req.body;
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
      authorized = Array.isArray(parts) && parts.includes(addr);
    } catch {
      authorized = String(thread.participants || "").includes(addr);
    }
  }

  if (!authorized) {
    return res.status(404).json({ error: "Thread not found" });
  }

  db.prepare(
    `UPDATE emails SET
       is_read     = COALESCE(?, is_read),
       is_favorite = COALESCE(?, is_favorite),
       folder      = COALESCE(?, folder)
     WHERE thread_id = ?`
  ).run(is_read ?? null, is_favorite ?? null, folder ?? null, req.params.id);

  res.json({ ok: true });
});

router.patch("/emails/:id", (req, res) => {
  const { is_read, is_favorite, folder, body_text } = req.body;
  const email = db.prepare(`SELECT * FROM emails WHERE id = ?`).get(req.params.id);
  if (!email || (!email.to_address.includes(me(req)) && email.from_address !== me(req))) {
    return res.status(404).json({ error: "Not found" });
  }

  if (body_text !== undefined && email.from_address !== me(req)) {
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

  const updated = db.prepare(`SELECT * FROM emails WHERE id = ?`).get(req.params.id);
  res.json({ ok: true, email: updated ? enrichMessage(updated, me(req)) : null });
});

router.delete("/emails/:id", (req, res) => {
  const email = db.prepare(`SELECT * FROM emails WHERE id = ?`).get(req.params.id);
  if (!email || (!email.to_address.includes(me(req)) && email.from_address !== me(req))) {
    return res.status(404).json({ error: "Not found" });
  }

  db.prepare(`DELETE FROM emails WHERE id = ?`).run(req.params.id);

  const remaining = db.prepare(`SELECT COUNT(*) as count FROM emails WHERE thread_id = ?`).get(email.thread_id);
  if (remaining && remaining.count === 0) {
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
      authorized = Array.isArray(parts) && parts.includes(addr);
    } catch {
      authorized = String(thread.participants || "").includes(addr);
    }
  }

  if (!authorized) {
    return res.status(404).json({ error: "Thread not found" });
  }

  const folder = req.query.folder;
  if (folder === "trash") {
    db.prepare(`DELETE FROM emails WHERE thread_id = ? AND folder = 'trash'`).run(req.params.id);
    const remaining = db.prepare(`SELECT COUNT(*) as count FROM emails WHERE thread_id = ?`).get(req.params.id);
    if (remaining && remaining.count === 0) {
      db.prepare(`DELETE FROM threads WHERE id = ?`).run(req.params.id);
    }
  } else {
    db.prepare(`DELETE FROM emails WHERE thread_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM threads WHERE id = ?`).run(req.params.id);
  }

  res.json({ ok: true });
});

export default router;

