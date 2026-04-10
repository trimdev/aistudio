"use server";

import { getServerUser, createSupabaseAdminClient } from "./supabase/server";
import { getEffectiveWorkspace } from "./workspace";
import { getSignedUrl } from "./storage";
import type { Project, ProjectWithUrls } from "@/types";

const admin = () => createSupabaseAdminClient();

async function signUrl(
  bucket: string,
  path: string,
  variant: "full" | "thumb" = "full"
): Promise<string> {
  return getSignedUrl(
    bucket,
    path,
    60 * 60,
    variant === "thumb"
      ? {
        transform: {
          width: 600,
          height: 600,
          resize: "contain",
          quality: 90,
        },
      }
      : undefined
  );
}

async function enrichProject(project: Project): Promise<ProjectWithUrls> {
  const input_image_urls: string[] = [];
  const output_image_url = project.output_image
    ? await signUrl("ghost-outputs", project.output_image, "thumb")
    : null;
  const output_image_full_url = project.output_image
    ? await signUrl("ghost-outputs", project.output_image, "full")
    : null;
  return { ...project, input_image_urls, output_image_url, output_image_full_url };
}

export async function listProjects(): Promise<ProjectWithUrls[]> {
  const user = await getServerUser();
  if (!user) return [];

  const workspace = await getEffectiveWorkspace();

  const { data, error } = await admin()
    .from("projects")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return Promise.all((data as Project[]).map(enrichProject));
}

export async function getProject(id: string): Promise<ProjectWithUrls | null> {
  const workspace = await getEffectiveWorkspace();
  const { data } = await admin()
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();
  if (!data) return null;
  return enrichProject(data as Project);
}

export async function createProject(name: string, collectionId?: string | null): Promise<Project> {
  const workspace = await getEffectiveWorkspace();
  const { data, error } = await admin()
    .from("projects")
    .insert({ workspace_id: workspace.id, name, status: "pending", collection_id: collectionId ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, "status" | "input_images" | "output_image" | "prompt_used" | "input_tokens" | "output_tokens">>
): Promise<void> {
  await admin().from("projects").update(updates).eq("id", id);
}

export async function listProjectsByCollection(collectionId: string): Promise<ProjectWithUrls[]> {
  const workspace = await getEffectiveWorkspace();
  const { data, error } = await admin()
    .from("projects")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("collection_id", collectionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all((data as Project[]).map(enrichProject));
}

export async function deleteProject(id: string): Promise<void> {
  const workspace = await getEffectiveWorkspace();
  await admin()
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
}
