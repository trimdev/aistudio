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
- Background: pure white (#FFFFFF) or neutral very light grey
- Lighting: soft, even studio lighting
- No harsh shadows
- No dramatic contrast
- Subtle natural shadow beneath garment only
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

  // gemini-2.0-flash-preview-image-generation supports IMAGE output modality
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-preview-image-generation",
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { responseModalities: ["IMAGE"] } as any,
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

// ─── Model metadata ───────────────────────────────────────────────────────────

export const MODEL_INFO = {
  id: "gemini-2.0-flash-preview-image-generation",
  provider: "Google Gemini",
  displayName: "Gemini 2.0 Flash (Image Gen)",
} as const;
