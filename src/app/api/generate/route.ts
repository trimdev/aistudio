import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { analyseGarmentImages } from "@/lib/ai/gemini";
import { getWorkspace } from "@/lib/workspace";
import { createProject, updateProject } from "@/lib/projects";
import { uploadInputImage } from "@/lib/storage";

// Simple in-memory rate limiter (replace with Redis/Upstash in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  if (!checkRateLimit(userId)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. You can generate up to 10 images per hour." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const files = formData.getAll("images") as File[];
  const projectName = (formData.get("projectName") as string) || "Untitled Project";
  const customPrompt = (formData.get("customPrompt") as string) || undefined;

  if (!files.length || files.length > 3) {
    return NextResponse.json(
      { error: "Please upload 1–3 garment images." },
      { status: 400 }
    );
  }

  // Validate file types
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  for (const file of files) {
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Each image must be under 10 MB." },
        { status: 400 }
      );
    }
  }

  // Get workspace (for client API key)
  const workspace = await getWorkspace();

  // Create project record
  const project = await createProject(projectName);

  try {
    await updateProject(project.id, { status: "processing" });

    // Upload input images to Supabase Storage
    const buffers: Buffer[] = [];
    const mimeTypes: string[] = [];
    const storagePaths: string[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = file.type.split("/")[1];
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const path = await uploadInputImage(buffer, fileName, file.type, project.id);
      buffers.push(buffer);
      mimeTypes.push(file.type);
      storagePaths.push(path);
    }

    await updateProject(project.id, { input_images: storagePaths });

    // Call AI
    const result = await analyseGarmentImages(
      buffers,
      mimeTypes,
      workspace?.gemini_api_key,
      customPrompt
    );

    await updateProject(project.id, {
      status: "completed",
      prompt_used: result.composite_prompt,
    });

    return NextResponse.json({
      projectId: project.id,
      result,
    });
  } catch (err: unknown) {
    await updateProject(project.id, { status: "failed" });
    console.error("[generate]", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
