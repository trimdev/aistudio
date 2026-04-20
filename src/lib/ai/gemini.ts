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

RULE #1 — ABSOLUTE, NON-NEGOTIABLE:
THE MANNEQUIN MUST BE COMPLETELY INVISIBLE.
No mannequin body, no mannequin neck, no mannequin arms, no mannequin torso, no mannequin legs — zero trace of any mannequin or body form of any kind must appear anywhere in the output image.
The garment floats entirely on its own. If any part of a mannequin is visible, the image is wrong.
This rule overrides every other instruction.

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
  inputTokens: number;
  outputTokens: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveApiKey(clientKey?: string | null): string {
  const key = (clientKey || process.env.GEMINI_API_KEY)?.trim();
  if (!key) throw new Error("No API key configured");
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] } as any,
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
    throw new Error(`AI did not return an image. Details: ${detail}`);
  }

  const usage = result.response.usageMetadata;
  return {
    imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
    mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] } as any,
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
    throw new Error(`AI did not return an image. Details: ${detail}`);
  }

  const usage = result.response.usageMetadata;
  return {
    imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
    mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] } as any,
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
    ? `\n\nIMAGE ROLES:\n- Images 1–${imageBuffers.length} (first): THE ACTUAL GARMENT to copy — these are the uploaded product photos. The model must wear this EXACT garment with 100% accuracy.\n- Last image: Model APPEARANCE reference — match face structure, hair color, and hair style ONLY. CRITICAL: completely IGNORE any clothing the person in this last image is wearing. That clothing is irrelevant and must NOT influence what garment you generate. The garment is defined ONLY by the first images.`
    : `\n\nGARMENT IMAGES: The uploaded image(s) show the PHYSICAL GARMENT the model must wear. Copy it exactly — same type, length, color, collar, quilting, hardware, and all visible details. Do not replace it with a different or "similar" garment.`;

  const extraLine = extraPrompt?.trim()
    ? `\n\nAdditional instructions for this specific photo: ${extraPrompt.trim()}`
    : "";

  const fullPrompt = `${prompt}${refInstruction}${extraLine}`;

  // Image order: [garment photos] → [model reference (if any)] → [text prompt]
  // Garment comes FIRST so Gemini anchors to it; model ref comes LAST as supplementary appearance reference only
  const requestWithRef    = { contents: [{ role: "user", parts: [...garmentParts, ...refPart, { text: fullPrompt }] }] };
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
      const usage = result.response.usageMetadata;
      return {
        imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
        mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
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
        const usage = result.response.usageMetadata;
        return {
          imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
          mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        };
      }

      const finishReason = result.response.candidates?.[0]?.finishReason ?? "UNKNOWN";
      const textPart = parts.find((p) => "text" in p);
      const detail   = textPart && "text" in textPart ? (textPart as { text: string }).text : `finish_reason=${finishReason}`;

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        throw new Error(`AI did not return an image. Details: ${detail}`);
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

// ─── Design model photo generation ───────────────────────────────────────────

/**
 * Generate a design model fashion photo from garment reference images.
 * The prompt is fully pre-built by the caller via `buildDesignModelPrompt`;
 * this function is responsible only for the Gemini API call and retry logic.
 *
 * @param imageBuffers   Raw image buffers (front required, back and side optional)
 * @param mimeTypes      Corresponding MIME types (same order as imageBuffers)
 * @param prompt         Fully assembled generation prompt from buildDesignModelPrompt
 * @param clientApiKey   Optional per-workspace Gemini key
 */
export async function generateDesignModelPhoto(
  imageBuffers: Buffer[],
  mimeTypes: string[],
  prompt: string,
  clientApiKey?: string | null,
  portraitBuffer?: Buffer | null,
  portraitMime?: string | null
): Promise<GhostMannequinImageResult> {
  const apiKey = resolveApiKey(clientApiKey);
  const genAI  = new GoogleGenerativeAI(apiKey);

  const geminiModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-image",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] } as any,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
  });

  const garmentParts: Part[] = imageBuffers.map((buf, i) => ({
    inlineData: {
      data: buf.toString("base64"),
      mimeType: mimeTypes[i] as "image/jpeg" | "image/png" | "image/webp",
    },
  }));

  // Portrait reference part — sent AFTER garment so Gemini anchors garment first
  const portraitPart: Part[] = portraitBuffer
    ? [{
        inlineData: {
          data: portraitBuffer.toString("base64"),
          mimeType: (portraitMime ?? "image/png") as "image/jpeg" | "image/png" | "image/webp",
        },
      }]
    : [];

  const imageRoleNote = portraitBuffer
    ? `\n\nIMAGE ROLES:\n- Images 1–${imageBuffers.length}: THE GARMENT to copy onto the model. Reproduce every detail exactly.\n- Last image: MODEL APPEARANCE REFERENCE — match this person's face, hair color, hair style, and overall look EXACTLY. This is the specific model that must appear in the final photo. Do NOT change their appearance. IGNORE any clothing they wear in this reference image — only their face and hair matter.`
    : `\n\nGARMENT IMAGES: The uploaded image(s) show the PHYSICAL GARMENT. Copy it exactly — same type, length, color, and all visible details.`;

  // Image order: [garment photos] → [portrait reference (if any)] → [text prompt]
  const requestWithPortrait    = { contents: [{ role: "user", parts: [...garmentParts, ...portraitPart, { text: prompt + imageRoleNote }] }] };
  const requestWithoutPortrait = { contents: [{ role: "user", parts: [...garmentParts, { text: prompt + imageRoleNote }] }] };

  const request = portraitBuffer ? requestWithPortrait : requestWithoutPortrait;

  const MAX_ATTEMPTS   = 2;
  const RETRY_DELAY_MS = 10_000;

  // Phase 1: try with portrait reference (if provided)
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await geminiModel.generateContent(request);
    const parts  = result.response.candidates?.[0]?.content?.parts ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgPart = parts.find((p: any) => p.inlineData?.data);

    if (imgPart && "inlineData" in imgPart && imgPart.inlineData?.data) {
      const usage = result.response.usageMetadata;
      return {
        imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
        mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      };
    }

    const finishReason = String(result.response.candidates?.[0]?.finishReason ?? "UNKNOWN");
    if (finishReason === "IMAGE_OTHER" || finishReason === "IMAGE_SAFETY") break;
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }

  // Phase 2: fall back without portrait if it caused a refusal
  if (portraitBuffer) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = await geminiModel.generateContent(requestWithoutPortrait);
      const parts  = result.response.candidates?.[0]?.content?.parts ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imgPart = parts.find((p: any) => p.inlineData?.data);

      if (imgPart && "inlineData" in imgPart && imgPart.inlineData?.data) {
        const usage = result.response.usageMetadata;
        return {
          imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
          mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        };
      }

      const textPart = parts.find((p) => "text" in p);
      const detail   = textPart && "text" in textPart
        ? (textPart as { text: string }).text
        : `finish_reason=${result.response.candidates?.[0]?.finishReason ?? "UNKNOWN"}`;

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        throw new Error(`AI did not return an image. Details: ${detail}`);
      }
    }
  }

  // Unreachable — satisfies TypeScript
  throw new Error("generateDesignModelPhoto: unexpected exit from retry loop");
}

// ─── Fashion Video Generation (Veo 2 image-to-video) ─────────────────────────

export interface FashionVideoResult {
  videoBuffer: Buffer;
  mimeType: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Generate a fashion video using Google Veo 2 (image-to-video).
 * Uses the REST API directly since the SDK doesn't expose video generation.
 *
 * Flow:
 * 1. Upload source image to the Files API
 * 2. Submit video generation request to Veo 2
 * 3. Poll the operation until complete
 * 4. Download the generated video
 *
 * @param imageBuffers  Object with front (required), back (optional), side (optional) image buffers
 * @param promptDescription  Full prompt describing motion, camera, model, background, etc.
 * @param clientApiKey  Optional per-workspace Gemini key
 */
export async function generateFashionVideo(
  imageBuffers: { front: Buffer; back: Buffer | null; side: Buffer | null },
  promptDescription: string,
  clientApiKey?: string | null,
  options?: { aspectRatio?: string; durationSeconds?: number }
): Promise<FashionVideoResult> {
  const apiKey = resolveApiKey(clientApiKey);
  const BASE = "https://generativelanguage.googleapis.com/v1beta";

  // Use the front image as the source for image-to-video
  const imageBase64 = imageBuffers.front.toString("base64");

  // Prompt for Veo — animating an existing image, NOT generating new people
  const videoPrompt = promptDescription;

  // Map aspect ratio format
  const aspectRatio = options?.aspectRatio || "9:16";
  // Veo 3.1 supports 4s, 6s, or 8s — pick closest
  const rawDuration = options?.durationSeconds || 6;
  const durationSeconds = rawDuration <= 4 ? 4 : rawDuration <= 6 ? 6 : 8;

  // Submit video generation request to Veo 3.1
  const generateRes = await fetch(
    `${BASE}/models/veo-3.1-generate-preview:predictLongRunning?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [
          {
            prompt: videoPrompt,
            image: {
              bytesBase64Encoded: imageBase64,
              mimeType: "image/jpeg",
            },
          },
        ],
        parameters: {
          aspectRatio,
          personGeneration: "allow_adult",
          durationSeconds,
          resolution: "1080p",
        },
      }),
    },
  );

  if (!generateRes.ok) {
    const errBody = await generateRes.text();
    // Detect regional human-image restriction
    if (errBody.includes("humans are not permitted") || errBody.includes("not permitted for video generation in your country")) {
      throw new Error("REGION_HUMAN_BLOCKED: Az Ön régiójában nem engedélyezett embereket tartalmazó képek videóvá alakítása. Használjon ghost mannequin vagy flat lay fotót forrásként.");
    }
    throw new Error(`Veo request failed (${generateRes.status}): ${errBody}`);
  }

  const operation = await generateRes.json();
  const operationName: string = operation.name;

  if (!operationName) {
    throw new Error(`Veo 2 did not return an operation name: ${JSON.stringify(operation)}`);
  }

  // Poll operation until done (max ~5 minutes)
  const MAX_POLLS = 60;
  const POLL_INTERVAL_MS = 5_000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(
      `${BASE}/${operationName}?key=${apiKey}`,
      { method: "GET" },
    );

    if (!pollRes.ok) {
      const errBody = await pollRes.text();
      throw new Error(`Veo poll failed (${pollRes.status}): ${errBody}`);
    }

    const pollData = await pollRes.json();

    if (pollData.done) {
      // Check for error
      if (pollData.error) {
        throw new Error(`Veo generation failed: ${pollData.error.message || JSON.stringify(pollData.error)}`);
      }

      // Extract video from response
      const response = pollData.response ?? pollData.result ?? pollData;
      const videos = response?.generateVideoResponse?.generatedSamples
        ?? response?.generatedVideos
        ?? response?.generatedSamples
        ?? [];

      if (videos.length === 0) {
        // Check if videos were filtered by safety
        const gvr = response?.generateVideoResponse ?? response;
        if (gvr?.raiMediaFilteredCount > 0) {
          const reasons = gvr?.raiMediaFilteredReasons ?? [];
          const reasonText = reasons.join(" ");
          if (reasonText.includes("human") || reasonText.includes("person")) {
            throw new Error("REGION_HUMAN_BLOCKED: Az Ön régiójában nem engedélyezett embereket tartalmazó képek videóvá alakítása. Használjon ghost mannequin vagy flat lay fotót forrásként.");
          }
          throw new Error("A videó tartalma nem felelt meg a biztonsági irányelveknek. Próbálj ghost mannequin vagy flat lay fotót forrásként.");
        }
        throw new Error(`Veo returned no videos. Full response: ${JSON.stringify(pollData).slice(0, 2000)}`);
      }

      const videoData = videos[0];

      // Video can be returned as base64 or as a URI to download
      if (videoData.video?.bytesBase64Encoded) {
        return {
          videoBuffer: Buffer.from(videoData.video.bytesBase64Encoded, "base64"),
          mimeType: videoData.video.mimeType || "video/mp4",
          inputTokens: 0,
          outputTokens: 0,
        };
      }

      if (videoData.video?.uri) {
        const separator = videoData.video.uri.includes("?") ? "&" : "?";
        const videoRes = await fetch(`${videoData.video.uri}${separator}key=${apiKey}`);
        if (!videoRes.ok) throw new Error(`Failed to download video from URI: ${videoRes.status}`);
        const videoArrayBuffer = await videoRes.arrayBuffer();
        return {
          videoBuffer: Buffer.from(videoArrayBuffer),
          mimeType: videoData.video.mimeType || "video/mp4",
          inputTokens: 0,
          outputTokens: 0,
        };
      }

      // Fallback: try bytesBase64Encoded at top level
      if (videoData.bytesBase64Encoded) {
        return {
          videoBuffer: Buffer.from(videoData.bytesBase64Encoded, "base64"),
          mimeType: "video/mp4",
          inputTokens: 0,
          outputTokens: 0,
        };
      }

      throw new Error(`Veo 2 response format unexpected: ${JSON.stringify(videoData).slice(0, 500)}`);
    }
  }

  throw new Error("Veo video generation timed out after 5 minutes.");
}

// ─── Model metadata ───────────────────────────────────────────────────────────

export const MODEL_INFO = {
  id: "gemini-2.5-flash-image",
  provider: "Studio AI",
  displayName: "Studio AI",
} as const;
