import { NextRequest, NextResponse } from "next/server";
import { generateDesignModelPhoto } from "@/lib/ai/gemini";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { createProject, updateProject, getProject } from "@/lib/projects";
import { uploadOutputImage, getSignedUrl } from "@/lib/storage";
import { createVersion } from "@/lib/versions";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { DESIGN_MODELS, DESIGN_BACKGROUNDS, DESIGN_POSES, buildDesignModelPrompt } from "@/lib/design-model-data";
import fs from "fs";
import path from "path";
import { normalizeMime } from "@/lib/api/mime";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/api/constants";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { allowed, remaining } = checkRateLimit(user.id, 100, "generate-design-model");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Up to 100 design model generations per hour." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const frontFile     = formData.get("front")           as File | null;
  const backFile      = formData.get("back")            as File | null;
  const sideFile      = formData.get("side")            as File | null;
  const ghostProjectId = formData.get("ghostProjectId") as string | null;
  const modelId       = formData.get("modelId")         as string | null;
  const backgroundId  = formData.get("backgroundId") as string | null;
  const poseId        = formData.get("poseId")       as string | null;
  const projectName   = (formData.get("projectName") as string) || "Design Model Photo";
  const collectionId  = formData.get("collectionId") as string | null;
  const extraPrompt   = (formData.get("extraPrompt") as string) || "";
  const seriesIndexRaw  = formData.get("seriesIndex")  as string | null;
  const seriesTotalRaw  = formData.get("seriesTotal")   as string | null;
  const existingProjectId = formData.get("existingProjectId") as string | null;

  if (!frontFile && !ghostProjectId) {
    return NextResponse.json({ error: "Front image or ghostProjectId is required." }, { status: 400 });
  }

  if (!modelId || !backgroundId || !poseId) {
    return NextResponse.json(
      { error: "modelId, backgroundId, and poseId are required." },
      { status: 400 }
    );
  }

  if (frontFile) {
    const allFiles = [frontFile, ...(backFile ? [backFile] : []), ...(sideFile ? [sideFile] : [])];
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

  const model      = DESIGN_MODELS.find((m) => m.id === modelId);
  const background = DESIGN_BACKGROUNDS.find((b) => b.id === backgroundId);
  const pose       = DESIGN_POSES.find((p) => p.id === poseId);

  if (!model || !background || !pose) {
    return NextResponse.json(
      { error: "Invalid modelId, backgroundId, or poseId. Check the design catalogues." },
      { status: 400 }
    );
  }

  const workspace = await getEffectiveWorkspace();

  try {
    const buffers: Buffer[]  = [];
    const mimeTypes: string[] = [];

    if (ghostProjectId && !frontFile) {
      // Load garment images from the ghost project stored in Supabase
      const ghostProject = await getProject(ghostProjectId);
      if (!ghostProject) {
        return NextResponse.json({ error: "Ghost project not found" }, { status: 404 });
      }
      const adminStorage = createSupabaseAdminClient().storage;

      // Prefer individual input images (front/back/side) if available
      if (ghostProject.input_images?.length >= 1) {
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

      // Fallback: use composite output image
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
      const uploadedFiles = [frontFile!, ...(backFile ? [backFile] : []), ...(sideFile ? [sideFile] : [])];
      for (const file of uploadedFiles) {
        buffers.push(Buffer.from(await file.arrayBuffer()));
        mimeTypes.push(normalizeMime(file.type));
      }
    }

    const seriesIndex = seriesIndexRaw !== null ? parseInt(seriesIndexRaw, 10) : null;
    const seriesTotal = seriesTotalRaw !== null ? parseInt(seriesTotalRaw, 10) : null;
    const seriesInfo = seriesIndex !== null && seriesTotal !== null && seriesTotal > 1
      ? { index: seriesIndex, total: seriesTotal }
      : undefined;
    const prompt = buildDesignModelPrompt(model, background, pose, extraPrompt || undefined, seriesInfo);

    // Load pre-generated portrait for this model as appearance reference
    let portraitBuffer: Buffer | null = null;
    let portraitMime: string | null = null;
    for (const ext of ["png", "jpg", "jpeg", "webp"]) {
      const portraitPath = path.join(process.cwd(), "public", "models", `${model.id}.${ext}`);
      if (fs.existsSync(portraitPath)) {
        portraitBuffer = fs.readFileSync(portraitPath);
        portraitMime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
        break;
      }
    }

    const { imageBuffer, mimeType: rawMimeType, inputTokens, outputTokens } =
      await generateDesignModelPhoto(buffers, mimeTypes, prompt, workspace?.gemini_api_key, portraitBuffer, portraitMime);

    const mimeType = normalizeMime(rawMimeType);

    // Generation succeeded — use existing project or create new one
    const project = existingProjectId
      ? { id: existingProjectId }
      : await createProject(projectName, collectionId ?? undefined);

    const ext = mimeType.replace("image/", "");
    const outputPath = await uploadOutputImage(
      imageBuffer,
      `design_model_${Date.now()}.${ext}`,
      mimeType,
      project.id
    );

    const outputUrl = await getSignedUrl("ghost-outputs", outputPath, 86400);

    if (!existingProjectId) {
      await updateProject(project.id, {
        status: "completed",
        output_image: outputPath,
        prompt_used: `design-model-${modelId}`,
      });
    }
    await updateProject(project.id, { input_tokens: inputTokens, output_tokens: outputTokens }).catch(() => {});

    const version = await createVersion(
      project.id,
      outputPath,
      `Design model photo – ${model.name}`,
      undefined,
      "ai"
    );

    return NextResponse.json({
      projectId: project.id,
      outputUrl,
      outputPath,
      mimeType,
      versionNumber: version.version_number,
      collectionId,
      rateLimitRemaining: remaining,
    });
  } catch (err: unknown) {
    console.error("[generate-design-model]", err);
    return NextResponse.json(
      { error: err instanceof Error ? (err.name !== "Error" ? err.toString() : err.message) : String(err) },
      { status: 500 }
    );
  }
}
