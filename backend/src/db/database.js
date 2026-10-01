import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { normalizePhone } from "../auth/password.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new Database(config.dbPath);
db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));

const addColumn = (table, column, definition) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
addColumn("users", "must_change_password", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "tos_accepted_at", "TEXT");
addColumn("users", "avatar_id", "TEXT");
addColumn("users", "tos_version", "TEXT");
addColumn("users", "phone_verified_at", "TEXT");
addColumn("threads", "group_avatar_id", "TEXT");
addColumn("emails", "edited_at", "TEXT");
addColumn("thread_state", "pinned", "INTEGER NOT NULL DEFAULT 0");
addColumn("thread_state", "deleted_at", "TEXT");

// Upgrade prior national/digits-only records to canonical E.164 without changing mail handles.
try {
  const migratePhones = db.transaction(() => {
    const rows = db.prepare("SELECT id, phone FROM users").all();
    const update = db.prepare("UPDATE users SET phone = ? WHERE id = ?");
    for (const row of rows) {
      const e164 = normalizePhone(row.phone);
      if (e164 && e164 !== row.phone) {
        const collision = db.prepare("SELECT id FROM users WHERE phone = ? AND id != ?").get(e164, row.id);
        if (!collision) update.run(e164, row.id);
      }
    }
  });
  migratePhones();
} catch (err) {
  console.error("[db] E.164 migration failed; existing phone values were left unchanged:", err.code || err.name);
}

// Keep historical thread-state backfill, but use exact address tokens (not substring matching).
try {
  const rows = db.prepare("SELECT * FROM threads").all();
  const insert = db.prepare(`INSERT OR IGNORE INTO thread_state (thread_id,user_address,folder,is_read,is_favorite,pinned,deleted_at) VALUES (?,?,?, ?,?,0,NULL)`);
  for (const t of rows) {
    let participants = [];
    if (!t.is_group) participants = [t.participant_a, t.participant_b].filter(Boolean);
    else { try { participants = JSON.parse(t.participants || "[]"); } catch {} }
    const emails = db.prepare("SELECT to_address, folder, is_read, is_favorite FROM emails WHERE thread_id = ?").all(t.id);
    const trash = emails.some((e) => e.folder === "trash");
    const favorite = emails.some((e) => e.is_favorite);
    for (const participant of participants) {
      const unread = emails.some((e) => e.is_read === 0 && String(e.to_address || "").split(",").map((v) => v.trim().toLowerCase()).includes(String(participant).toLowerCase()));
      insert.run(t.id, participant, trash ? "trash" : "home", unread ? 0 : 1, favorite ? 1 : 0);
    }
  }
} catch (err) { console.error("[db] thread_state migration error:", err.code || err.name); }

try {
  const insertAlias = db.prepare("INSERT OR IGNORE INTO alias_map (alias,user_id) VALUES (?,?)");
  for (const user of db.prepare("SELECT id,aliases FROM users").all()) {
    try {
      const aliases = JSON.parse(user.aliases || "[]");
      if (Array.isArray(aliases)) for (const alias of aliases) if (typeof alias === "string" && alias.trim()) insertAlias.run(alias.toLowerCase().trim(), user.id);
    } catch {}
  }
} catch (err) { console.error("[db] alias_map migration error:", err.code || err.name); }

db.exec("DROP TABLE IF EXISTS otps");
db.exec("DROP INDEX IF EXISTS idx_single_reply");
db.exec("CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to ON emails(in_reply_to)");

// Deduplicate old threads before enforcing the current unique-per-participant behavior.
try {
  const oneToOne = db.prepare("SELECT participant_a,participant_b,COUNT(*) AS cnt FROM threads WHERE is_group=0 GROUP BY participant_a,participant_b HAVING cnt>1").all();
  for (const dup of oneToOne) {
    const all = db.prepare("SELECT id FROM threads WHERE is_group=0 AND participant_a=? AND participant_b=? ORDER BY datetime(created_at),rowid").all(dup.participant_a, dup.participant_b);
    for (const row of all.slice(1)) { db.prepare("UPDATE emails SET thread_id=? WHERE thread_id=?").run(all[0].id,row.id); db.prepare("DELETE FROM threads WHERE id=?").run(row.id); }
  }
} catch (err) { console.error("[db] thread deduplication migration error:", err.code || err.name); }
console.log(`[db] SQLite ready at ${config.dbPath}`);
