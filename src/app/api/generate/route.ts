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
import { appendFileSync } from "fs";

function dbg(...args: unknown[]) {
  const line = `[generate ${new Date().toISOString()}] ${args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")}\n`;
  process.stdout.write(line);
  try { appendFileSync("/tmp/generate-debug.log", line); } catch { /* ignore */ }
}

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
  dbg("POST /api/generate received, user:", user?.id ?? "null");
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
    // Gemini API only accepts image/jpeg, image/png, image/webp — strip params and normalize
    const base = type.split(";")[0].trim().toLowerCase();
    if (base === "image/jpg" || base === "image/pjpeg") return "image/jpeg";
    return base;
  }

  const workspace = await getWorkspace();

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

    // Upload input images and store their paths
    _step = "uploadInputs";
    const inputNames = ["front", "back", "side"];
    const inputPaths: string[] = [];
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

    // Load workspace memories and build prompt
    _step = "loadMemories";
    const memories = workspace ? await listWorkspaceMemories(workspace.id) : [];
    const memoryBlock = buildMemoryPromptBlock(memories);
    const effectiveRefinePrompt = memoryBlock
      ? (refinePrompt ? `${refinePrompt}\n${memoryBlock}` : memoryBlock.trim())
      : refinePrompt;

    // Generate image
    _step = "geminiGenerate";
    dbg("mimeTypes sent to Gemini:", mimeTypes);
    const { imageBuffer, mimeType: rawMimeType, inputTokens, outputTokens } = await generateGhostMannequin(
      buffers,
      mimeTypes,
      workspace?.gemini_api_key,
      effectiveRefinePrompt
    );
    dbg("Gemini rawMimeType:", rawMimeType);
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
    dbg(`FAILED at step="${_step}"`, err instanceof Error ? err.message : String(err));
    if (err instanceof Error) dbg("stack:", err.stack ?? "no stack");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
