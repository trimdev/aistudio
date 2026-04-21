import { NextRequest, NextResponse } from "next/server";
import { refineGhostMannequin } from "@/lib/ai/gemini";
import { getWorkspace } from "@/lib/workspace";
import { getProject, updateProject } from "@/lib/projects";
import { uploadOutputImage, getSignedUrl } from "@/lib/storage";
import { createVersion } from "@/lib/versions";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { listWorkspaceMemories } from "@/lib/workspace-memory";
import { buildMemoryPromptBlock } from "@/lib/memory-utils";
import { normalizeMime } from "@/lib/api/mime";

export const maxDuration = 300;

const MAX_FEEDBACK_LENGTH = 2000;

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const formData = await req.formData();
  const projectId = formData.get("projectId") as string | null;
  const feedback = formData.get("feedback") as string | null;
  const annotationFile = formData.get("annotation") as File | null;
  if (!projectId || !feedback?.trim()) {
    return NextResponse.json({ error: "projectId and feedback are required." }, { status: 400 });
  }

  if (feedback!.length > MAX_FEEDBACK_LENGTH) {
    return NextResponse.json(
      { error: `Feedback must be at most ${MAX_FEEDBACK_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const workspace = await getWorkspace();
  const memories = workspace ? await listWorkspaceMemories(workspace.id) : [];
  const memoryBlock = buildMemoryPromptBlock(memories);

  try {
    // Use admin client — private buckets require service-role key for downloads
    const adminStorage = createSupabaseAdminClient().storage;

    // Load original input images (front/back/side) if stored
    const inputBuffers: Buffer[] = [];
    const inputMimes: string[] = [];
    if (project.input_images?.length) {
      for (const inputPath of project.input_images) {
        const { data, error } = await adminStorage.from("ghost-inputs").download(inputPath);
        if (!error && data) {
          inputBuffers.push(Buffer.from(await data.arrayBuffer()));
          const ext = inputPath.split(".").pop()?.toLowerCase();
          inputMimes.push(
            ext === "jpg" || ext === "jpeg" ? "image/jpeg"
            : ext === "webp" ? "image/webp"
            : "image/png"
          );
        }
      }
    }

    // Load current composite output — prefer project.output_image, fall back to latest version
    let currentOutputImage = project.output_image;
    if (!currentOutputImage) {
      const { data: versionRow } = await createSupabaseAdminClient()
        .from("project_versions")
        .select("output_image")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();
      currentOutputImage = versionRow?.output_image ?? null;
    }
    if (!currentOutputImage) {
      return NextResponse.json({ error: "Could not load the current image." }, { status: 500 });
    }
    const { data: outData, error: outError } = await adminStorage
      .from("ghost-outputs")
      .download(currentOutputImage);
    if (outError || !outData) {
      return NextResponse.json({ error: "Could not load the current output image." }, { status: 500 });
    }
    const outputBuffer = Buffer.from(await outData.arrayBuffer());
    const outExt = currentOutputImage.split(".").pop()?.toLowerCase();
    const outputMime = outExt === "jpg" || outExt === "jpeg" ? "image/jpeg"
      : outExt === "webp" ? "image/webp"
      : "image/png";

    const hasAnnotation = !!(annotationFile && annotationFile.size > 0);
    const annotationBuffer = hasAnnotation
      ? Buffer.from(await annotationFile!.arrayBuffer())
      : null;

    const { imageBuffer, mimeType: rawMimeType } = await refineGhostMannequin(
      inputBuffers,
      inputMimes,
      outputBuffer,
      outputMime,
      annotationBuffer,
      feedback.trim(),
      memoryBlock,
      workspace?.gemini_api_key
    );
    // Normalize Gemini's output mimeType — it can include parameters or non-standard values
    const mimeType = normalizeMime(rawMimeType);

    const ext = mimeType.replace("image/", "");
    const outputPath = await uploadOutputImage(
      imageBuffer,
      `ghost_refined_${Date.now()}.${ext}`,
      mimeType,
      projectId
    );

    const outputUrl = await getSignedUrl("ghost-outputs", outputPath, 86400);

    // Update project's current output
    await updateProject(projectId, {
      output_image: outputPath,
      prompt_used: `Refinement: ${feedback.trim()}`,
    });

    // Log the refinement version
    const version = await createVersion(
      projectId,
      outputPath,
      hasAnnotation ? `Annotált finomítás: ${feedback.trim()}` : `Refinement: ${feedback.trim()}`,
      feedback.trim(),
      "user"
    );

    return NextResponse.json({
      projectId,
      outputUrl,
      outputPath,
      mimeType,
      versionNumber: version.version_number,
    });
  } catch (err: unknown) {
    console.error("[refine]", err);
    return NextResponse.json(
      { error: "Refinement failed. Please try again." },
      { status: 500 }
    );
  }
}
