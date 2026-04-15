import { NextRequest, NextResponse } from "next/server";
import { generateFurnitureGhostShot, FURNITURE_MODEL_INFO } from "@/lib/ai/gemini-furniture";
import { uploadInputImage, uploadOutputImage, getSignedUrl } from "@/lib/storage";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { createProject, updateProject } from "@/lib/projects";
import { createVersion } from "@/lib/versions";
import { getServerUser } from "@/lib/supabase/server";
import { createCollection, touchCollection } from "@/lib/collections";

export const maxDuration = 300;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT      = 20;
const RATE_WINDOW_MS  = 60 * 60 * 1000;

function checkRateLimit(userId: string) {
  const now   = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  if (entry.count >= RATE_LIMIT) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

function normalizeMime(type: string): string {
  const base = type.split(";")[0].trim().toLowerCase();
  if (base === "image/jpg" || base === "image/pjpeg") return "image/jpeg";
  return base;
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { allowed, remaining } = checkRateLimit(user.id);
  if (!allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

  const formData    = await req.formData();
  const frontFile   = formData.get("front")  as File | null;
  const angleFile   = formData.get("angle")  as File | null;
  const detailFile  = formData.get("detail") as File | null;
  const projectName = (formData.get("projectName") as string) || "Bútor fotó";
  const collectionId = (formData.get("collectionId") as string) || null;

  if (!frontFile) return NextResponse.json({ error: "Front image is required." }, { status: 400 });

  const allFiles    = [frontFile, ...(angleFile ? [angleFile] : []), ...(detailFile ? [detailFile] : [])];
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  for (const file of allFiles) {
    if (!allowedTypes.includes(file.type))
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ error: `${file.name} exceeds 10 MB.` }, { status: 400 });
  }

  const workspace = await getEffectiveWorkspace();

  let resolvedCollectionId = collectionId;
  if (!resolvedCollectionId) {
    const col = await createCollection(projectName);
    resolvedCollectionId = col.id;
  }

  const project = await createProject(projectName, resolvedCollectionId);

  try {
    await updateProject(project.id, { status: "processing" });

    const buffers: Buffer[]   = [];
    const mimeTypes: string[] = [];
    for (const file of allFiles) {
      buffers.push(Buffer.from(await file.arrayBuffer()));
      mimeTypes.push(normalizeMime(file.type));
    }

    // Upload inputs (best-effort — don't block generation)
    try {
      const inputNames = ["front", "angle", "detail"];
      const inputPaths: string[] = [];
      for (let i = 0; i < allFiles.length; i++) {
        const mime = normalizeMime(allFiles[i].type);
        const ext  = mime.replace("image/", "").replace("jpeg", "jpg");
        inputPaths.push(await uploadInputImage(buffers[i], `${inputNames[i]}.${ext}`, mime, project.id));
      }
      await updateProject(project.id, { input_images: inputPaths });
    } catch { /* non-fatal */ }

    const { imageBuffer, mimeType: rawMime, inputTokens, outputTokens } =
      await generateFurnitureGhostShot(buffers, mimeTypes, workspace?.gemini_api_key);

    const mimeType  = normalizeMime(rawMime);
    const ext       = mimeType.replace("image/", "");
    const outputPath = await uploadOutputImage(
      imageBuffer, `furniture_ghost_${Date.now()}.${ext}`, mimeType, project.id
    );
    const outputUrl = await getSignedUrl("ghost-outputs", outputPath, 86400);

    await updateProject(project.id, {
      status: "completed", output_image: outputPath, prompt_used: "furniture-ghost",
    });
    await updateProject(project.id, { input_tokens: inputTokens, output_tokens: outputTokens }).catch(() => {});

    const version = await createVersion(project.id, outputPath, "Furniture ghost shot", undefined, "ai");
    await touchCollection(resolvedCollectionId);

    return NextResponse.json({
      projectId: project.id, collectionId: resolvedCollectionId,
      outputUrl, outputPath, mimeType,
      versionNumber: version.version_number,
      model: FURNITURE_MODEL_INFO.id,
      rateLimitRemaining: remaining,
    });
  } catch (err: unknown) {
    await updateProject(project.id, { status: "failed" }).catch(() => {});
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
