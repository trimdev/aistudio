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

/**
 * System instruction for ghost mannequin generation.
 * Goes into the `systemInstruction` field — NOT into the user message.
 * Creates professional e-commerce ghost mannequin (invisible mannequin / hollow man)
 * product photos from uploaded garment reference images.
 */
export const GHOST_MANNEQUIN_SYSTEM_INSTRUCTION = `Create a professional fashion e-commerce ghost mannequin product photo
(invisible mannequin / hollow man effect) based on the uploaded garment images.

LAYOUT:
- Show the front view on the left and the back view on the right, side by side horizontally
- The two garments must be clearly SEPARATED with a visible gap between them
- They MUST NOT touch, overlap, or share edges
- Both views centered vertically, evenly spaced from the canvas edges
- Consistent scale and proportions across both views

NO TEXT, NO LABELS, NO ANNOTATIONS — CRITICAL:
- Do NOT render any text, words, letters, captions, or labels on the image
- Do NOT add titles, headings, or "Front" / "Back" / "Front View" / "Back View" labels
- Do NOT add watermarks, brand names, logos that are not on the original garment, image numbers, or any written marks
- The output image must contain ZERO text overlays — only the two garment photos on a clean background

MANNEQUIN EFFECT:
- The garment must appear self-supporting, as if worn by an invisible body
- Natural 3D volume, realistic fabric drape and structure
- No visible mannequin, hanger, pins, hands, or any support elements
- The neckline, sleeves and hem should be open and natural, revealing
 the hollow interior of the garment

COLOR ACCURACY (CRITICAL):
- Reproduce all colors with absolute fidelity to the original garment
- Do NOT alter, enhance, saturate or shift any colors
- Match fabric texture and sheen exactly as in the reference images

DETAIL PRESERVATION (CRITICAL):
- Preserve ALL original details exactly: stitching, seams, buttons,
 zippers, pockets, embroidery, prints, patterns, logos, labels, badges,
 drawstrings, ribbing, collar construction and any other design elements
- No details may be omitted, simplified or altered

BACKGROUND — CRITICAL, MUST BE PURE WHITE:
- The background MUST be pure white (#FFFFFF) — solid, even, uniform white across the entire canvas
- Do NOT use gray, light gray, off-white, beige, ivory, gradient, or any tinted background
- Do NOT use any background texture, pattern, vignette, or studio backdrop
- The canvas behind and around both garments must read as pure white at every pixel
- Only an extremely subtle contact shadow directly under the garment hem is allowed — nothing else

TECHNICAL SPECS:
- Soft, even studio lighting — no harsh shadows
- High-resolution, sharp focus across the entire garment
- Consistent scale between front and back views
- Style: clean, minimal, professional fashion e-commerce product photo`;

export interface GhostMannequinImageResult {
  imageBuffer: Buffer;
  mimeType: string;
  inputTokens: number;
  outputTokens: number;
}

function resolveApiKey(clientKey?: string | null): string {
  const key = (clientKey || process.env.GEMINI_API_KEY)?.trim();
  if (!key) throw new Error("No API key configured");
  return key;
}

// Vercel kills generate routes at maxDuration=300s. gemini-3-pro-image-preview
// often takes 60–180s per call, so a blind retry can push past that cap and
// produce a 504. Only retry if the remaining function budget can plausibly
// fit another call plus the inter-attempt delay.
const FUNCTION_DEADLINE_MS = 300_000;
const RETRY_RESERVE_MS = 180_000;

function hasBudgetForRetry(startedAt: number, retryDelayMs: number): boolean {
  const remaining = FUNCTION_DEADLINE_MS - (Date.now() - startedAt);
  return remaining > retryDelayMs + RETRY_RESERVE_MS;
}

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
  refinePrompt?: string,
  memoryBlock?: string
): Promise<GhostMannequinImageResult> {
  const apiKey = resolveApiKey(clientApiKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  void memoryBlock;

  const MODEL_ID = "gemini-3-pro-image-preview";

  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { responseModalities: ["IMAGE"] } as any,
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

  let userPrompt = GHOST_MANNEQUIN_SYSTEM_INSTRUCTION;
  if (refinePrompt?.trim()) {
    userPrompt += `\n\nAdditional user instructions: ${refinePrompt.trim()}`;
  }

  const promptHash = require("crypto").createHash("sha256").update(userPrompt).digest("hex").slice(0, 12);
  console.log("════════════════════════════════════════════════════════════");
  console.log(`[ghost] model: ${MODEL_ID}`);
  console.log(`[ghost] prompt length: ${userPrompt.length} chars`);
  console.log(`[ghost] prompt sha256[0:12]: ${promptHash}`);
  console.log(`[ghost] image count: ${imageBuffers.length}`);
  console.log(`[ghost] image mimes: ${mimeTypes.join(", ")}`);
  console.log(`[ghost] image sizes (bytes): ${imageBuffers.map((b) => b.length).join(", ")}`);
  console.log("[ghost] ──── PROMPT BEGIN ────");
  console.log(userPrompt);
  console.log("[ghost] ──── PROMPT END ────");
  console.log("════════════════════════════════════════════════════════════");

  const request = {
    contents: [
      {
        role: "user" as const,
        parts: [...imageParts, { text: userPrompt }],
      },
    ],
  };

  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY_MS = 3_000;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await model.generateContent(request);
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: Part) => p.inlineData?.data);

    if (imgPart && "inlineData" in imgPart && imgPart.inlineData?.data) {
      const usage = result.response.usageMetadata;
      return {
        imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
        mimeType: imgPart.inlineData.mimeType || "image/png",
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      };
    }

    const textPart = parts.find((p) => "text" in p);
    const detail = textPart && "text" in textPart ? (textPart as { text: string }).text : "No image returned";

    if (attempt < MAX_ATTEMPTS && hasBudgetForRetry(startedAt, RETRY_DELAY_MS)) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      throw new Error(`AI did not return an image. Details: ${detail}`);
    }
  }

  // Unreachable — satisfies TypeScript
  throw new Error("generateGhostMannequin: unexpected exit from retry loop");
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

  // System instruction for refinement context
  let sysInstruction = `TASK TYPE: image transformation (refinement pass). INPUT = a ghost mannequin composite that STILL contains mannequin artifacts or other defects. OUTPUT = the EXACT SAME composite, but with every remaining mannequin pixel erased and replaced by EMPTY interior space inside the garment, while the garment itself stays pixel-faithful to the input.

You are NOT regenerating from scratch. You are TRANSFORMING the existing composite by performing one specific edit: REMOVING leftover mannequin artifacts and REPLACING them with empty fabric-interior volume. Everything else — the garment, its colours, its drape, its layout, its scale, its details — must remain pixel-faithful to the current composite.

══════════════════════════════════════════════════
THE TRANSFORMATION, IN ONE SENTENCE
══════════════════════════════════════════════════
Imagine a real garment photographed on a mannequin in a studio. Now imagine pressing a button that makes the mannequin transparent / invisible. The garment keeps its 3D shape, the collar opening still shows the dark interior of the garment, the sleeves still look round and worn — but you cannot see anything where the mannequin used to be. THAT is the only correct refinement.

══════════════════════════════════════════════════
ANCHOR WORD: EMPTY
══════════════════════════════════════════════════
  • EMPTY collar interior — no neck, no plastic, no skin-tone, no padding. Just empty space showing the dark fabric lining receding into shadow.
  • EMPTY sleeve interiors — no arm, no stub, no plastic. Just empty fabric tubes receding into shadow at every cuff and shoulder opening.
  • EMPTY space below the hem — no legs, no stand, no base, no pedestal. Just pure white background.
  • EMPTY interior visible through the neckline — looking down into the collar reveals only the dark inside of the back of the garment, never a body, never a surface that looks like skin or plastic.

══════════════════════════════════════════════════
WHAT FILLS EACH GAP LEFT BY THE REMOVED MANNEQUIN
══════════════════════════════════════════════════
Inside the collar: the dark fabric interior of the garment, visible as a shadow/silhouette of the lining (NOT the white background, NOT a body, NOT plastic). Real depth into darkness.
Inside the sleeves: the dark fabric interior of each sleeve tube, visible as a shadow into darkness at every opening.
Below the hem: pure white #FFFFFF background. NO shadow of any body shape. NO body-coloured area. NO base.
Where the body was: complete absence — the garment must hold its shape via realistic 3D fabric drape over INVISIBLE volume.

══════════════════════════════════════════════════
WHAT IS A MANNEQUIN — RECOGNIZE AND ERASE ALL OF THESE
══════════════════════════════════════════════════
  • Skin-tone surfaces (beige, tan, peach, cream, ivory, flesh-coloured)
  • Plastic sheen, glossy synthetic finish, matte plastic look
  • Smooth featureless surfaces with no skin pores or hair
  • A headless torso, partial torso, or bust form
  • Stub arms, partial limbs, plastic shoulders, plastic neck
  • Dressform fabric covering (canvas, linen-wrapped torso, padded form)
  • Visible seam lines on a body-shaped form, screw points, joint marks
  • A stand, pole, base, or pedestal under the garment

══════════════════════════════════════════════════
LAYOUT, BACKGROUND, FIDELITY — TIGHT RULES
══════════════════════════════════════════════════
  1. Preserve the side-by-side layout: FRONT view on the LEFT, BACK view on the RIGHT, equal scale, vertically aligned, centered.
  2. Background: pure white #FFFFFF only — no grey, no off-white, no gradient, no texture, no body-shadow, no drop shadow, no halo.
  3. Lighting: soft, even studio lighting.
  4. Detail preservation — verbatim, no reinterpretation: stitching, seams, buttons, zippers, pockets, embroidery, prints, patterns, logos, labels, badges, drawstrings, ribbing, collar construction, hardware, trim.
  5. Color fidelity: pixel-accurate to the input garment. Match fabric texture and sheen exactly.
  6. Text and logos must read correctly in both views — never mirrored, never reversed.
  7. The garment must hold full 3D volume — do NOT flatten it to disguise mannequin removal.

══════════════════════════════════════════════════
PROHIBITED OUTPUTS
══════════════════════════════════════════════════
  ✗ Do NOT show any neck form, plastic neck, padded neck, or skin-tone surface inside the collar
  ✗ Do NOT show any arm form, plastic limb, stub arm, or skin-tone surface inside sleeve openings
  ✗ Do NOT show any base, stand, pedestal, leg form, or torso below the hem of the garment
  ✗ Do NOT leave any beige, tan, peach, cream, ivory, plastic-sheen, or skin-tone surface anywhere in the image
  ✗ Do NOT cast a body-shaped shadow, silhouette, or outline of a torso on the background
  ✗ Do NOT replace the mannequin with a real person, a model, a face, hands, hair, or any visible body part
  ✗ Do NOT add a hanger, clip, pin, clamp, magnet, or any visible support hardware
  ✗ Do NOT alter the garment type, length, silhouette, colours, or any construction detail
  ✗ Do NOT fill the collar, sleeves, or hem with the white background colour — they must show the dark fabric interior receding into shadow

══════════════════════════════════════════════════
FINAL SELF-CHECK — ASK YOURSELF BEFORE FINISHING
══════════════════════════════════════════════════
  1. Can I see ANY skin-tone, beige, tan, peach, plastic, or cream surface anywhere? If yes, regenerate without it.
  2. Can I see the dark interior of the garment through the collar opening, the sleeve openings, and (where applicable) the hem? If no, regenerate showing it.`;
  if (memoryBlock?.trim()) {
    sysInstruction += `\n\nWorkspace notes:\n${memoryBlock.trim()}`;
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-image",
    systemInstruction: sysInstruction,
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
    ? `Images 1-${inputBuffers.length}: ORIGINAL garment photos. Next image: CURRENT composite to fix.`
    : `First image: CURRENT composite to fix.`;

  const annotationContext = hasAnnotation
    ? ` Last image: RED annotation marks showing exactly where the issues are.`
    : "";

  // Concise edit command — details are in systemInstruction
  const refinementPrompt = `${inputContext}${annotationContext}

FIX THIS: ${feedback.trim()}

CRITICAL: Remove ALL mannequin artifacts:
- Make the neckline hollow — no neck form inside the collar, no plastic, no skin-tone
- Make armholes hollow — no arm forms inside sleeves, no plastic sheen
- Make hem clean — no base, leg form, or stand below the garment
- Background must be pure white (#FFFFFF) — no grey, no shadows of any kind
Keep the side-by-side layout, all colors, and every fabric detail exactly intact.`;

  // Images FIRST, then text
  const request = {
    contents: [{ role: "user" as const, parts: [...imageParts, { text: refinementPrompt }] }],
  };

  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY_MS = 3_000;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await model.generateContent(request);
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: Part) => p.inlineData?.data);

    if (imgPart && "inlineData" in imgPart && imgPart.inlineData?.data) {
      const usage = result.response.usageMetadata;
      return {
        imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
        mimeType: imgPart.inlineData.mimeType || "image/png",
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      };
    }

    const textPart = parts.find((p) => "text" in p);
    const detail = textPart && "text" in textPart ? (textPart as { text: string }).text : "No image returned";

    if (attempt < MAX_ATTEMPTS && hasBudgetForRetry(startedAt, RETRY_DELAY_MS)) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      throw new Error(`AI did not return an image. Details: ${detail}`);
    }
  }

  // Unreachable — satisfies TypeScript
  throw new Error("refineGhostMannequin: unexpected exit from retry loop");
}

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
  extraPrompt?: string
): Promise<GhostMannequinImageResult> {
  const apiKey = resolveApiKey(clientApiKey);
  const genAI  = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-image-preview",
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

  const prompt = buildSinglePhotoPrompt(variant, sceneType, poseIndex, keywords);

  const garmentInstruction = `\n\nGARMENT IMAGES: The uploaded image(s) show the PHYSICAL GARMENT the model must wear. Copy it exactly — same type, length, color, collar, quilting, hardware, and all visible details. Do not replace it with a different or "similar" garment.`;

  const extraLine = extraPrompt?.trim()
    ? `\n\nAdditional instructions for this specific photo: ${extraPrompt.trim()}`
    : "";

  const fullPrompt = `${prompt}${garmentInstruction}${extraLine}`;

  const request = { contents: [{ role: "user", parts: [...garmentParts, { text: fullPrompt }] }] };

  const MAX_ATTEMPTS = 2;
  const RETRY_DELAY_MS = 3_000;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await model.generateContent(request);
    const parts  = result.response.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: Part) => p.inlineData?.data);

    if (imgPart && "inlineData" in imgPart && imgPart.inlineData?.data) {
      const usage = result.response.usageMetadata;
      return {
        imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
        mimeType: imgPart.inlineData.mimeType || "image/png",
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      };
    }

    const finishReason = result.response.candidates?.[0]?.finishReason ?? "UNKNOWN";
    const textPart = parts.find((p) => "text" in p);
    const detail   = textPart && "text" in textPart ? (textPart as { text: string }).text : `finish_reason=${finishReason}`;

    if (attempt < MAX_ATTEMPTS && hasBudgetForRetry(startedAt, RETRY_DELAY_MS)) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      throw new Error(`AI did not return an image. Details: ${detail}`);
    }
  }

  // Unreachable — satisfies TypeScript
  throw new Error("generateModelPhoto: unexpected exit from retry loop");
}

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
    model: "gemini-3-pro-image-preview",
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
  const RETRY_DELAY_MS = 3_000;
  const startedAt      = Date.now();

  // Phase 1: try with portrait reference (if provided)
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await geminiModel.generateContent(request);
    const parts  = result.response.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: Part) => p.inlineData?.data);

    if (imgPart && "inlineData" in imgPart && imgPart.inlineData?.data) {
      const usage = result.response.usageMetadata;
      return {
        imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
        mimeType: imgPart.inlineData.mimeType || "image/png",
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      };
    }

    const finishReason = String(result.response.candidates?.[0]?.finishReason ?? "UNKNOWN");
    if (finishReason === "IMAGE_OTHER" || finishReason === "IMAGE_SAFETY") break;
    if (attempt < MAX_ATTEMPTS && hasBudgetForRetry(startedAt, RETRY_DELAY_MS)) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      break;
    }
  }

  // Phase 2: fall back without portrait if it caused a refusal
  if (portraitBuffer) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = await geminiModel.generateContent(requestWithoutPortrait);
      const parts  = result.response.candidates?.[0]?.content?.parts ?? [];
      const imgPart = parts.find((p: Part) => p.inlineData?.data);

      if (imgPart && "inlineData" in imgPart && imgPart.inlineData?.data) {
        const usage = result.response.usageMetadata;
        return {
          imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
          mimeType: imgPart.inlineData.mimeType || "image/png",
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        };
      }

      const textPart = parts.find((p) => "text" in p);
      const detail   = textPart && "text" in textPart
        ? (textPart as { text: string }).text
        : `finish_reason=${result.response.candidates?.[0]?.finishReason ?? "UNKNOWN"}`;

      if (attempt < MAX_ATTEMPTS && hasBudgetForRetry(startedAt, RETRY_DELAY_MS)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        throw new Error(`AI did not return an image. Details: ${detail}`);
      }
    }
  }

  // Unreachable — satisfies TypeScript
  throw new Error("generateDesignModelPhoto: unexpected exit from retry loop");
}

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

  const imageBase64 = imageBuffers.front.toString("base64");
  const videoPrompt = promptDescription;

  const aspectRatio = options?.aspectRatio || "9:16";
  // Veo 3.1 supports 4s, 6s, or 8s — pick closest
  const rawDuration = options?.durationSeconds || 6;
  const durationSeconds = rawDuration <= 4 ? 4 : rawDuration <= 6 ? 6 : 8;

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
      if (pollData.error) {
        throw new Error(`Veo generation failed: ${pollData.error.message || JSON.stringify(pollData.error)}`);
      }

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

export const MODEL_INFO = {
  id: "gemini-2.5-flash-image",
  provider: "Studio AI",
  displayName: "Studio AI",
} as const;
