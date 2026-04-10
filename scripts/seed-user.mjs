import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read .env.local
const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const get = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const supabase = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

// 1. Create user
const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
  email: "mc@ghoststudio.ai",
  password: "GhostMC2025!",
  email_confirm: true,
  user_metadata: { full_name: "MC" },
});

if (userErr) {
  if (userErr.message.includes("already been registered")) {
    console.log("ℹ️  User mc@ghoststudio.ai already exists.");
    // Fetch existing user
    const { data: list } = await supabase.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === "mc@ghoststudio.ai");
    if (existing) {
      console.log("   User ID:", existing.id);
      await ensureWorkspace(existing.id);
    }
  } else {
    console.error("✗ User creation failed:", userErr.message);
    process.exit(1);
  }
} else {
  const userId = userData.user.id;
  console.log("✓ User created:", userData.user.email);
  console.log("  User ID:", userId);
  await ensureWorkspace(userId);
}

async function ensureWorkspace(userId) {
  // Check if workspace exists
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("user_id", userId)
    .single();

  if (existing) {
    console.log("ℹ️  Workspace already exists:", existing.name, `(${existing.id})`);
    return;
  }

  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .insert({ user_id: userId, name: "MC" })
    .select()
    .single();

  if (wsErr) {
    console.error("✗ Workspace creation failed:", wsErr.message);
    console.log("  → Make sure you've run src/lib/supabase/schema.sql in the Supabase SQL Editor first.");
  } else {
    console.log("✓ Workspace 'MC' created:", ws.id);
  }
}
