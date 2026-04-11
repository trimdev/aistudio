import { getServerUser, createSupabaseAdminClient } from "./supabase/server";
import { getEffectiveWorkspace } from "./workspace";
import { getSignedUrl } from "./storage";
import type { ProjectCollection, ProjectCollectionWithMeta } from "@/types";

const admin = () => createSupabaseAdminClient();

/** Auto-migrate photos with no collection into a "Piszkozat" collection. */
async function migratOrphanedPhotos(workspaceId: string): Promise<void> {
  const { data: orphans } = await admin()
    .from("projects")
    .select("id")
    .eq("workspace_id", workspaceId)
    .is("collection_id", null);

  if (!orphans?.length) return;

  // Find or create the Piszkozat collection
  const { data: existing } = await admin()
    .from("project_collections")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", "Piszkozat")
    .maybeSingle();

  let draftId = existing?.id;

  if (!draftId) {
    const { data: created } = await admin()
      .from("project_collections")
      .insert({ workspace_id: workspaceId, name: "Piszkozat" })
      .select("id")
      .single();
    draftId = created?.id;
  }

  if (draftId) {
    await admin()
      .from("projects")
      .update({ collection_id: draftId })
      .eq("workspace_id", workspaceId)
      .is("collection_id", null);
  }
}

export async function listCollections(): Promise<ProjectCollectionWithMeta[]> {
  const user = await getServerUser();
  if (!user) return [];

  const workspace = await getEffectiveWorkspace();

  // One-time auto-migration: put pre-collections photos into "Piszkozat"
  await migratOrphanedPhotos(workspace.id);

  const { data: collections } = await admin()
    .from("project_collections")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  if (!collections?.length) return [];

  const { data: projects } = await admin()
    .from("projects")
    .select("id, collection_id, status, output_image, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .in("collection_id", collections.map((c) => c.id));

  const projectRows = projects ?? [];

  return Promise.all(
    (collections as ProjectCollection[]).map(async (col) => {
      const colProjects = projectRows.filter((p) => p.collection_id === col.id);
      const completed = colProjects.filter((p) => p.status === "completed");
      const latest = completed[0] ?? null;
      const thumbnailUrl = latest?.output_image
        ? await getSignedUrl("ghost-outputs", latest.output_image, 3600, {
            transform: { width: 400, height: 400, resize: "contain", quality: 72 },
          })
        : null;
      const lastActivity = colProjects[0]?.updated_at ?? col.updated_at;
      return {
        ...col,
        photoCount: colProjects.length,
        completedCount: completed.length,
        thumbnailUrl,
        lastActivity,
      };
    })
  );
}

export async function getCollection(id: string): Promise<ProjectCollection | null> {
  const workspace = await getEffectiveWorkspace();
  const { data } = await admin()
    .from("project_collections")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();
  return (data as ProjectCollection) ?? null;
}

export async function createCollection(name: string): Promise<ProjectCollection> {
  const workspace = await getEffectiveWorkspace();
  const { data, error } = await admin()
    .from("project_collections")
    .insert({ workspace_id: workspace.id, name: name.trim() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectCollection;
}

export async function touchCollection(id: string): Promise<void> {
  await admin()
    .from("project_collections")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deleteCollection(id: string): Promise<void> {
  const workspace = await getEffectiveWorkspace();
  const { error } = await admin()
    .from("project_collections")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) throw new Error(error.message);
}
