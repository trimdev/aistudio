import { NextRequest, NextResponse } from "next/server";
import { generateModelPhoto } from "@/lib/ai/gemini";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { createProject, updateProject } from "@/lib/projects";
import { uploadOutputImage, getSignedUrl } from "@/lib/storage";
import { createVersion } from "@/lib/versions";
import { getServerUser } from "@/lib/supabase/server";

export const maxDuration = 300;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
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

function normalizeMime(type: string): string {
  return type === "image/jpg" ? "image/jpeg" : type;
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { allowed, remaining } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Up to 10 model generations per hour." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const frontFile = formData.get("front") as File | null;
  const backFile = formData.get("back") as File | null;
  const sideFile = formData.get("side") as File | null;
  const projectName = (formData.get("projectName") as string) || "Model Photo";
  const variant     = (formData.get("variant")      as "blonde" | "brunette") || "blonde";
  const sceneType   = (formData.get("sceneType")    as "photoshoot" | "lifestyle") || "photoshoot";
  const poseIndex   = Math.min(7, Math.max(0, parseInt((formData.get("poseIndex") as string) || "0", 10)));
  const keywordsRaw = (formData.get("keywords") as string) || "";
  const keywords    = keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean);

  if (!frontFile || !backFile) {
    return NextResponse.json({ error: "Front and back images are required." }, { status: 400 });
  }

  if (!["blonde", "brunette"].includes(variant)) {
    return NextResponse.json({ error: "variant must be 'blonde' or 'brunette'." }, { status: 400 });
  }

  if (!["photoshoot", "lifestyle"].includes(sceneType)) {
    return NextResponse.json({ error: "sceneType must be 'photoshoot' or 'lifestyle'." }, { status: 400 });
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

  const workspace = await getEffectiveWorkspace();
  const project = await createProject(projectName);

  try {
    await updateProject(project.id, { status: "processing" });

    const buffers: Buffer[] = [];
    const mimeTypes: string[] = [];
    for (const file of allFiles) {
      buffers.push(Buffer.from(await file.arrayBuffer()));
      mimeTypes.push(normalizeMime(file.type));
    }

    await updateProject(project.id, { input_images: [] });

    const { imageBuffer, mimeType } = await generateModelPhoto(
      buffers,
      mimeTypes,
      variant,
      poseIndex,
      sceneType,
      keywords,
      workspace?.gemini_api_key
    );

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
      rateLimitRemaining: remaining,
    });
  } catch (err: unknown) {
    await updateProject(project.id, { status: "failed" });
    console.error("[generate-model]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Model generation failed" },
      { status: 500 }
    );
  }
}
