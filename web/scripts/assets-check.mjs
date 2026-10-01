#!/usr/bin/env node
/**
 * scripts/assets-check.mjs
 *
 * Validates public/assets/ against public/assets/assets.lock.json.
 * Fails (exit 1) if:
 *   - A registered file is missing from public/assets/
 *   - A registered file's sha256 differs from the lock
 *   - A file in public/assets/ (top-level, non-directory, non-json) is NOT registered
 *
 * Usage:
 *   node scripts/assets-check.mjs              # check only
 *   npm run assets:lock -- --reason "text"     # update lock entry + append to CHANGELOG.md
 */

import { createHash } from "crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, appendFileSync } from "fs";
import { join, basename } from "path";

const ASSETS_DIR = "public/assets";
const LOCK_FILE = "public/assets/assets.lock.json";
const CHANGELOG = "public/assets/CHANGELOG.md";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

// ── Update mode (npm run assets:lock -- --reason "...") ─────────────────────
const reasonIdx = process.argv.indexOf("--reason");
if (reasonIdx !== -1) {
  const reason = process.argv[reasonIdx + 1];
  if (!reason) { console.error("--reason requires a value"); process.exit(1); }

  const lock = JSON.parse(readFileSync(LOCK_FILE, "utf8"));

  // Re-measure every asset file in ASSETS_DIR
  const { default: sharp } = await import("sharp");
  const IGNORED = new Set(["assets.lock.json", "CHANGELOG.md"]);
  for (const name of readdirSync(ASSETS_DIR)) {
    if (IGNORED.has(name)) continue;
    const fp = join(ASSETS_DIR, name);
    if (statSync(fp).isDirectory()) continue;
    const buf = readFileSync(fp);
    const meta = await sharp(fp).metadata();
    lock[name] = { sha256: sha256(buf), bytes: buf.length, width: meta.width, height: meta.height };
  }
  writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2) + "\n");

  const ts = new Date().toISOString().slice(0, 10);
  appendFileSync(CHANGELOG, `\n## ${ts}\n${reason}\n`);
  console.log("Lock updated. Reason appended to", CHANGELOG);
  process.exit(0);
}

// ── Check mode ───────────────────────────────────────────────────────────────
const lock = JSON.parse(readFileSync(LOCK_FILE, "utf8"));
const errors = [];

// 1. Every registered file must exist and match hash
for (const [name, entry] of Object.entries(lock)) {
  const fp = join(ASSETS_DIR, name);
  if (!existsSync(fp)) {
    errors.push(`MISSING  ${name}`);
    continue;
  }
  const actual = sha256(readFileSync(fp));
  if (actual !== entry.sha256) {
    errors.push(`HASH_MISMATCH  ${name}\n  expected ${entry.sha256}\n  got      ${actual}`);
  }
}

// 2. Every top-level image in public/assets/ must be registered (skip dirs, .json, CHANGELOG.md)
const IGNORED = new Set(["assets.lock.json", "CHANGELOG.md"]);
for (const name of readdirSync(ASSETS_DIR)) {
  if (IGNORED.has(name)) continue;
  const fp = join(ASSETS_DIR, name);
  if (statSync(fp).isDirectory()) continue;
  if (!(name in lock)) {
    errors.push(`UNREGISTERED  ${name}`);
  }
}

if (errors.length) {
  console.error("assets:check FAILED\n" + errors.join("\n"));
  process.exit(1);
}

console.log(`assets:check OK — ${Object.keys(lock).length} files verified`);
