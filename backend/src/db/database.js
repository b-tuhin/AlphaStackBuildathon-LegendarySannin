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

db.exec(`DROP TABLE IF EXISTS otps`);

console.log(`[db] SQLite ready at ${config.dbPath}`);
