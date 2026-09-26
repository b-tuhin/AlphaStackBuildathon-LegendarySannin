import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

const userCols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
if (!userCols.includes("must_change_password")) {
  db.exec(`ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`);
}
if (!userCols.includes("tos_accepted_at")) {
  db.exec(`ALTER TABLE users ADD COLUMN tos_accepted_at TEXT`);
}

const emailCols = db.prepare(`PRAGMA table_info(emails)`).all().map((c) => c.name);
if (!emailCols.includes("edited_at")) {
  db.exec(`ALTER TABLE emails ADD COLUMN edited_at TEXT`);
}

db.exec(`DROP TABLE IF EXISTS otps`);
db.exec(`DROP INDEX IF EXISTS idx_single_reply`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to ON emails (in_reply_to)`);

// ── Thread deduplication migration ──────────────────────────────────────────
try {
  const duplicate1to1 = db.prepare(`
    SELECT participant_a, participant_b, COUNT(*) as cnt
    FROM threads
    WHERE is_group = 0
    GROUP BY participant_a, participant_b
    HAVING cnt > 1
  `).all();

  for (const dup of duplicate1to1) {
    const allForPair = db.prepare(`
      SELECT id, created_at FROM threads
      WHERE is_group = 0 AND participant_a = ? AND participant_b = ?
      ORDER BY datetime(created_at) ASC, rowid ASC
    `).all(dup.participant_a, dup.participant_b);

    if (allForPair.length > 1) {
      const canonical = allForPair[0];
      const duplicates = allForPair.slice(1);
      for (const d of duplicates) {
        db.prepare(`UPDATE emails SET thread_id = ? WHERE thread_id = ?`).run(canonical.id, d.id);
        db.prepare(`DELETE FROM threads WHERE id = ?`).run(d.id);
      }
      const latestEmail = db.prepare(`SELECT MAX(created_at) as latest FROM emails WHERE thread_id = ?`).get(canonical.id);
      if (latestEmail?.latest) {
        db.prepare(`UPDATE threads SET last_message_at = ? WHERE id = ?`).run(latestEmail.latest, canonical.id);
      }
    }
  }

  const duplicateGroups = db.prepare(`
    SELECT participants, COUNT(*) as cnt
    FROM threads
    WHERE is_group = 1
    GROUP BY participants
    HAVING cnt > 1
  `).all();

  for (const dup of duplicateGroups) {
    const allForGroup = db.prepare(`
      SELECT id, created_at FROM threads
      WHERE is_group = 1 AND participants = ?
      ORDER BY datetime(created_at) ASC, rowid ASC
    `).all(dup.participants);

    if (allForGroup.length > 1) {
      const canonical = allForGroup[0];
      const duplicates = allForGroup.slice(1);
      for (const d of duplicates) {
        db.prepare(`UPDATE emails SET thread_id = ? WHERE thread_id = ?`).run(canonical.id, d.id);
        db.prepare(`DELETE FROM threads WHERE id = ?`).run(d.id);
      }
      const latestEmail = db.prepare(`SELECT MAX(created_at) as latest FROM emails WHERE thread_id = ?`).get(canonical.id);
      if (latestEmail?.latest) {
        db.prepare(`UPDATE threads SET last_message_at = ? WHERE id = ?`).run(latestEmail.latest, canonical.id);
      }
    }
  }
} catch (err) {
  console.error("[db] Deduplication migration error:", err);
}

console.log(`[db] SQLite ready at ${config.dbPath}`);
