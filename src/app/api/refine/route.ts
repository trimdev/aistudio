import { NextRequest, NextResponse } from "next/server";
import { generateGhostMannequin, GHOST_MANNEQUIN_SYSTEM_PROMPT } from "@/lib/ai/gemini";
import { getWorkspace } from "@/lib/workspace";
import { getProject, updateProject } from "@/lib/projects";
import { uploadOutputImage, getSignedUrl } from "@/lib/storage";
import { createVersion } from "@/lib/versions";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { listWorkspaceMemories } from "@/lib/workspace-memory";
import { buildMemoryPromptBlock } from "@/lib/memory-utils";

export const maxDuration = 300;

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

  const project = await getProject(projectId);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const workspace = await getWorkspace();
  const memories = workspace ? await listWorkspaceMemories(workspace.id) : [];
  const memoryBlock = buildMemoryPromptBlock(memories);

  try {
    // Use admin client — private buckets require service-role key for downloads
    const adminStorage = createSupabaseAdminClient().storage;
    const imageBuffers: Buffer[] = [];
    const mimeTypes: string[] = [];

    if (project.output_image) {
      const { data: outData, error } = await adminStorage
        .from("ghost-outputs")
        .download(project.output_image);
      if (error || !outData) {
        return NextResponse.json({ error: "Could not load the current output image." }, { status: 500 });
      }
      imageBuffers.push(Buffer.from(await outData.arrayBuffer()));
      const ext = project.output_image.split(".").pop()?.toLowerCase();
      const mime = ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : "image/png";
      mimeTypes.push(mime);
    }

    if (imageBuffers.length === 0) {
      return NextResponse.json({ error: "Could not load the current image." }, { status: 500 });
    }

    if (annotationFile && annotationFile.size > 0) {
      imageBuffers.push(Buffer.from(await annotationFile.arrayBuffer()));
      mimeTypes.push("image/png");
    }

    // Build refinement prompt: system prompt + workspace memory + user feedback
    const refinePrompt = `${GHOST_MANNEQUIN_SYSTEM_PROMPT}${memoryBlock}\n\nUser refinement feedback: ${feedback.trim()}\n\nApply the user's feedback precisely while keeping all other ghost mannequin rules intact.`;

    const hasAnnotation = !!(annotationFile && annotationFile.size > 0);
    const feedbackWithContext = hasAnnotation
      ? `[VISUAL ANNOTATION PROVIDED] The last image in the input is an annotation overlay where the user has drawn RED marks over the areas that need correction. Focus your ghost mannequin fix specifically on those red-marked regions.\n\nUser feedback: ${feedback.trim()}`
      : feedback.trim();

    const { imageBuffer, mimeType } = await generateGhostMannequin(
      imageBuffers,
      mimeTypes,
      workspace?.gemini_api_key,
      feedbackWithContext
    );

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
      prompt_used: refinePrompt,
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
      { error: err instanceof Error ? err.message : "Refinement failed" },
      { status: 500 }
    );
  }
}
