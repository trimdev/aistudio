import { NextRequest, NextResponse } from "next/server";
import { generateGhostMannequin, MODEL_INFO } from "@/lib/ai/gemini";
import { uploadInputImage } from "@/lib/storage";
import { getWorkspace } from "@/lib/workspace";
import { createProject, updateProject } from "@/lib/projects";
import { uploadOutputImage, getSignedUrl } from "@/lib/storage";
import { createVersion } from "@/lib/versions";
import { getServerUser } from "@/lib/supabase/server";
import { listWorkspaceMemories } from "@/lib/workspace-memory";
import { buildMemoryPromptBlock } from "@/lib/memory-utils";
import { createCollection, touchCollection } from "@/lib/collections";

export const maxDuration = 300;

// ─── Rate limiting ────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  if (entry.count >= RATE_LIMIT) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { allowed, remaining } = checkRateLimit(user.id);
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
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  for (const file of allFiles) {
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Use JPG, PNG, or WebP.` },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: `${file.name} exceeds 10 MB.` }, { status: 400 });
    }
  }

  function normalizeMime(type: string): string {
    // Gemini API requires image/jpeg — image/jpg is non-standard and will fail pattern validation
    return type === "image/jpg" ? "image/jpeg" : type;
  }

  const workspace = await getWorkspace();

  // Resolve or create a collection for this generation
  let resolvedCollectionId = collectionId;
  if (!resolvedCollectionId) {
    const col = await createCollection(projectName);
    resolvedCollectionId = col.id;
  }

  const project = await createProject(projectName, resolvedCollectionId);

  try {
    await updateProject(project.id, { status: "processing" });

    // Upload inputs
    const buffers: Buffer[] = [];
    const mimeTypes: string[] = [];

    for (const file of allFiles) {
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = normalizeMime(file.type);
      buffers.push(buf);
      mimeTypes.push(mime);
    }

    // Upload input images and store their paths
    const inputNames = ["front", "back", "side"];
    const inputPaths: string[] = [];
    for (let i = 0; i < allFiles.length; i++) {
      const ext = allFiles[i].type.replace("image/", "").replace("jpeg", "jpg");
      const path = await uploadInputImage(
        buffers[i],
        `${inputNames[i]}.${ext}`,
        normalizeMime(allFiles[i].type),
        project.id
      );
      inputPaths.push(path);
    }
    await updateProject(project.id, { input_images: inputPaths });

    // Load workspace memories and build prompt
    const memories = workspace ? await listWorkspaceMemories(workspace.id) : [];
    const memoryBlock = buildMemoryPromptBlock(memories);
    const effectiveRefinePrompt = memoryBlock
      ? (refinePrompt ? `${refinePrompt}\n${memoryBlock}` : memoryBlock.trim())
      : refinePrompt;

    // Generate image
    const { imageBuffer, mimeType, inputTokens, outputTokens } = await generateGhostMannequin(
      buffers,
      mimeTypes,
      workspace?.gemini_api_key,
      effectiveRefinePrompt
    );

    // Upload output
    const ext = mimeType.replace("image/", "");
    const outputPath = await uploadOutputImage(
      imageBuffer,
      `ghost_${Date.now()}.${ext}`,
      mimeType,
      project.id
    );

    const outputUrl = await getSignedUrl("ghost-outputs", outputPath, 86400);

    await updateProject(project.id, {
      status: "completed",
      output_image: outputPath,
      prompt_used: MODEL_INFO.id,
    });
    // Token tracking is best-effort — don't fail the generation if columns are missing
    await updateProject(project.id, { input_tokens: inputTokens, output_tokens: outputTokens }).catch(() => {});

    // Log the initial version
    const version = await createVersion(
      project.id,
      outputPath,
      "Initial generation",
      undefined,
      "ai"
    );

    await touchCollection(resolvedCollectionId);
    return NextResponse.json({ projectId: project.id, collectionId: resolvedCollectionId, outputUrl, outputPath, mimeType, versionNumber: version.version_number, rateLimitRemaining: remaining });
  } catch (err: unknown) {
    await updateProject(project.id, { status: "failed" }).catch(() => {});
    console.error("[generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
