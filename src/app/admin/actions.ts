"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";

/** Admin enters a client workspace (sets impersonation cookie). */
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

/** Admin exits the impersonated workspace and returns to the admin dashboard. */
export async function exitWorkspace() {
  const cookieStore = await cookies();
  cookieStore.delete("gs-view-ws");
  redirect("/admin");
}

const VALID_MODULES = ["fashion", "furniture", "moodboard"] as const;

export async function setWorkspaceModules(workspaceId: string, modules: string[]) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspace();
  if (!workspace || workspace.role !== "admin") redirect("/studio");

  // Validate — only allow known module strings
  const validModules = modules.filter((m) => (VALID_MODULES as readonly string[]).includes(m));

  const admin = createSupabaseAdminClient();
  await admin
    .from("workspaces")
    .update({ modules: validModules })
    .eq("id", workspaceId);

  revalidatePath(`/admin/workspace/${workspaceId}`);
}
