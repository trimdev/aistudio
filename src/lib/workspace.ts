"use server";

import { cookies } from "next/headers";
import { getServerUser, createSupabaseAdminClient } from "./supabase/server";
import type { Workspace } from "@/types";

export async function getOrCreateWorkspace(): Promise<Workspace> {
  const user = await getServerUser();
  if (!user) throw new Error("Unauthenticated");

  const admin = createSupabaseAdminClient();

  const { data: existing, error: selectErr } = await admin
    .from("workspaces")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (existing) return existing as Workspace;
  if (selectErr && selectErr.code !== "PGRST116") throw selectErr;

  const { data: created, error: insertErr } = await admin
    .from("workspaces")
    .insert({ user_id: user.id, name: "My Workspace" })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return created as Workspace;
}

export async function getWorkspace(): Promise<Workspace | null> {
  const user = await getServerUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspaces")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return (data as Workspace) ?? null;
}

/**
 * Like getOrCreateWorkspace(), but if the current user is an admin with an
 * active impersonation cookie (gs-view-ws), returns the target workspace
 * instead of the admin's own. Used by all studio data-fetching functions.
 */
export async function getEffectiveWorkspace(): Promise<Workspace> {
  const user = await getServerUser();
  if (!user) throw new Error("Unauthenticated");

  const supabase = createSupabaseAdminClient();

  // Get the user's own workspace (must exist for role check)
  const { data: ownWs } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!ownWs) return getOrCreateWorkspace();

  // Admin impersonation: if cookie is set, return the target workspace
  if ((ownWs as Workspace).role === "admin") {
    const cookieStore = await cookies();
    const viewWsId = cookieStore.get("gs-view-ws")?.value;
    if (viewWsId) {
      const { data: targetWs } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", viewWsId)
        .single();
      if (targetWs) return targetWs as Workspace;
    }
  }

  return ownWs as Workspace;
}

/** Returns the workspace ID being viewed (impersonated), or null. */
export async function getImpersonatedWorkspace(): Promise<Workspace | null> {
  const user = await getServerUser();
  if (!user) return null;

  const supabase = createSupabaseAdminClient();
  const { data: ownWs } = await supabase
    .from("workspaces")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!ownWs || (ownWs as { role: string }).role !== "admin") return null;

  const cookieStore = await cookies();
  const viewWsId = cookieStore.get("gs-view-ws")?.value;
  if (!viewWsId) return null;

  const { data: targetWs } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", viewWsId)
    .single();

  return (targetWs as Workspace) ?? null;
}
