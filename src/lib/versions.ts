import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import type { ProjectVersion, ProjectVersionWithUrl } from "@/types";

export async function createVersion(
  projectId: string,
  outputImage: string,
  description: string,
  feedback?: string,
  createdBy: "user" | "ai" = "user"
): Promise<ProjectVersion> {
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("project_versions")
    .select("version_number")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextVersion = existing && existing.length > 0 ? existing[0].version_number + 1 : 1;

  const { data, error } = await supabase
    .from("project_versions")
    .insert({
      project_id: projectId,
      version_number: nextVersion,
      output_image: outputImage,
      feedback: feedback ?? null,
      created_by: createdBy,
      description,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ProjectVersion;
}

export async function listVersions(projectId: string): Promise<ProjectVersionWithUrl[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("project_versions")
    .select("*")
    .eq("project_id", projectId)
    .order("version_number", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return Promise.all(
    (data as ProjectVersion[]).map(async (v) => ({
      ...v,
      output_image_url: await getSignedUrl("ghost-outputs", v.output_image, 86400),
      output_image_thumb_url: await getSignedUrl("ghost-outputs", v.output_image, 86400, {
        transform: {
          width: 160,
          height: 160,
          resize: "contain",
          quality: 70,
        },
      }),
    }))
  );
}
