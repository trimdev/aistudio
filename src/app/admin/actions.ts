"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";

export async function enterWorkspace(workspaceId: string) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspace();
  if (!workspace || workspace.role !== "admin") redirect("/studio");

  const cookieStore = await cookies();
  cookieStore.set("gs-view-ws", workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  });

  redirect("/studio");
}

export async function exitWorkspace() {
  const cookieStore = await cookies();
  cookieStore.delete("gs-view-ws");
  redirect("/admin");
}

const VALID_MODULES = ["fashion", "furniture", "ghost", "model", "moodboard", "design-model", "video"] as const;

export async function createWorkspace(
  formData: FormData
): Promise<{ error?: string; name?: string }> {
  const user = await getServerUser();
  if (!user) return { error: "Unauthenticated" };

  const workspace = await getWorkspace();
  if (!workspace || workspace.role !== "admin") return { error: "Forbidden" };

  const name     = (formData.get("name")     as string)?.trim();
  const email    = (formData.get("email")    as string)?.trim();
  const password = (formData.get("password") as string);
  const modules  = formData.getAll("modules") as string[];

  if (!name || !email || !password) return { error: "Minden mező kitöltése kötelező." };
  if (password.length < 8)          return { error: "A jelszónak legalább 8 karakter hosszúnak kell lennie." };

  const validModules = modules.filter((m) => (VALID_MODULES as readonly string[]).includes(m));

  const admin = createSupabaseAdminClient();

  // 1. Create the Supabase auth user
  const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip the confirmation email
  });

  if (authErr || !newUser.user) {
    return { error: authErr?.message ?? "Felhasználó létrehozása sikertelen." };
  }

  // 2. Create the workspace row
  const { error: wsErr } = await admin
    .from("workspaces")
    .insert({ user_id: newUser.user.id, name, modules: validModules });

  if (wsErr) {
    await admin.auth.admin.deleteUser(newUser.user.id).catch(console.error);
    return { error: wsErr.message };
  }

  revalidatePath("/admin");
  return { name };
}

export async function deleteWorkspace(
  workspaceId: string
): Promise<{ error?: string }> {
  const user = await getServerUser();
  if (!user) return { error: "Unauthenticated" };

  const workspace = await getWorkspace();
  if (!workspace || workspace.role !== "admin") return { error: "Forbidden" };

  const admin = createSupabaseAdminClient();

  const { data: ws } = await admin
    .from("workspaces")
    .select("user_id, role")
    .eq("id", workspaceId)
    .single();

  if (!ws) return { error: "Workspace not found." };
  if (ws.role === "admin") return { error: "Cannot delete an admin workspace." };

  // Delete in FK order: projects → collections → workspace → auth user
  await admin.from("projects").delete().eq("workspace_id", workspaceId);
  await admin.from("project_collections").delete().eq("workspace_id", workspaceId);
  await admin.from("workspaces").delete().eq("id", workspaceId);
  await admin.auth.admin.deleteUser(ws.user_id);

  revalidatePath("/admin");
  return {};
}

export async function setWorkspaceModules(workspaceId: string, modules: string[]) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspace();
  if (!workspace || workspace.role !== "admin") redirect("/studio");

  const validModules = modules.filter((m) => (VALID_MODULES as readonly string[]).includes(m));

  const admin = createSupabaseAdminClient();
  await admin
    .from("workspaces")
    .update({ modules: validModules })
    .eq("id", workspaceId);

  revalidatePath(`/admin/workspace/${workspaceId}`);
}
