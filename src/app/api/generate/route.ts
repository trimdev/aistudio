import { NextRequest, NextResponse } from "next/server";
import { generateGhostMannequin, MODEL_INFO } from "@/lib/ai/gemini";
import { uploadInputImage } from "@/lib/storage";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { createProject, updateProject } from "@/lib/projects";
import { uploadOutputImage, getSignedUrl } from "@/lib/storage";
import { createVersion } from "@/lib/versions";
import { getServerUser } from "@/lib/supabase/server";
import { listWorkspaceMemories } from "@/lib/workspace-memory";
import { buildMemoryPromptBlock } from "@/lib/memory-utils";
import { createCollection, touchCollection } from "@/lib/collections";
import { normalizeMime } from "@/lib/api/mime";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/api/constants";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { allowed, remaining } = checkRateLimit(user.id, 20, "generate");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Up to 20 generations per hour." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const frontFile = formData.get("front") as File | null;
  const backFile = formData.get("back") as File | null;
  const sideFile = formData.get("side") as File | null;
  const projectName = (formData.get("projectName") as string) || "Névtelen fotó";
  const refinePrompt = (formData.get("refinePrompt") as string) || undefined;
  const collectionId = (formData.get("collectionId") as string) || null;

  if (!frontFile || !backFile) {
    return NextResponse.json({ error: "Front and back images are required." }, { status: 400 });
  }

  const allFiles = [frontFile, backFile, ...(sideFile ? [sideFile] : [])];

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

  const workspace = await getEffectiveWorkspace();

  // Resolve or create a collection for this generation
  let resolvedCollectionId = collectionId;
  if (!resolvedCollectionId) {
    const col = await createCollection(projectName);
    resolvedCollectionId = col.id;
  }

  const project = await createProject(projectName, resolvedCollectionId);

  let _step = "init";
  try {
    _step = "updateProcessing";
    await updateProject(project.id, { status: "processing" });

    // Upload inputs
    _step = "readFiles";
    const buffers: Buffer[] = [];
    const mimeTypes: string[] = [];

    for (const file of allFiles) {
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = normalizeMime(file.type);
      buffers.push(buf);
      mimeTypes.push(mime);
    }

    // Upload input images (best-effort — do not block generation if this fails)
    _step = "uploadInputs";
    const inputNames = ["front", "back", "side"];
    const inputPaths: string[] = [];
    try {
      for (let i = 0; i < allFiles.length; i++) {
        const normalizedMime = normalizeMime(allFiles[i].type);
        const ext = normalizedMime.replace("image/", "").replace("jpeg", "jpg");
        const path = await uploadInputImage(
          buffers[i],
          `${inputNames[i]}.${ext}`,
          normalizedMime,
          project.id
        );
        inputPaths.push(path);
      }
      await updateProject(project.id, { input_images: inputPaths });
    } catch { /* non-fatal */ }

    // Load workspace memories and build prompt
    _step = "loadMemories";
    const memories = await listWorkspaceMemories(workspace.id).catch(() => []);
    const memoryBlock = buildMemoryPromptBlock(memories);

    // Generate image — memory block passed as separate param, not mixed into refinePrompt
    _step = "geminiGenerate";
    const { imageBuffer, mimeType: rawMimeType, inputTokens, outputTokens } = await generateGhostMannequin(
      buffers,
      mimeTypes,
      workspace?.gemini_api_key,
      refinePrompt,
      memoryBlock
    );
    // Normalize Gemini's output mimeType — it can include parameters or non-standard values
    const mimeType = normalizeMime(rawMimeType);

    // Upload output
    _step = "uploadOutput";
    const ext = mimeType.replace("image/", "");
    const outputPath = await uploadOutputImage(
      imageBuffer,
      `ghost_${Date.now()}.${ext}`,
      mimeType,
      project.id
    );

    _step = "getSignedUrl";
    const outputUrl = await getSignedUrl("ghost-outputs", outputPath, 86400);

    _step = "updateCompleted";
    await updateProject(project.id, {
      status: "completed",
      output_image: outputPath,
      prompt_used: MODEL_INFO.id,
    });
    // Token tracking is best-effort — don't fail the generation if columns are missing
    await updateProject(project.id, { input_tokens: inputTokens, output_tokens: outputTokens }).catch(() => {});

    // Log the initial version
    _step = "createVersion";
    const version = await createVersion(
      project.id,
      outputPath,
      "Initial generation",
      undefined,
      "ai"
    );

    _step = "touchCollection";
    await touchCollection(resolvedCollectionId);
    return NextResponse.json({ projectId: project.id, collectionId: resolvedCollectionId, outputUrl, outputPath, mimeType, versionNumber: version.version_number, rateLimitRemaining: remaining });
  } catch (err: unknown) {
    await updateProject(project.id, { status: "failed" }).catch(() => {});
    return NextResponse.json(
      { error: err instanceof Error ? (err.name !== "Error" ? err.toString() : err.message) : String(err) },
      { status: 500 }
    );
  }
}
