import { NextRequest, NextResponse } from "next/server";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { createProject, updateProject } from "@/lib/projects";
import { createCollection, touchCollection } from "@/lib/collections";
import { createVersion } from "@/lib/versions";
import { uploadOutputImage, getSignedUrl } from "@/lib/storage";
import { generateFashionVideo } from "@/lib/ai/gemini";
import {
  MOTION_STYLES,
  CAMERA_ANGLES,
  MUSIC_MOODS,
  ASPECT_RATIOS,
} from "@/lib/video-generation-data";
import { DESIGN_MODELS, DESIGN_BACKGROUNDS } from "@/lib/design-model-data";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/api/constants";

export async function POST(req: NextRequest) {
  // 1. Auth
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // 2. Rate limit
  const { allowed, remaining } = checkRateLimit(user.id, 10, "generate-video");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 10 video generations per hour." },
      { status: 429 },
    );
  }

  // 3. Parse FormData
  const formData = await req.formData();
  const sourceProjectId = (formData.get("sourceProjectId") as string) || null;
  const frontFile = formData.get("front") as File | null;
  const backFile = formData.get("back") as File | null;
  const sideFile = formData.get("side") as File | null;
  const projectName = (formData.get("projectName") as string) || "Video Generation";
  const motionStyleId = (formData.get("motionStyle") as string) || "slow-cinematic";
  const cameraAngleId = (formData.get("cameraAngle") as string) || "front";
  const aspectRatioId = (formData.get("aspectRatio") as string) || "9:16";
  const duration = parseInt((formData.get("duration") as string) || "5", 10);
  const loop = (formData.get("loop") as string) === "true";
  const musicMoodId = (formData.get("musicMood") as string) || "none";
  const brandingPosition = (formData.get("brandingPosition") as string) || "none";
  const brandingText = (formData.get("brandingText") as string) || "";
  const brandingLogo = formData.get("brandingLogo") as File | null;
  const modelId = (formData.get("modelId") as string) || null;
  const backgroundId = (formData.get("backgroundId") as string) || null;
  const collectionId = (formData.get("collectionId") as string) || null;

  // 4. Validation — either a source project ID or a front image is required
  if (!frontFile && !sourceProjectId) {
    return NextResponse.json({ error: "Front image or source project is required." }, { status: 400 });
  }

  for (const file of [frontFile, backFile, sideFile].filter(Boolean) as File[]) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)." }, { status: 400 });
    }
  }

  // Validate enums
  const motionStyle = MOTION_STYLES.find((m) => m.id === motionStyleId);
  if (!motionStyle) {
    return NextResponse.json({ error: "Invalid motion style." }, { status: 400 });
  }
  const cameraAngle = CAMERA_ANGLES.find((c) => c.id === cameraAngleId);
  if (!cameraAngle) {
    return NextResponse.json({ error: "Invalid camera angle." }, { status: 400 });
  }
  const aspectRatio = ASPECT_RATIOS.find((a) => a.id === aspectRatioId);
  if (!aspectRatio) {
    return NextResponse.json({ error: "Invalid aspect ratio." }, { status: 400 });
  }
  const musicMood = MUSIC_MOODS.find((m) => m.id === musicMoodId);
  if (!musicMood) {
    return NextResponse.json({ error: "Invalid music mood." }, { status: 400 });
  }

  const model = modelId ? DESIGN_MODELS.find((m) => m.id === modelId) : null;
  const background = backgroundId ? DESIGN_BACKGROUNDS.find((b) => b.id === backgroundId) : null;

  // 5. Get workspace
  const workspace = await getEffectiveWorkspace();

  // 6. Create or use collection
  let resolvedCollectionId = collectionId;
  if (!resolvedCollectionId) {
    const col = await createCollection(projectName);
    resolvedCollectionId = col.id;
  }

  // 7. Create project record
  const project = await createProject(projectName, resolvedCollectionId);

  // 8. Mark as processing
  await updateProject(project.id, { status: "processing" });

  // 9. Upload inputs (non-blocking)
  try {
    const inputPaths: string[] = [];
    // We could upload inputs here but skip for now — non-fatal
    await updateProject(project.id, { input_images: inputPaths });
  } catch { /* non-fatal */ }

  // 10. Build image buffers — either from upload or source project
  let frontBuffer: Buffer;
  let backBuffer: Buffer | null = null;
  let sideBuffer: Buffer | null = null;

  if (sourceProjectId) {
    // Fetch the output image from the source project in storage
    const admin = createSupabaseAdminClient();
    const { data: sourceProject } = await admin
      .from("projects")
      .select("output_image")
      .eq("id", sourceProjectId)
      .single();

    if (!sourceProject?.output_image) {
      await updateProject(project.id, { status: "failed" });
      return NextResponse.json({ error: "Source project has no output image." }, { status: 400 });
    }

    const { data: fileData, error: dlError } = await admin.storage
      .from("ghost-outputs")
      .download(sourceProject.output_image);

    if (dlError || !fileData) {
      await updateProject(project.id, { status: "failed" });
      return NextResponse.json({ error: "Failed to download source image." }, { status: 500 });
    }

    frontBuffer = Buffer.from(await fileData.arrayBuffer());
  } else {
    frontBuffer = Buffer.from(await frontFile!.arrayBuffer());
    backBuffer = backFile ? Buffer.from(await backFile.arrayBuffer()) : null;
    sideBuffer = sideFile ? Buffer.from(await sideFile.arrayBuffer()) : null;
  }

  // Build prompt for Veo 2 image-to-video
  // We are ANIMATING an existing photo — not generating new content.
  // Keep it focused on camera movement and scene animation at normal speed.
  const promptParts: string[] = [];

  // Core motion instruction — always emphasize real-time playback
  if (motionStyle.id === "slow-cinematic") {
    promptParts.push("Animate this photo with a slow elegant camera dolly movement");
  } else if (motionStyle.id === "dynamic-energy") {
    promptParts.push("Animate this photo with dynamic fast camera movement at real-time speed, not slow motion");
  } else if (motionStyle.id === "runway-walk") {
    promptParts.push("Animate this photo as a fashion runway walk at normal walking speed, real-time playback");
  } else if (motionStyle.id === "360-spin") {
    promptParts.push("Animate this photo with a smooth 360 degree camera rotation around the subject at normal speed");
  } else if (motionStyle.id === "parallax-depth") {
    promptParts.push("Animate this photo with parallax depth effect, subtle layered camera movement");
  } else if (motionStyle.id === "zoom-reveal") {
    promptParts.push("Animate this photo with a camera zoom revealing details, normal speed");
  } else if (motionStyle.id === "fabric-flow") {
    promptParts.push("Animate this photo with gentle wind causing fabric to flow naturally, real-time");
  } else if (motionStyle.id === "editorial-pose") {
    promptParts.push("Animate this photo with subtle pose transitions, editorial style, normal speed");
  } else if (motionStyle.id === "split-before-after") {
    promptParts.push("Animate this photo with a reveal transition effect at normal speed");
  } else {
    promptParts.push("Animate this photo with natural gentle movement at normal real-time speed, not slow motion");
  }

  // Camera angle
  promptParts.push(cameraAngle.promptDescription);

  // Background if selected
  if (background) {
    promptParts.push(background.promptDescription);
  }

  // Explicit anti-slow-motion for all non-cinematic styles
  if (motionStyle.id !== "slow-cinematic") {
    promptParts.push("real-time speed, NOT slow motion");
  }

  promptParts.push("professional commercial quality");

  const promptDescription = promptParts.join(". ");

  try {
    const { videoBuffer, mimeType, inputTokens, outputTokens } = await generateFashionVideo(
      { front: frontBuffer, back: backBuffer, side: sideBuffer },
      promptDescription,
      workspace?.gemini_api_key,
      { aspectRatio: aspectRatio.id, durationSeconds: duration },
    );

    // 11. Upload output
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("webm") ? "webm" : "mp4";
    const outputPath = await uploadOutputImage(videoBuffer, `video_${project.id}.${ext}`, mimeType, project.id);
    const outputUrl = await getSignedUrl("ghost-outputs", outputPath, 86400);

    // 12. Create version record
    const version = await createVersion(
      project.id,
      outputPath,
      "Video generation v1",
    );

    // 13. Update project
    await updateProject(project.id, {
      status: "completed",
      output_image: outputPath,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      prompt_used: promptDescription,
    });

    // 14. Touch collection
    await touchCollection(resolvedCollectionId);

    return NextResponse.json({
      projectId: project.id,
      collectionId: resolvedCollectionId,
      outputUrl,
      outputPath,
      versionNumber: version.version_number,
      duration,
      format: "mp4",
      remainingGenerations: remaining,
    });
  } catch (err: unknown) {
    await updateProject(project.id, { status: "failed" });
    const errMsg = err instanceof Error ? (err.name !== "Error" ? err.toString() : err.message) : String(err);
    console.error("[generate-video] error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
