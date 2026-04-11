import { createSupabaseAdminClient } from "./supabase/server";

export interface WorkspaceMemory {
  id: string;
  workspace_id: string;
  note: string;
  created_at: string;
}

export async function listWorkspaceMemories(workspaceId: string): Promise<WorkspaceMemory[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspace_memories")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return (data ?? []) as WorkspaceMemory[];
}

export async function addWorkspaceMemory(workspaceId: string, note: string): Promise<WorkspaceMemory> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("workspace_memories")
    .insert({ workspace_id: workspaceId, note: note.trim().slice(0, 500) })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as WorkspaceMemory;
}

export async function deleteWorkspaceMemory(id: string, workspaceId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("workspace_memories")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);
}

