/**
 * Creates the Omnitrade client user and workspace.
 *
 *   node scripts/create-omnitrade.mjs
 *
 * Credentials:
 *   Email:    info@omnitrade.hu
 *   Password: OmniTrade2025!
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const get = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const supabase = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const EMAIL = "info@omnitrade.hu";
const PASSWORD = "OmniTrade2025!";
const WORKSPACE_NAME = "Omnitrade";

const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: "Omnitrade" },
});

let userId;

if (userErr) {
  if (userErr.message.includes("already been registered")) {
    console.log(`ℹ️  User ${EMAIL} already exists.`);
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === EMAIL);
    if (!existing) { console.error("✗ Could not find existing user."); process.exit(1); }
    userId = existing.id;
    console.log("   User ID:", userId);
  } else {
    console.error("✗ User creation failed:", userErr.message);
    process.exit(1);
  }
} else {
  userId = userData.user.id;
  console.log("✓ User created:", EMAIL);
  console.log("  User ID:", userId);
}

// Ensure workspace
const { data: existing } = await supabase
  .from("workspaces")
  .select("id, name")
  .eq("user_id", userId)
  .single();

if (existing) {
  console.log(`ℹ️  Workspace already exists: "${existing.name}" (${existing.id})`);
} else {
  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .insert({ user_id: userId, name: WORKSPACE_NAME })
    .select()
    .single();

  if (wsErr) {
    console.error("✗ Workspace creation failed:", wsErr.message);
    console.log("  → Make sure you've run src/lib/supabase/schema.sql in the Supabase SQL Editor first.");
    process.exit(1);
  }
  console.log(`✓ Workspace "${WORKSPACE_NAME}" created:`, ws.id);
}

console.log("\n──────────────────────────────────────");
console.log("  Omnitrade login credentials:");
console.log(`  Email:    ${EMAIL}`);
console.log(`  Password: ${PASSWORD}`);
console.log("──────────────────────────────────────\n");
