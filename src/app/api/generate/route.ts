import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { generateGhostMannequin, MODEL_INFO } from "@/lib/ai/gemini";
import { getWorkspace } from "@/lib/workspace";
import { createProject, updateProject } from "@/lib/projects";
import { uploadInputImage, uploadOutputImage, getSignedUrl } from "@/lib/storage";

// Allow up to 5 minutes for Gemini image generation
export const maxDuration = 300;

// ─── Rate limiting (replace with Upstash Redis in production) ────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { allowed, remaining } = checkRateLimit(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Up to 20 generations per hour." },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    );
  }

  const formData = await req.formData();
  const frontFile = formData.get("front") as File | null;
  const backFile = formData.get("back") as File | null;
  const sideFile = formData.get("side") as File | null;
  const projectName = (formData.get("projectName") as string) || "Ghost Mannequin Shot";
  const refinePrompt = (formData.get("refinePrompt") as string) || undefined;

  // Validate required images
  if (!frontFile || !backFile) {
    return NextResponse.json(
      { error: "Front and back images are required." },
      { status: 400 }
    );
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
      return NextResponse.json(
        { error: `${file.name} exceeds 10 MB limit.` },
        { status: 400 }
      );
    }
  }

  const workspace = await getWorkspace();
  const project = await createProject(projectName);

  try {
    await updateProject(project.id, { status: "processing" });

    // ── Upload inputs ────────────────────────────────────────────────────────
    const buffers: Buffer[] = [];
    const mimeTypes: string[] = [];
    const storagePaths: string[] = [];

    for (const file of allFiles) {
      const ab = await file.arrayBuffer();
      const buf = Buffer.from(ab);
      const ext = file.type.replace("image/", "").replace("jpeg", "jpg");
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const path = await uploadInputImage(buf, fileName, file.type, project.id);
      buffers.push(buf);
      mimeTypes.push(file.type);
      storagePaths.push(path);
    }

    await updateProject(project.id, { input_images: storagePaths });

    // ── Generate image via Gemini ─────────────────────────────────────────────
    const { imageBuffer, mimeType } = await generateGhostMannequin(
      buffers,
      mimeTypes,
      workspace?.gemini_api_key,
      refinePrompt
    );

    // ── Upload output ────────────────────────────────────────────────────────
    const ext = mimeType.replace("image/", "");
    const outputFileName = `ghost_${Date.now()}.${ext}`;
    const outputPath = await uploadOutputImage(
      imageBuffer,
      outputFileName,
      mimeType,
      project.id
    );

    // Create signed URL (24 h)
    const outputUrl = await getSignedUrl("ghost-outputs", outputPath, 86400);

    await updateProject(project.id, {
      status: "completed",
      output_image: outputPath,
      prompt_used: MODEL_INFO.id,
    });

    return NextResponse.json(
      {
        projectId: project.id,
        outputUrl,
        outputPath,
        mimeType,
        rateLimitRemaining: remaining,
      },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch (err: unknown) {
    await updateProject(project.id, { status: "failed" });
    console.error("[generate]", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
