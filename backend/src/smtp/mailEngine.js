import { v4 as uuid } from "uuid";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { notifyRecipient, notifyGroup } from "../telephony/notifier.js";
import { normalizePhone } from "../auth/password.js";

const PHONE_RE = /^\+?\d{7,15}$/;

/** "9876543210" -> "9876543210@phonemail.com" */
export function phoneToEmail(phone) {
  const normalized = (normalizePhone(phone) || String(phone)).replace(/[^\d]/g, "");
  return `${normalized}@${config.mailDomain}`;
}

/** Accepts "9876543210", "9876543210@phonemail.com", or '"Name" <9876543210@phonemail.com>' */
export function normalizeAddress(input) {
  const raw = String(input).trim();
  const angle = raw.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : raw).toLowerCase();
  if (PHONE_RE.test(addr)) return phoneToEmail(normalizePhone(addr) || addr);
  return addr;
}

export function toRfc5322Mailbox(address, displayName) {
  return displayName ? `"${displayName.replace(/"/g, "'")}" <${address}>` : address;
}

export function makeMessageId() {
  return `<${uuid()}@${config.mailDomain}>`;
}

function stripRe(subject) {
  return (subject || "").replace(/^(\s*(re|fwd?):\s*)+/i, "").trim();
}

function displayNameFor(address) {
  const local = address.split("@")[0];
  const phone = normalizePhone(`+${local.replace(/\D/g, "")}`);
  const user = db.prepare(`SELECT display_name FROM users WHERE phone = ?`).get(phone);
  return (user && user.display_name) || local;
}

// ── 1:1 thread resolution ────────────────────────
function findOrCreate1to1Thread(addrA, addrB, subject) {
  const [a, b] = [addrA, addrB].sort();
  const root = stripRe(subject);
  let thread = db.prepare(
    `SELECT * FROM threads WHERE is_group = 0 AND participant_a = ? AND participant_b = ?`
  ).get(a, b);
  if (!thread) {
    thread = { id: uuid(), is_group: 0, participant_a: a, participant_b: b, subject_root: root };
    db.prepare(
      `INSERT INTO threads (id, is_group, participant_a, participant_b, subject_root) VALUES (?, 0, ?, ?, ?)`
    ).run(thread.id, a, b, root);
  }
  db.prepare(`UPDATE threads SET last_message_at = datetime('now') WHERE id = ?`).run(thread.id);
  return thread;
}

// ── Group thread resolution (3+ participants) ────
function findOrCreateGroupThread(addresses, subject) {
  const sorted = [...new Set(addresses)].sort();
  const key = JSON.stringify(sorted);
  const root = stripRe(subject);
  let thread = db.prepare(
    `SELECT * FROM threads WHERE is_group = 1 AND participants = ?`
  ).get(key);
  if (!thread) {
    const groupName = sorted.map(displayNameFor).join(", ");
    thread = { id: uuid(), is_group: 1, participants: key, group_name: groupName, subject_root: root };
    db.prepare(
      `INSERT INTO threads (id, is_group, participants, group_name, subject_root) VALUES (?, 1, ?, ?, ?)`
    ).run(thread.id, key, groupName, root);
  }
  db.prepare(`UPDATE threads SET last_message_at = datetime('now') WHERE id = ?`).run(thread.id);
  return thread;
}

/**
 * Ingest a message. `to` may be a single address/phone or an array of them.
 * 2+ recipients (or 1 recipient + explicit group=true) creates/uses a group thread.
 */
export async function ingestEmail({ from, to, subject, text, html, attachments = [], inReplyTo = null, source = "api", folder = "home" }) {
  const fromAddr = normalizeAddress(from);
  const toList = (Array.isArray(to) ? to : [to]).map(normalizeAddress);
  const isGroup = toList.length > 1;

  // Recipient validation: reject send if any recipient is not a registered PhoneMail user
  const unregistered = [];
  for (const rcpt of toList) {
    const local = rcpt.split("@")[0].replace(/[^\d]/g, "");
    const phone = normalizePhone(`+${local}`);
    const rawLocal = rcpt.split("@")[0].toLowerCase();
    const user = db.prepare(
      `SELECT id FROM users WHERE phone = ? OR email_address = ? OR id IN (SELECT user_id FROM alias_map WHERE alias = ?)`
    ).get(phone, rcpt, rawLocal);
    if (!user) {
      unregistered.push(rcpt);
    }
  }
  if (unregistered.length > 0) {
    const err = new Error("One or more recipients are not registered PhoneMail users");
    err.status = 400;
    err.unregistered = unregistered;
    throw err;
  }

  let thread;
  let resolvedSubject = subject;
  if (inReplyTo) {
    const parent = db.prepare(`SELECT * FROM emails WHERE message_id = ? OR id = ?`).get(inReplyTo, inReplyTo);
    if (parent) {
      thread = db.prepare(`SELECT * FROM threads WHERE id = ?`).get(parent.thread_id);
      if (thread) {
        db.prepare(`UPDATE threads SET last_message_at = datetime('now') WHERE id = ?`).run(thread.id);
      }
      if (!resolvedSubject) {
        resolvedSubject = parent.subject ? (parent.subject.startsWith("Re:") ? parent.subject : `Re: ${parent.subject}`) : "";
      }
    }
  }

  if (!thread) {
    thread = isGroup
      ? findOrCreateGroupThread([fromAddr, ...toList], resolvedSubject)
      : findOrCreate1to1Thread(fromAddr, toList[0], resolvedSubject);
  }

  const email = {
    id: uuid(),
    thread_id: thread.id,
    message_id: makeMessageId(),
    in_reply_to: inReplyTo,
    from_address: fromAddr,
    to_address: toList.join(", "),
    subject: resolvedSubject || "",
    body_text: text || "",
    body_html: html || "",
    has_attachments: attachments.length ? 1 : 0,
    attachments: JSON.stringify(attachments.map(a => ({
      id: a.id || null,
      filename: a.filename || a.original_name || "attachment",
      size: a.size || 0,
      contentType: a.contentType || a.mime_type || "application/octet-stream",
      url: a.url || (a.id ? `/mail/attachments/${a.id}` : null),
    }))),
    folder,
    source,
  };

  db.prepare(
    `INSERT INTO emails (id, thread_id, message_id, in_reply_to, from_address, to_address,
       subject, body_text, body_html, has_attachments, attachments, folder, source)
     VALUES (@id, @thread_id, @message_id, @in_reply_to, @from_address, @to_address,
       @subject, @body_text, @body_html, @has_attachments, @attachments, @folder, @source)`
  ).run(email);

  // ── Maintain per-user thread_state ──────────────────────────────
  // For sender: folder = home, is_read = 1, clear deleted_at
  db.prepare(`
    INSERT INTO thread_state (thread_id, user_address, folder, is_read, is_favorite, pinned, deleted_at)
    VALUES (?, ?, 'home', 1, 0, 0, NULL)
    ON CONFLICT(thread_id, user_address) DO UPDATE SET
      folder = CASE WHEN folder = 'trash' THEN 'home' ELSE folder END,
      deleted_at = NULL
  `).run(thread.id, fromAddr);

  // For each recipient: folder = home, is_read = 0 (unread!), clear deleted_at
  const upsertRcptState = db.prepare(`
    INSERT INTO thread_state (thread_id, user_address, folder, is_read, is_favorite, pinned, deleted_at)
    VALUES (?, ?, 'home', 0, 0, 0, NULL)
    ON CONFLICT(thread_id, user_address) DO UPDATE SET
      is_read = 0,
      folder = CASE WHEN folder = 'trash' THEN 'home' ELSE folder END,
      deleted_at = NULL
  `);
  for (const rcpt of toList) {
    if (rcpt && rcpt !== fromAddr) {
      upsertRcptState.run(thread.id, rcpt);
    }
  }

  if (folder === "home") {
    if (isGroup) await notifyGroup(toList, fromAddr, subject);
    else if (toList[0] !== fromAddr) await notifyRecipient(toList[0], fromAddr, subject);
  }

  return { emailId: email.id, threadId: thread.id, messageId: email.message_id, isGroup };
}
