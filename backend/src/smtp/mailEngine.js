import { v4 as uuid } from "uuid";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { notifyRecipient, notifyGroup } from "../telephony/notifier.js";

const PHONE_RE = /^\+?\d{7,15}$/;

/** "9876543210" -> "9876543210@phonemail.com" */
export function phoneToEmail(phone) {
  const normalized = String(phone).replace(/[^\d]/g, "");
  return `${normalized}@${config.mailDomain}`;
}

/** Accepts "9876543210", "9876543210@phonemail.com", or '"Name" <9876543210@phonemail.com>' */
export function normalizeAddress(input) {
  const raw = String(input).trim();
  const angle = raw.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : raw).toLowerCase();
  if (PHONE_RE.test(addr)) return phoneToEmail(addr);
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
  const user = db.prepare(`SELECT display_name FROM users WHERE phone = ?`).get(local);
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
export function ingestEmail({ from, to, subject, text, html, attachments = [], inReplyTo = null, source = "api", folder = "home" }) {
  const fromAddr = normalizeAddress(from);
  const toList = (Array.isArray(to) ? to : [to]).map(normalizeAddress);
  const isGroup = toList.length > 1;

  // Recipient validation: reject send if any recipient is not a registered PhoneMail user
  const unregistered = [];
  for (const rcpt of toList) {
    const local = rcpt.split("@")[0].replace(/[^\d]/g, "");
    const rawLocal = rcpt.split("@")[0].toLowerCase();
    const user = db.prepare(
      `SELECT id FROM users WHERE phone = ? OR email_address = ? OR aliases LIKE ?`
    ).get(local, rcpt, `%"${rawLocal}"%`);
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

  if (folder === "home") {
    if (isGroup) notifyGroup(toList, fromAddr, subject);
    else notifyRecipient(toList[0], fromAddr, subject);
  }

  return { emailId: email.id, threadId: thread.id, messageId: email.message_id, isGroup };
}
