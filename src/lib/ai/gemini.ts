/**
 * Gemini AI adapter – modular.
 * Swap model/provider by editing only this file.
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Part,
} from "@google/generative-ai";

// ─── EXACT system prompt ──────────────────────────────────────────────────────
// Do NOT modify a single word – clients depend on this exact output.
export const GHOST_MANNEQUIN_SYSTEM_PROMPT = `You are a professional high-end fashion e-commerce product photographer and image editor.

Create a professional ghost mannequin product image (invisible mannequin / hollow man effect) using the provided garment images.

FINAL LAYOUT — MANDATORY:
Display two views of the same garment side-by-side horizontally:
- LEFT: FRONT VIEW
- RIGHT: BACK VIEW

Both views must:
- Be aligned at the same vertical baseline
- Have consistent scale and proportions relative to each other
- Be evenly spaced with a clean gap between them
- Be centered together on the canvas
- NEVER be stacked vertically — always side by side

GHOST MANNEQUIN EFFECT:
- The garment must appear naturally self-supporting, as if worn by an invisible body.
- Preserve realistic 3D structure and natural fabric drape.
- Remove completely any mannequin, model, hanger, pins, hands, clips, supports or shadows from supports.
- Neckline, sleeves, waistline and hem openings must look natural and hollow.
- The interior hollow area must appear realistic and properly shaped.
- No distortion of garment proportions.

COLOR ACCURACY — CRITICAL REQUIREMENT:
- Reproduce colors with absolute fidelity to the original garment.
- Do NOT enhance, shift, brighten, recolor, stylize, filter or adjust saturation.
- Maintain exact fabric tone, undertone and shading.
- Preserve natural fabric sheen exactly as in reference.

DETAIL PRESERVATION — CRITICAL REQUIREMENT:
Preserve ALL original garment details exactly as shown:
- Stitching
- Seams
- Buttons
- Zippers
- Pockets
- Embroidery
- Prints
- Patterns
- Logos
- Labels
- Badges
- Drawstrings
- Ribbing
- Collar construction
- Cuffs
- Hem finishing
- Any texture or structural details

No simplification. No removal. No added design elements. No artistic reinterpretation.

TECHNICAL SPECIFICATIONS:
- Background: pure white (#FFFFFF) — no grey, no off-white
- Lighting: soft, even, flat studio lighting
- Absolutely NO shadows of any kind
- No cast shadows, no drop shadows, no contact shadows
- No shadow beneath the garment
- No dramatic contrast
- High resolution
- Sharp focus across entire garment
- Clean, minimal, professional fashion e-commerce look
- Output aspect ratio suitable for webshop (1:1 or 4:5 preferred)

ABSOLUTE RESTRICTIONS:
- No model
- No mannequin
- No Shadows
- No hands
- No props
- No stylization
- No color grading
- No brand modification
- No artistic interpretation
- No background textures
- No lifestyle scene

This must look like a premium fashion webshop product image ready for upload.`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GhostMannequinImageResult {
  imageBuffer: Buffer;
  mimeType: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveApiKey(clientKey?: string | null): string {
  const key = clientKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("No Gemini API key configured");
  return key;
}

// ─── Core generation function ─────────────────────────────────────────────────

/**
 * Generate a ghost mannequin composite image from 2-3 garment photos.
 * Uses Gemini's native image generation (image-to-image editing).
 *
 * @param imageBuffers   Raw image buffers (front, back, optional side)
 * @param mimeTypes      Corresponding MIME types
 * @param clientApiKey   Optional per-workspace Gemini key
 * @param refinePrompt   Optional user refinement instructions appended to the system prompt
 */
export async function generateGhostMannequin(
  imageBuffers: Buffer[],
  mimeTypes: string[],
  clientApiKey?: string | null,
  refinePrompt?: string
): Promise<GhostMannequinImageResult> {
  const apiKey = resolveApiKey(clientApiKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-image",
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  });

  const imageParts: Part[] = imageBuffers.map((buf, i) => ({
    inlineData: {
      data: buf.toString("base64"),
      mimeType: mimeTypes[i] as "image/jpeg" | "image/png" | "image/webp",
    },
  }));

  const fullPrompt = refinePrompt?.trim()
    ? `${GHOST_MANNEQUIN_SYSTEM_PROMPT}\n\nAdditional refinement from the user: ${refinePrompt.trim()}`
    : GHOST_MANNEQUIN_SYSTEM_PROMPT;

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [...imageParts, { text: fullPrompt }],
      },
    ],
  });

  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgPart = parts.find((p: any) => p.inlineData?.data);

  if (!imgPart || !("inlineData" in imgPart) || !imgPart.inlineData?.data) {
    // Surface the raw text response in the error so we can debug
    const textPart = parts.find((p) => "text" in p);
    const detail = textPart && "text" in textPart ? textPart.text : "No image returned";
    throw new Error(`Gemini did not return an image. Details: ${detail}`);
  }

  return {
    imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
    mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
  };
}

/**
 * Refine an existing ghost mannequin composite.
 * Sends original input images + current composite + optional annotation to Gemini.
 * The prompt is structured to ONLY modify the described area and preserve everything else.
 *
 * @param inputBuffers   Original garment photos (front, back, optional side) — may be empty if not stored
 * @param inputMimes     Corresponding MIME types for input photos
 * @param outputBuffer   Current composite image to refine
 * @param outputMime     MIME type of the composite
 * @param annotationBuffer  Optional user-drawn annotation overlay
 * @param feedback       User's refinement instruction
 * @param memoryBlock    Workspace persistent memory block
 * @param clientApiKey   Optional per-workspace Gemini key
 */
export async function refineGhostMannequin(
  inputBuffers: Buffer[],
  inputMimes: string[],
  outputBuffer: Buffer,
  outputMime: string,
  annotationBuffer: Buffer | null,
  feedback: string,
  memoryBlock: string,
  clientApiKey?: string | null
): Promise<GhostMannequinImageResult> {
  const apiKey = resolveApiKey(clientApiKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-image",
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
  });

  const hasInputs = inputBuffers.length > 0;
  const hasAnnotation = annotationBuffer !== null;

  // Build image parts: [original inputs (if any)] + [current composite] + [annotation (if any)]
  const imageParts: Part[] = [
    ...inputBuffers.map((buf, i) => ({
      inlineData: {
        data: buf.toString("base64"),
        mimeType: inputMimes[i] as "image/jpeg" | "image/png" | "image/webp",
      },
    })),
    {
      inlineData: {
        data: outputBuffer.toString("base64"),
        mimeType: outputMime as "image/jpeg" | "image/png" | "image/webp",
      },
    },
    ...(annotationBuffer ? [{
      inlineData: {
        data: annotationBuffer.toString("base64"),
        mimeType: "image/png" as const,
      },
    }] : []),
  ];

  const inputContext = hasInputs
    ? `The first ${inputBuffers.length} image(s) are the ORIGINAL garment photo(s) (front, back, and optionally side view). The next image is the CURRENT composite result that must be refined.`
    : `The first image is the CURRENT composite result that must be refined.`;

  const annotationContext = hasAnnotation
    ? `The LAST image is an annotation overlay where the user has drawn RED marks over the specific area that needs correction. Focus ONLY on those red-marked regions.`
    : "";

  const refinementPrompt = `${GHOST_MANNEQUIN_SYSTEM_PROMPT}${memoryBlock}

--- REFINEMENT INSTRUCTIONS ---

${inputContext}${annotationContext ? `\n${annotationContext}` : ""}

CRITICAL — PRESERVE EVERYTHING EXCEPT THE REQUESTED FIX:
- The side-by-side layout (front LEFT, back RIGHT) must remain EXACTLY as in the current composite. Do NOT change the arrangement.
- Both garment views must stay in the same position, scale, and alignment as in the current composite.
- Only the specific area described by the user should be changed.
- All other parts of the image must remain pixel-perfect identical to the current composite.
- Background stays pure white (#FFFFFF).
- Do NOT re-generate or re-compose the whole image — apply a surgical fix to the described area only.

User's refinement request: ${feedback.trim()}`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [...imageParts, { text: refinementPrompt }] }],
  });

  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgPart = parts.find((p: any) => p.inlineData?.data);

  if (!imgPart || !("inlineData" in imgPart) || !imgPart.inlineData?.data) {
    const textPart = parts.find((p) => "text" in p);
    const detail = textPart && "text" in textPart ? textPart.text : "No image returned";
    throw new Error(`Gemini did not return an image. Details: ${detail}`);
  }

  return {
    imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
    mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
  };
}

// ─── Model photo — single-image prompts ──────────────────────────────────────

const SINGLE_PHOTO_BASE = (hairColor: string, hairDesc: string) =>
  `Generate a professional high-end fashion editorial photograph.

OUTPUT: ONE single standalone photograph — NOT a collage, NOT a triptych, NOT a grid. One image, one pose, one scene.

══════════════════════════════════════════════════
GARMENT — MANDATORY COPY TASK (highest priority):
══════════════════════════════════════════════════
The uploaded photo(s) show the ACTUAL PHYSICAL GARMENT that must appear in this photo.
This is NOT a creative brief. You are NOT asked to imagine, design, or interpret a garment.
You must COPY the uploaded garment onto the model with 100% accuracy.

COPY THESE EXACT ATTRIBUTES from the uploaded photo(s):
  • Garment TYPE and LENGTH (e.g. short puffer jacket, NOT a long coat)
  • Silhouette and fit (cropped, oversized, fitted, etc.)
  • Color — exact hue, saturation, brightness (do NOT darken, shift, or reinterpret)
  • Fabric texture and sheen (matte, glossy, quilted, etc.)
  • All hardware: zipper style, button placement, buckles, snap count
  • Collar type (e.g. standing collar, fur collar, hood, lapel — copy EXACTLY)
  • Pocket placement, shape, and count
  • Pattern / print / stitching lines (e.g. diagonal quilt pattern)
  • Sleeve length, cuff style, and any trim
  • Hem shape and length

PROHIBITED — do NOT do any of these:
  ✗ Do NOT substitute a different garment style (e.g. replacing a puffer with a coat)
  ✗ Do NOT add fur collar if the uploaded garment has none
  ✗ Do NOT change the length (short jacket must stay short)
  ✗ Do NOT reinterpret or "upgrade" the garment
  ✗ Do NOT use your training knowledge of what "similar" garments look like
  ✗ Do NOT apply any stylistic interpretation
  If you cannot see a detail clearly in the uploaded image, leave it as-is — never improvise

MODEL APPEARANCE:
Young ${hairColor} Caucasian female model. ${hairDesc}. Light skin tone, natural makeup, neutral expression.
Full body shot, head to toe. Arms slightly away from body so garment silhouette is fully visible.

TECHNICAL:
Photorealistic. High resolution. Sharp focus on the garment. Commercial fashion editorial style.
Medium format camera, 85mm focal length.`;

export const BLONDE_SINGLE_PROMPT  = SINGLE_PHOTO_BASE("blonde",   "straight or wavy blonde hair, shoulder length or longer");
export const BRUNETTE_SINGLE_PROMPT = SINGLE_PHOTO_BASE("brunette", "straight or wavy dark brown hair, shoulder length or longer");

// ─── Pose / scene catalogues (indexed by poseIndex) ──────────────────────────

export const PHOTO_POSES: Record<"photoshoot" | "lifestyle", string[]> = {
  photoshoot: [
    "Standing tall, arms naturally relaxed at sides, facing directly toward camera, full body, pure white seamless studio backdrop, soft even diffused studio lighting, zero shadows.",
    "Three-quarter body turn to the right, looking back over left shoulder, elegant sophisticated pose, full body, pure white seamless studio backdrop, soft even diffused lighting.",
    "Natural walking pose mid-stride, subtle movement, arms slightly in motion, dynamic yet refined, full body, pure white seamless studio backdrop, soft studio lighting.",
    "Arms crossed confidently over chest, strong direct gaze toward camera, empowered stance, full body, pure white seamless studio backdrop, even studio lighting.",
    "One hand resting on hip, slight lean to one side, relaxed and natural, full body, pure white seamless studio backdrop, soft diffused studio lighting.",
    "Sitting on a plain white cube or stool, legs crossed at ankle, elegant relaxed posture, full body visible, pure white seamless studio backdrop.",
    "Side profile — model turned exactly 90 degrees to the right, gazing forward, garment silhouette fully visible from the side, full body, pure white seamless studio backdrop.",
    "Candid movement pose — gentle spin or step forward, fabric in subtle motion, arms slightly raised for balance, full body, pure white seamless studio backdrop.",
  ],
  lifestyle: [
    "Walking confidently along a modern urban street, contemporary city glass-and-steel architecture in background, natural bright daylight, full body.",
    "Standing in a beautiful city park or garden, lush green trees and manicured lawn in background, soft natural diffused afternoon light, full body.",
    "Sitting at a stylish outdoor cafe terrace, warm inviting atmosphere, blurred terrace furniture and potted plants in background, full body visible.",
    "Walking along a high-end shopping boulevard, elegant boutique storefronts and large display windows visible in background, full body.",
    "Standing on a rooftop terrace, panoramic city skyline spread out behind, warm golden late-afternoon sunlight, full body.",
    "Strolling on a scenic seafront or riverfront promenade, water visible in background, bright natural coastal light, full body.",
    "Standing inside a beautifully lit contemporary interior — minimalist loft with white walls, large windows flooding the space with natural light, full body.",
    "Outdoor setting bathed in warm golden-hour sunlight, long soft shadows on the ground, warm amber and orange tones in background, full body.",
  ],
};

// ─── Single-photo prompt builder ─────────────────────────────────────────────

function buildSinglePhotoPrompt(
  variant: "blonde" | "brunette",
  sceneType: "photoshoot" | "lifestyle",
  poseIndex: number,
  keywords: string[]
): string {
  const base   = variant === "blonde" ? BLONDE_SINGLE_PROMPT : BRUNETTE_SINGLE_PROMPT;
  const poses  = PHOTO_POSES[sceneType];
  const pose   = poses[poseIndex % poses.length];
  const kwLine = keywords.length > 0 ? `\n\nAdditional style direction: ${keywords.join(", ")}.` : "";

  return `${base}

REMINDER: The garment in the uploaded image(s) is the ACTUAL PRODUCT. Copy it exactly — do not substitute, stylize, or lengthen it. The model wears THIS garment and no other.

POSE / SCENE (this specific photo):
${pose}${kwLine}`;
}

/**
 * Generate a single model fashion photo from garment reference images.
 * Call once per desired photo — the caller is responsible for looping.
 *
 * @param imageBuffers   Raw image buffers (front required, back required, side optional)
 * @param mimeTypes      Corresponding MIME types
 * @param variant        "blonde" or "brunette"
 * @param poseIndex      Which pose/scene from the catalogue (0–7)
 * @param sceneType      "photoshoot" (studio) or "lifestyle" (outdoor)
 * @param keywords       Extra style keywords appended to the prompt
 * @param clientApiKey   Optional per-workspace Gemini key
 * @param extraPrompt    Optional additional instructions appended to this specific photo's prompt
 */
export async function generateModelPhoto(
  imageBuffers: Buffer[],
  mimeTypes: string[],
  variant: "blonde" | "brunette",
  poseIndex: number,
  sceneType: "photoshoot" | "lifestyle",
  keywords: string[],
  clientApiKey?: string | null,
  modelRefBuffer?: Buffer | null,
  modelRefMime?: string | null,
  extraPrompt?: string
): Promise<GhostMannequinImageResult> {
  const apiKey = resolveApiKey(clientApiKey);
  const genAI  = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-image",
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
  });

  const garmentParts: Part[] = imageBuffers.map((buf, i) => ({
    inlineData: {
      data: buf.toString("base64"),
      mimeType: mimeTypes[i] as "image/jpeg" | "image/png" | "image/webp",
    },
  }));

  const refPart: Part[] = modelRefBuffer
    ? [{
        inlineData: {
          data: modelRefBuffer.toString("base64"),
          mimeType: (modelRefMime ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/webp",
        },
      }]
    : [];

  const prompt = buildSinglePhotoPrompt(variant, sceneType, poseIndex, keywords);

  const refInstruction = modelRefBuffer
    ? `\n\nIMAGE ROLES:\n- Image 1 (first): Model appearance reference — match face structure, hair color, and style.\n- Images 2+ (remaining): THE ACTUAL GARMENT to copy onto the model. These images show the PHYSICAL PRODUCT. The model must wear THIS EXACT GARMENT — same type, length, color, collar, quilting, hardware, and all details. Do not swap it for any other garment.`
    : `\n\nGARMENT IMAGES: The uploaded image(s) show the PHYSICAL GARMENT the model must wear. Copy it exactly — same type, length, color, collar, quilting, hardware, and all visible details. Do not replace it with a different or "similar" garment.`;

  const extraLine = extraPrompt?.trim()
    ? `\n\nAdditional instructions for this specific photo: ${extraPrompt.trim()}`
    : "";

  const fullPrompt = `${prompt}${refInstruction}${extraLine}`;

  // Image order: [model reference (if any)] → [garment photos] → [text prompt]
  const requestWithRef    = { contents: [{ role: "user", parts: [...refPart, ...garmentParts, { text: fullPrompt }] }] };
  const requestWithoutRef = { contents: [{ role: "user", parts: [...garmentParts, { text: fullPrompt }] }] };

  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY_MS = 10_000;

  // Phase 1: try with model reference (if provided)
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await model.generateContent(requestWithRef);
    const parts  = result.response.candidates?.[0]?.content?.parts ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgPart = parts.find((p: any) => p.inlineData?.data);

    if (imgPart && "inlineData" in imgPart && imgPart.inlineData?.data) {
      return {
        imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
        mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
      };
    }

    const finishReason = String(result.response.candidates?.[0]?.finishReason ?? "UNKNOWN");

    // IMAGE_OTHER = deterministic refusal — retrying same request won't help.
    // If a model reference was the likely cause, fall through to phase 2 immediately.
    if (finishReason === "IMAGE_OTHER" || finishReason === "IMAGE_SAFETY") {
      break;
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  // Phase 2: if we have a reference photo and it caused a refusal, retry without it
  if (refPart.length > 0) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = await model.generateContent(requestWithoutRef);
      const parts  = result.response.candidates?.[0]?.content?.parts ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgPart = parts.find((p: any) => p.inlineData?.data);

      if (imgPart && "inlineData" in imgPart && imgPart.inlineData?.data) {
        return {
          imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
          mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
        };
      }

      const finishReason = result.response.candidates?.[0]?.finishReason ?? "UNKNOWN";
      const textPart = parts.find((p) => "text" in p);
      const detail   = textPart && "text" in textPart ? (textPart as { text: string }).text : `finish_reason=${finishReason}`;

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        throw new Error(`Gemini did not return an image. Details: ${detail}`);
      }
    }
  }

  // Unreachable — satisfies TypeScript
  throw new Error("generateModelPhoto: unexpected exit from retry loop");
}

// ─── Agent chat function ─────────────────────────────────────────────────────

export interface AgentMessage {
  role: "user" | "model";
  text: string;
}

/**
 * Send a message to the Orchestrator Agent (text-only Gemini 2.5 Flash).
 * Includes full workspace/project context in the system prompt.
 */
export async function agentChat(
  messages: AgentMessage[],
  systemContext: string,
  clientApiKey?: string | null
): Promise<string> {
  const apiKey = resolveApiKey(clientApiKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemContext,
  });

  const chat = model.startChat({
    history: messages.slice(0, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
  });

  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMessage.text);
  return result.response.text();
}

// ─── Model metadata ───────────────────────────────────────────────────────────

export const MODEL_INFO = {
  id: "gemini-2.5-flash-image",
  provider: "Google Gemini",
  displayName: "Gemini 2.5 Flash Image",
} as const;
