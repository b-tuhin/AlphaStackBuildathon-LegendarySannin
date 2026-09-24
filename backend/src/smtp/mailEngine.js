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
    `SELECT * FROM threads WHERE is_group = 0 AND participant_a = ? AND participant_b = ? AND subject_root = ?`
  ).get(a, b, root);
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
    `SELECT * FROM threads WHERE is_group = 1 AND participants = ? AND subject_root = ?`
  ).get(key, root);
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

  if (inReplyTo) {
    const existing = db.prepare(`SELECT id FROM emails WHERE in_reply_to = ?`).get(inReplyTo);
    if (existing) throw Object.assign(new Error("This message has already been replied to"), { status: 409 });
  }

  const thread = isGroup
    ? findOrCreateGroupThread([fromAddr, ...toList], subject)
    : findOrCreate1to1Thread(fromAddr, toList[0], subject);

  const email = {
    id: uuid(),
    thread_id: thread.id,
    message_id: makeMessageId(),
    in_reply_to: inReplyTo,
    from_address: fromAddr,
    to_address: toList.join(", "),
    subject: subject || "",
    body_text: text || "",
    body_html: html || "",
    has_attachments: attachments.length ? 1 : 0,
    attachments: JSON.stringify(attachments.map(a => ({ filename: a.filename, size: a.size, contentType: a.contentType }))),
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
