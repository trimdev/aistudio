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

FINAL LAYOUT:
Display two views of the same garment:
- FRONT VIEW
- BACK VIEW

The two views must be either:
- Side-by-side horizontally
OR
- Vertically stacked

Both views must:
- Be aligned
- Have consistent scale and proportions
- Be evenly spaced
- Be centered on canvas

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

// ─── Model photo — single-image prompts ──────────────────────────────────────

const SINGLE_PHOTO_BASE = (hairColor: string, hairDesc: string) =>
  `A professional high-end fashion editorial photograph of a young ${hairColor} Caucasian female model \
wearing the exact garment shown in the reference image.

Generate ONE single standalone photograph — NOT a collage, NOT a triptych, NOT a grid. \
One image, one pose, one scene.

GARMENT ACCURACY — CRITICAL:
Reproduce the garment with absolute color fidelity. Preserve the exact hue, saturation, and brightness. \
All design details must be clearly visible: stitching, seams, buttons, zippers, patterns, prints, \
embroidery, texture, and fabric weave. Do not alter, simplify, or reinterpret any detail.

MODEL APPEARANCE:
The model has ${hairDesc}, light skin tone, natural makeup, pleasant neutral expression. \
Full body shot, head to toe. Arms slightly away from the body so the garment silhouette is fully visible.

TECHNICAL:
Photorealistic, high resolution, sharp focus on the garment. \
Commercial fashion editorial style. Medium format camera, 85mm equivalent focal length.`;

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
 */
export async function generateModelPhoto(
  imageBuffers: Buffer[],
  mimeTypes: string[],
  variant: "blonde" | "brunette",
  poseIndex: number,
  sceneType: "photoshoot" | "lifestyle",
  keywords: string[],
  clientApiKey?: string | null
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

  const imageParts: Part[] = imageBuffers.map((buf, i) => ({
    inlineData: {
      data: buf.toString("base64"),
      mimeType: mimeTypes[i] as "image/jpeg" | "image/png" | "image/webp",
    },
  }));

  const prompt = buildSinglePhotoPrompt(variant, sceneType, poseIndex, keywords);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [...imageParts, { text: prompt }] }],
  });

  const parts   = result.response.candidates?.[0]?.content?.parts ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgPart = parts.find((p: any) => p.inlineData?.data);

  if (!imgPart || !("inlineData" in imgPart) || !imgPart.inlineData?.data) {
    const textPart = parts.find((p) => "text" in p);
    const detail   = textPart && "text" in textPart ? textPart.text : "No image returned";
    throw new Error(`Gemini did not return an image. Details: ${detail}`);
  }

  return {
    imageBuffer: Buffer.from(imgPart.inlineData.data, "base64"),
    mimeType: (imgPart.inlineData.mimeType as string) || "image/png",
  };
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
