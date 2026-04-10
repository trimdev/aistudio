import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
const get = (key) => env.match(new RegExp(`^${key}=(.+)$`, "m"))?.[1]?.trim();

const supabase = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

// Get the user
const { data: list } = await supabase.auth.admin.listUsers();
const user = list?.users?.find((u) => u.email === "mc@ghoststudio.ai");

if (!user) {
  console.error("User not found");
  process.exit(1);
}

console.log("User ID:", user.id);
console.log("Email confirmed:", user.email_confirmed_at ? "yes" : "no");
console.log("Last sign in:", user.last_sign_in_at || "never");

// Force confirm + reset password
const { error } = await supabase.auth.admin.updateUserById(user.id, {
  email_confirm: true,
  password: "GhostMC2025!",
});

if (error) {
  console.error("Update failed:", error.message);
} else {
  console.log("✓ Email confirmed and password reset to: GhostMC2025!");
}
