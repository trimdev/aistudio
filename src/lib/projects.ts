"use server";

import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "./supabase/server";
import { getOrCreateWorkspace } from "./workspace";
import type { Project, ProjectWithUrls } from "@/types";

const admin = () => createSupabaseAdminClient();

function storagePath(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/sign/${path}`;
}

async function signUrl(bucket: string, path: string): Promise<string> {
  const { data } = await admin()
    .storage.from(bucket)
    .createSignedUrl(path, 60 * 60); // 1 hour
  return data?.signedUrl ?? "";
}

async function enrichProject(project: Project): Promise<ProjectWithUrls> {
  const input_image_urls = await Promise.all(
    project.input_images.map((p) => signUrl("ghost-inputs", p))
  );
  const output_image_url = project.output_image
    ? await signUrl("ghost-outputs", project.output_image)
    : null;
  return { ...project, input_image_urls, output_image_url };
}

export async function listProjects(): Promise<ProjectWithUrls[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const workspace = await getOrCreateWorkspace();

  const { data, error } = await admin()
    .from("projects")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return Promise.all((data as Project[]).map(enrichProject));
}

export async function getProject(id: string): Promise<ProjectWithUrls | null> {
  const workspace = await getOrCreateWorkspace();
  const { data } = await admin()
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();
  if (!data) return null;
  return enrichProject(data as Project);
}

export async function createProject(name: string): Promise<Project> {
  const workspace = await getOrCreateWorkspace();
  const { data, error } = await admin()
    .from("projects")
    .insert({ workspace_id: workspace.id, name, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, "status" | "input_images" | "output_image" | "prompt_used">>
): Promise<void> {
  await admin().from("projects").update(updates).eq("id", id);
}

export async function deleteProject(id: string): Promise<void> {
  const workspace = await getOrCreateWorkspace();
  await admin()
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
}
