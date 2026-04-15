/**
 * Gemini AI adapter — Furniture Studio module.
 * Completely separate from the Fashion module (gemini.ts).
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Part,
} from "@google/generative-ai";
import { FURNITURE_SCENES, type FurnitureScene } from "@/lib/furniture-scenes";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveApiKey(clientKey?: string | null): string {
  const key = (clientKey || process.env.GEMINI_API_KEY)?.trim();
  if (!key) throw new Error("No Gemini API key configured");
  return key;
}

function furnitureModel(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash-image",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] } as any,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,  threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
  });
}

export interface FurnitureImageResult {
  imageBuffer: Buffer;
  mimeType: string;
  inputTokens: number;
  outputTokens: number;
}

// ─── Ghost Shot prompt ────────────────────────────────────────────────────────

const FURNITURE_GHOST_PROMPT = `You are a professional product photographer and photo editor specialising in high-end furniture and interior design e-commerce.

Your task: produce a perfect, studio-quality product photograph of the furniture piece shown in the uploaded photo(s).

OUTPUT REQUIREMENTS — ABSOLUTE:
- Pure white background (#FFFFFF) — no grey, no shadows, no gradients, no floor reflection
- The furniture piece must be shown in full, from the base/legs to the top/back, nothing cropped
- Camera angle: slight 3/4 front angle (camera positioned slightly above and to the front-left), so the depth and form of the piece read clearly
- Soft, even, professional studio lighting — no harsh shadows, no dramatic contrast
- If multiple photos are provided, they are different angles/details of the SAME piece — use them to reconstruct the full, accurate product

COLOUR & MATERIAL FIDELITY — CRITICAL:
- Reproduce the exact colour, fabric texture, stitching, tufting, leg material and finish with 100% accuracy
- Do NOT recolour, brighten, shift hue, or "improve" the colour
- Preserve all material details: leather grain, fabric weave, wood grain, metal finish, etc.

DETAIL PRESERVATION:
- Visible stitching lines, button tufts, piping, cushion seams, leg shape, armrest form — all must be present exactly as in the reference
- Do NOT simplify, smooth, or omit any design detail
- Do NOT add decorative pillows, throws, plants, or any styling props unless they are clearly part of the product

RESTRICTIONS:
- No people, no hands, no mannequins
- No room context, no floor, no wall — pure white void
- No drop shadows (a very faint, barely visible grounding shadow directly under the legs is acceptable)
- No background objects of any kind
- No artistic reinterpretation — this is a faithful product photo, not an illustration

The output must look like a premium furniture e-commerce product image ready for a webshop.`;

// ─── Lifestyle scene catalogue ────────────────────────────────────────────────

export type { FurnitureScene } from "@/lib/furniture-scenes";
export { FURNITURE_SCENES } from "@/lib/furniture-scenes";

// ─── Lifestyle prompt builder ─────────────────────────────────────────────────

function buildLifestylePrompt(scene: FurnitureScene, withPeople: boolean): string {
  const peopleInstruction = withPeople
    ? `PEOPLE: Include 1–2 people interacting naturally with the furniture (sitting, relaxing, having coffee, reading). They should be stylish but not overly posed — candid lifestyle feel. Faces should be realistic but not identifiable. Clothing should suit the scene's style.`
    : `PEOPLE: Do NOT include any people, hands, or human figures in the image.`;

  return `You are a professional interior design photographer and CGI compositor.

Your task: place the EXACT furniture piece shown in the reference photo(s) into a high-quality, photorealistic lifestyle setting.

FURNITURE ACCURACY — HIGHEST PRIORITY:
- The furniture piece in the output must be 100% identical to the reference photo(s): exact shape, dimensions, colour, material, upholstery, leg style, stitching, every detail.
- Do NOT substitute a "similar" sofa or chair. Do NOT change the fabric colour, leg shape, arm style, or ANY design element.
- Do NOT simplify or smooth the furniture — reproduce every visible seam, button, stitch, and texture.
- If the reference shows a specific fabric (e.g., grey boucle, dark blue velvet, brown leather), reproduce it exactly.
- The furniture must look like it physically belongs in the scene — correct scale, perspective, and grounding.

SCENE: ${scene.description}

${peopleInstruction}

TECHNICAL REQUIREMENTS:
- Photorealistic — indistinguishable from a professional interior photography shoot
- Correct perspective: the furniture must match the room's vanishing point and floor plane precisely
- Lighting on the furniture must match the scene's light source direction, colour temperature, and intensity
- Soft, realistic ambient occlusion where the furniture meets the floor
- Background scene depth of field: slightly blurred background to keep focus on the furniture
- Medium-format camera look: 35–50mm equivalent, high resolution, sharp focus on the furniture

OUTPUT: One single photograph. Not a collage, not a mood board — one seamless, photorealistic image.`;
}

// ─── Core generation functions ────────────────────────────────────────────────

/**
 * Generate a clean white-background product photo of a furniture piece.
 */
export async function generateFurnitureGhostShot(
  imageBuffers: Buffer[],
  mimeTypes: string[],
  clientApiKey?: string | null,
): Promise<FurnitureImageResult> {
  const apiKey = resolveApiKey(clientApiKey);
  const model  = furnitureModel(apiKey);

  const imageParts: Part[] = imageBuffers.map((buf, i) => ({
    inlineData: { data: buf.toString("base64"), mimeType: mimeTypes[i] as "image/jpeg" | "image/png" | "image/webp" },
  }));

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [...imageParts, { text: FURNITURE_GHOST_PROMPT }] }],
  });

  const parts   = result.response.candidates?.[0]?.content?.parts ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imgPart = parts.find((p: any) => p.inlineData?.data);

  if (!imgPart || !("inlineData" in imgPart) || !imgPart.inlineData?.data) {
    const textPart = parts.find((p) => "text" in p);
    const detail   = textPart && "text" in textPart ? (textPart as { text: string }).text : "No image returned";
    throw new Error(`Gemini did not return an image. Details: ${detail}`);
  }

  const usage = result.response.usageMetadata;
  return {
    imageBuffer:  Buffer.from(imgPart.inlineData.data, "base64"),
    mimeType:     (imgPart.inlineData.mimeType as string) || "image/png",
    inputTokens:  usage?.promptTokenCount     ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
  };
}

/**
 * Generate a lifestyle photo of a furniture piece in a chosen scene.
 */
export async function generateFurnitureLifestyle(
  imageBuffers: Buffer[],
  mimeTypes: string[],
  sceneKey: string,
  withPeople: boolean,
  clientApiKey?: string | null,
): Promise<FurnitureImageResult> {
  const apiKey = resolveApiKey(clientApiKey);
  const model  = furnitureModel(apiKey);

  const scene = FURNITURE_SCENES.find((s) => s.key === sceneKey) ?? FURNITURE_SCENES[0];
  const prompt = buildLifestylePrompt(scene, withPeople);

  const imageParts: Part[] = imageBuffers.map((buf, i) => ({
    inlineData: { data: buf.toString("base64"), mimeType: mimeTypes[i] as "image/jpeg" | "image/png" | "image/webp" },
  }));

  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result   = await model.generateContent({
      contents: [{ role: "user", parts: [...imageParts, { text: prompt }] }],
    });
    const parts    = result.response.candidates?.[0]?.content?.parts ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imgPart  = parts.find((p: any) => p.inlineData?.data);

    if (imgPart && "inlineData" in imgPart && imgPart.inlineData?.data) {
      const usage = result.response.usageMetadata;
      return {
        imageBuffer:  Buffer.from(imgPart.inlineData.data, "base64"),
        mimeType:     (imgPart.inlineData.mimeType as string) || "image/png",
        inputTokens:  usage?.promptTokenCount     ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      };
    }

    const finishReason = String(result.response.candidates?.[0]?.finishReason ?? "UNKNOWN");
    if (finishReason === "IMAGE_OTHER" || finishReason === "IMAGE_SAFETY") break;
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 8_000));
  }

  throw new Error("Gemini did not return a lifestyle image after retries.");
}

export const FURNITURE_MODEL_INFO = {
  id: "gemini-2.5-flash-image",
  provider: "Google Gemini",
  displayName: "Gemini 2.5 Flash Image",
} as const;
