#!/usr/bin/env node
/**
 * Migration verification — runs in CI before type checking.
 *
 * Static checks only (no database connection required):
 *  1. Migration filenames are unique, timestamped and ordered.
 *  2. Every `CREATE TABLE public.x` has GRANT statements and RLS enabled
 *     somewhere in the same migration.
 *  3. No forbidden statements (ALTER DATABASE, changes to managed schemas).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
const FORBIDDEN = [
  /alter\s+database\s+postgres/i,
  /drop\s+schema\s+(auth|storage|realtime|vault)/i,
];

let failures = [];
let files;
try {
  files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
} catch {
  console.error(`No ${DIR} directory found.`);
  process.exit(1);
}

if (files.length === 0) failures.push("No migration files found.");

const seenTimestamps = new Set();
for (const file of files) {
  const ts = file.split("_")[0];
  if (!/^\d{14}$/.test(ts)) failures.push(`${file}: filename must start with a 14-digit timestamp.`);
  if (seenTimestamps.has(ts)) failures.push(`${file}: duplicate migration timestamp ${ts}.`);
  seenTimestamps.add(ts);

  const sql = readFileSync(join(DIR, file), "utf8");

  for (const pattern of FORBIDDEN) {
    if (pattern.test(sql)) failures.push(`${file}: contains a forbidden statement (${pattern}).`);
  }

  const created = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)].map(
    (m) => m[1],
  );
  for (const table of new Set(created)) {
    const grantRe = new RegExp(`grant[\\s\\S]{0,120}on\\s+(table\\s+)?public\\.${table}\\b`, "i");
    const rlsRe = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i");
    if (!grantRe.test(sql)) failures.push(`${file}: public.${table} created without GRANT statements.`);
    if (!rlsRe.test(sql)) failures.push(`${file}: public.${table} created without ENABLE ROW LEVEL SECURITY.`);
  }
}

if (failures.length) {
  console.error("Migration verification failed:\n" + failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}

console.log(`Migration verification passed (${files.length} migrations).`);
