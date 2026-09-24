import { Router } from "express";
import { db } from "../db/database.js";
import { ingestEmail, normalizeAddress } from "../smtp/mailEngine.js";
import { requireAuth } from "./user.routes.js";

const router = Router();
router.use(requireAuth);

const me = (req) => req.user.email;

// ── Threads: unified Inbox + Sent, chat-style (mobile) ──────
router.get("/threads", (req, res) => {
  const addr = me(req);
  const { q, filter } = req.query;

  const oneToOne = db.prepare(
    `SELECT t.*,
       (SELECT body_text FROM emails e WHERE e.thread_id = t.id AND e.folder != 'trash' AND e.folder != 'spam' ORDER BY e.created_at DESC LIMIT 1) AS last_message,
       (SELECT subject   FROM emails e WHERE e.thread_id = t.id ORDER BY e.created_at ASC  LIMIT 1) AS subject,
       (SELECT COUNT(*)  FROM emails e WHERE e.thread_id = t.id AND e.to_address LIKE '%' || ? || '%' AND e.is_read = 0 AND e.folder='home') AS unread_count,
       (SELECT MAX(has_attachments) FROM emails e WHERE e.thread_id = t.id) AS has_attachments,
       (SELECT MAX(is_favorite)     FROM emails e WHERE e.thread_id = t.id) AS is_favorite
     FROM threads t
     WHERE t.is_group = 0 AND (t.participant_a = ? OR t.participant_b = ?)`
  ).all(addr, addr, addr).map(t => ({
    ...t,
    counterpart: t.participant_a === addr ? t.participant_b : t.participant_a,
    is_group: false,
  }));

  const groups = db.prepare(
    `SELECT t.*,
       (SELECT body_text FROM emails e WHERE e.thread_id = t.id AND e.folder != 'trash' AND e.folder != 'spam' ORDER BY e.created_at DESC LIMIT 1) AS last_message,
       (SELECT subject   FROM emails e WHERE e.thread_id = t.id ORDER BY e.created_at ASC  LIMIT 1) AS subject,
       (SELECT COUNT(*)  FROM emails e WHERE e.thread_id = t.id AND e.to_address LIKE '%' || ? || '%' AND e.is_read = 0 AND e.folder='home') AS unread_count,
       (SELECT MAX(has_attachments) FROM emails e WHERE e.thread_id = t.id) AS has_attachments,
       (SELECT MAX(is_favorite)     FROM emails e WHERE e.thread_id = t.id) AS is_favorite
     FROM threads t
     WHERE t.is_group = 1 AND t.participants LIKE '%' || ? || '%'`
  ).all(addr, addr).map(t => ({
    ...t,
    counterpart: t.group_name,
    participants: JSON.parse(t.participants || "[]"),
    is_group: true,
  }));

  let threads = [...oneToOne, ...groups]
    .filter(t => !q || `${t.counterpart} ${t.subject} ${t.last_message}`.toLowerCase().includes(String(q).toLowerCase()))
    .filter(t =>
      filter === "unread"      ? t.unread_count > 0 :
      filter === "attachments" ? t.has_attachments  :
      filter === "favorites"   ? t.is_favorite      : true
    )
    .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

  res.json(threads);
});

router.get("/threads/:id/messages", (req, res) => {
  const messages = db.prepare(
    `SELECT * FROM emails WHERE thread_id = ? AND folder != 'trash' ORDER BY created_at ASC`
  ).all(req.params.id);
  db.prepare(`UPDATE emails SET is_read = 1 WHERE thread_id = ? AND to_address LIKE '%' || ? || '%'`)
    .run(req.params.id, me(req));
  res.json(messages);
});

// ── Flat email list (web Gmail view) ────────────
router.get("/emails", (req, res) => {
  const addr = me(req);
  const { folder = "home", q } = req.query;
  let rows = db.prepare(
    `SELECT * FROM emails WHERE (to_address LIKE '%' || ? || '%' OR from_address = ?) AND folder = ? ORDER BY created_at DESC`
  ).all(addr, addr, folder);
  if (q) rows = rows.filter(e => `${e.subject} ${e.body_text} ${e.from_address}`.toLowerCase().includes(String(q).toLowerCase()));
  res.json(rows);
});

// ── Send / reply / draft. `to` may be a string or an array (group). ──
router.post("/send", (req, res) => {
  try {
    const { to, subject, text, html, inReplyTo, draft } = req.body;
    if (!to || (Array.isArray(to) && to.length === 0)) return res.status(400).json({ error: "'to' is required" });
    const result = ingestEmail({
      from: me(req),
      to,
      subject: inReplyTo ? undefined : subject,
      text, html,
      inReplyTo: inReplyTo || null,
      source: "api",
      folder: draft ? "drafts" : "home",
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Actions: read, favorite, move folder (spam/trash/home) ──
router.patch("/emails/:id", (req, res) => {
  const { is_read, is_favorite, folder } = req.body;
  const email = db.prepare(`SELECT * FROM emails WHERE id = ?`).get(req.params.id);
  if (!email || (!email.to_address.includes(me(req)) && email.from_address !== me(req))) {
    return res.status(404).json({ error: "Not found" });
  }
  db.prepare(
    `UPDATE emails SET
       is_read     = COALESCE(?, is_read),
       is_favorite = COALESCE(?, is_favorite),
       folder      = COALESCE(?, folder)
     WHERE id = ?`
  ).run(is_read ?? null, is_favorite ?? null, folder ?? null, req.params.id);
  res.json({ ok: true });
});

export default router;
