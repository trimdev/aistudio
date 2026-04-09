"use server";

import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "./supabase/server";
import type { Workspace } from "@/types";

/**
 * Gets or creates a workspace for the currently signed-in Clerk user.
 * Uses the admin client so it bypasses RLS (we validate identity via Clerk).
 */
export async function getOrCreateWorkspace(): Promise<Workspace> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const admin = createSupabaseAdminClient();

  const { data: existing, error: selectErr } = await admin
    .from("workspaces")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();

  if (existing) return existing as Workspace;
  if (selectErr && selectErr.code !== "PGRST116") throw selectErr;

  const { data: created, error: insertErr } = await admin
    .from("workspaces")
    .insert({ clerk_user_id: userId, name: "My Workspace" })
    .select()
    .single();

  if (insertErr) throw insertErr;
  return created as Workspace;
}

export async function getWorkspace(): Promise<Workspace | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspaces")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();

  return (data as Workspace) ?? null;
}
