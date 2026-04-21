import { NextRequest, NextResponse } from "next/server";
import { generateFurnitureLifestyle, FURNITURE_MODEL_INFO } from "@/lib/ai/gemini-furniture";
import { uploadOutputImage, getSignedUrl } from "@/lib/storage";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { createProject, updateProject, getProject } from "@/lib/projects";
import { createVersion } from "@/lib/versions";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeMime } from "@/lib/api/mime";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/api/constants";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { allowed, remaining } = checkRateLimit(user.id, 30, "furniture-lifestyle");
  if (!allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

  const formData       = await req.formData();
  const frontFile      = formData.get("front")          as File | null;
  const angleFile      = formData.get("angle")          as File | null;
  const ghostProjectId = formData.get("ghostProjectId") as string | null;
  const sceneKey       = (formData.get("sceneKey")      as string) || "living_modern";
  const withPeople     = formData.get("withPeople") === "true";
  const projectName    = (formData.get("projectName")   as string) || "Bútor életkép";
  const collectionId   = (formData.get("collectionId")  as string) || null;

  if (!ghostProjectId && !frontFile) {
    return NextResponse.json({ error: "Front image or ghost project ID is required." }, { status: 400 });
  }

  const workspace = await getEffectiveWorkspace();

  try {
    const buffers: Buffer[]   = [];
    const mimeTypes: string[] = [];

    if (ghostProjectId) {
      // Load reference images from ghost project
      const ghostProject = await getProject(ghostProjectId);
      if (!ghostProject) return NextResponse.json({ error: "Ghost project not found." }, { status: 404 });

      const adminStorage = createSupabaseAdminClient().storage;

      if (ghostProject.input_images?.length >= 1) {
        for (const path of ghostProject.input_images) {
          const { data } = await adminStorage.from("ghost-inputs").download(path);
          if (data) {
            buffers.push(Buffer.from(await data.arrayBuffer()));
            const ext = path.split(".").pop()?.toLowerCase() ?? "jpg";
            mimeTypes.push(ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png");
          }
        }
      }
      // Fallback: use ghost output image itself as reference
      if (buffers.length === 0 && ghostProject.output_image) {
        const { data } = await adminStorage.from("ghost-outputs").download(ghostProject.output_image);
        if (data) {
          buffers.push(Buffer.from(await data.arrayBuffer()));
          const ext = ghostProject.output_image.split(".").pop()?.toLowerCase() ?? "jpg";
          mimeTypes.push(ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png");
        }
      }
      if (buffers.length === 0) {
        return NextResponse.json({ error: "Could not load reference images from ghost project." }, { status: 500 });
      }
    } else {
      const allFiles = [frontFile!, ...(angleFile ? [angleFile] : [])];
      for (const f of allFiles) {
        if (!ALLOWED_IMAGE_TYPES.includes(f.type as typeof ALLOWED_IMAGE_TYPES[number]))
          return NextResponse.json({ error: `Unsupported file type: ${f.type}` }, { status: 400 });
        if (f.size > MAX_FILE_SIZE)
          return NextResponse.json({ error: `${f.name} exceeds 10 MB.` }, { status: 400 });
        buffers.push(Buffer.from(await f.arrayBuffer()));
        mimeTypes.push(normalizeMime(f.type));
      }
    }

    const { imageBuffer, mimeType: rawMime, inputTokens, outputTokens } =
      await generateFurnitureLifestyle(buffers, mimeTypes, sceneKey, withPeople, workspace?.gemini_api_key);

    const mimeType  = normalizeMime(rawMime);
    const project   = await createProject(projectName, collectionId ?? undefined);
    const ext       = mimeType.replace("image/", "");
    const outputPath = await uploadOutputImage(
      imageBuffer, `furniture_lifestyle_${Date.now()}.${ext}`, mimeType, project.id
    );
    const outputUrl = await getSignedUrl("ghost-outputs", outputPath, 86400);

    await updateProject(project.id, {
      status: "completed", output_image: outputPath,
      prompt_used: `furniture-lifestyle-${sceneKey}`,
    });
    await updateProject(project.id, { input_tokens: inputTokens, output_tokens: outputTokens }).catch(() => {});

    const version = await createVersion(
      project.id, outputPath,
      `Furniture lifestyle — ${sceneKey}${withPeople ? " (with people)" : ""}`,
      undefined, "ai"
    );

    return NextResponse.json({
      projectId: project.id, collectionId,
      outputUrl, outputPath, mimeType,
      versionNumber: version.version_number,
      sceneKey, withPeople,
      model: FURNITURE_MODEL_INFO.id,
      rateLimitRemaining: remaining,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? (err.name !== "Error" ? err.toString() : err.message) : String(err) },
      { status: 500 }
    );
  }
}
