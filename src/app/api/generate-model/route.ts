import { NextRequest, NextResponse } from "next/server";
import { generateModelPhoto } from "@/lib/ai/gemini";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { createProject, updateProject, getProject } from "@/lib/projects";
import { uploadOutputImage, getSignedUrl } from "@/lib/storage";
import { createVersion } from "@/lib/versions";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeMime } from "@/lib/api/mime";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/api/constants";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { allowed, remaining } = checkRateLimit(user.id, 100, "generate-model");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Up to 100 model generations per hour." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const frontFile = formData.get("front") as File | null;
  const backFile = formData.get("back") as File | null;
  const sideFile = formData.get("side") as File | null;
  const projectName   = (formData.get("projectName")   as string) || "Model Photo";
  const variant       = (formData.get("variant")       as "blonde" | "brunette") || "blonde";
  const sceneType     = (formData.get("sceneType")     as "photoshoot" | "lifestyle") || "photoshoot";
  const poseIndex     = Math.min(7, Math.max(0, parseInt((formData.get("poseIndex") as string) || "0", 10)));
  const keywordsRaw   = (formData.get("keywords")      as string) || "";
  const keywords      = keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean);
  const ghostProjectId = formData.get("ghostProjectId") as string | null;
  const collectionId   = formData.get("collectionId")   as string | null;
  const extraPrompt    = (formData.get("extraPrompt")   as string) || "";

  // Validate that we have either uploaded files or a ghostProjectId
  if (!ghostProjectId && (!frontFile || !backFile)) {
    return NextResponse.json({ error: "Front and back images are required." }, { status: 400 });
  }

  if (!["blonde", "brunette"].includes(variant)) {
    return NextResponse.json({ error: "variant must be 'blonde' or 'brunette'." }, { status: 400 });
  }

  if (!["photoshoot", "lifestyle"].includes(sceneType)) {
    return NextResponse.json({ error: "sceneType must be 'photoshoot' or 'lifestyle'." }, { status: 400 });
  }

  // Validate uploaded files only when they are provided (not ghost path)
  if (!ghostProjectId) {
    const allFiles = [frontFile!, backFile!, ...(sideFile ? [sideFile] : [])];
    for (const file of allFiles) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Use JPG, PNG, or WebP.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `${file.name} exceeds 10 MB.` }, { status: 400 });
      }
    }
  }

  const workspace = await getEffectiveWorkspace();

  try {
    const buffers: Buffer[] = [];
    const mimeTypes: string[] = [];

    if (ghostProjectId && (!frontFile || !backFile)) {
      // Load images from the ghost project in storage
      const ghostProject = await getProject(ghostProjectId);
      if (!ghostProject) {
        return NextResponse.json({ error: "Ghost project not found" }, { status: 404 });
      }

      const adminStorage = createSupabaseAdminClient().storage;

      // Try to use original input images first (front/back/side separately)
      if (ghostProject.input_images?.length >= 2) {
        for (const inputPath of ghostProject.input_images) {
          const { data } = await adminStorage.from("ghost-inputs").download(inputPath);
          if (data) {
            buffers.push(Buffer.from(await data.arrayBuffer()));
            const ext = inputPath.split(".").pop()?.toLowerCase();
            mimeTypes.push(
              ext === "jpg" || ext === "jpeg" ? "image/jpeg"
              : ext === "webp" ? "image/webp"
              : "image/png"
            );
          }
        }
      }

      // Fallback: use composite output image as garment reference
      if (buffers.length === 0 && ghostProject.output_image) {
        const { data } = await adminStorage.from("ghost-outputs").download(ghostProject.output_image);
        if (data) {
          buffers.push(Buffer.from(await data.arrayBuffer()));
          const ext = ghostProject.output_image.split(".").pop()?.toLowerCase();
          mimeTypes.push(
            ext === "jpg" || ext === "jpeg" ? "image/jpeg"
            : ext === "webp" ? "image/webp"
            : "image/png"
          );
        }
      }

      if (buffers.length === 0) {
        return NextResponse.json({ error: "Could not load ghost project images." }, { status: 500 });
      }
    } else {
      // Normal upload path
      const allFiles = [frontFile!, backFile!, ...(sideFile ? [sideFile] : [])];
      for (const file of allFiles) {
        buffers.push(Buffer.from(await file.arrayBuffer()));
        mimeTypes.push(normalizeMime(file.type));
      }
    }

    const { imageBuffer, mimeType: rawMimeType, inputTokens, outputTokens } = await generateModelPhoto(
      buffers,
      mimeTypes,
      variant,
      poseIndex,
      sceneType,
      keywords,
      workspace?.gemini_api_key,
      extraPrompt || undefined
    );
    // Normalize Gemini's output mimeType — it can include parameters or non-standard values
    const mimeType = normalizeMime(rawMimeType);

    // Generation succeeded — create project record now
    const project = await createProject(projectName, collectionId ?? undefined);

    const ext = mimeType.replace("image/", "");
    const outputPath = await uploadOutputImage(
      imageBuffer,
      `model_${variant}_${Date.now()}.${ext}`,
      mimeType,
      project.id
    );

    const outputUrl = await getSignedUrl("ghost-outputs", outputPath, 86400);

    await updateProject(project.id, {
      status: "completed",
      output_image: outputPath,
      prompt_used: `model-${variant}`,
    });
    await updateProject(project.id, { input_tokens: inputTokens, output_tokens: outputTokens }).catch(() => {});

    const version = await createVersion(
      project.id,
      outputPath,
      `Model photo – ${variant}`,
      undefined,
      "ai"
    );

    return NextResponse.json({
      projectId: project.id,
      outputUrl,
      outputPath,
      mimeType,
      versionNumber: version.version_number,
      variant,
      collectionId,
      rateLimitRemaining: remaining,
    });
  } catch (err: unknown) {
    console.error("[generate-model]", err);
    return NextResponse.json(
      { error: "Model photo generation failed. Please try again." },
      { status: 500 }
    );
  }
}
