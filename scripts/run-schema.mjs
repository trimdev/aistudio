/**
 * Runs the GhostStudio schema against Supabase via the Management API.
 * Requires SUPABASE_ACCESS_TOKEN env var (your personal access token from
 * https://supabase.com/dashboard/account/tokens).
 *
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/run-schema.mjs
 *
 * Alternatively just paste src/lib/supabase/schema.sql into the SQL Editor.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const get = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();
const projectRef = get("NEXT_PUBLIC_SUPABASE_URL")?.match(/https:\/\/([^.]+)/)?.[1];

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN. Get one from https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), "src/lib/supabase/schema.sql"), "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const data = await res.json();
if (!res.ok) {
  console.error("Schema failed:", JSON.stringify(data, null, 2));
} else {
  console.log("✓ Schema applied successfully");
}
