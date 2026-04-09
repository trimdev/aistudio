/**
 * Gemini AI adapter – modular so we can swap the underlying model/provider
 * by changing only this file.
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Part,
} from "@google/generative-ai";

const GHOST_MANNEQUIN_PROMPT = `You are an expert fashion photography editor specializing in ghost mannequin (invisible mannequin) product shots.

The user has provided 2-3 photos of a garment taken from different angles (front, back, and/or interior tag).

Your task:
1. Analyse all provided garment images carefully.
2. Generate a description of a perfect, professional ghost mannequin composite image that:
   - Shows the garment as if worn by an invisible mannequin
   - Has a clean white or light grey background
   - Properly blends the front, back, and interior shots to reveal the full garment silhouette
   - Maintains accurate colour, texture, and proportions
   - Uses professional studio lighting (soft, even, no harsh shadows)
   - Is suitable for an e-commerce product listing

Since this is a text model responding with image generation guidance, output a detailed DALL-E / image-model prompt that a downstream image generation model will use to create the final composite.

Format your response as valid JSON:
{
  "composite_prompt": "<detailed prompt for image generation>",
  "garment_description": "<brief description of the garment detected>",
  "detected_angles": ["front","back","interior"],
  "quality_notes": "<any issues detected with input images>"
}`;

export interface GhostMannequinResult {
  composite_prompt: string;
  garment_description: string;
  detected_angles: string[];
  quality_notes: string;
}

function getClient(apiKey: string) {
  return new GoogleGenerativeAI(apiKey);
}

function resolveApiKey(clientKey?: string | null): string {
  const key = clientKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("No Gemini API key available");
  return key;
}

/**
 * Analyse garment images and return ghost mannequin generation guidance.
 * @param imageBuffers – array of raw image Buffers (max 3)
 * @param mimeTypes – corresponding MIME types
 * @param clientApiKey – optional per-client key from their settings
 */
export async function analyseGarmentImages(
  imageBuffers: Buffer[],
  mimeTypes: string[],
  clientApiKey?: string | null,
  customPrompt?: string
): Promise<GhostMannequinResult> {
  const apiKey = resolveApiKey(clientApiKey);
  const genAI = getClient(apiKey);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-04-17",
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
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

  const promptText = customPrompt
    ? `${GHOST_MANNEQUIN_PROMPT}\n\nAdditional instructions from the user: ${customPrompt}`
    : GHOST_MANNEQUIN_PROMPT;

  const result = await model.generateContent([promptText, ...imageParts]);
  const text = result.response.text();

  // Strip markdown code fences if present
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(jsonStr) as GhostMannequinResult;
}

/**
 * Swappable model info – useful for settings page display.
 */
export const MODEL_INFO = {
  id: "gemini-2.5-flash-preview-04-17",
  provider: "Google Gemini",
  displayName: "Gemini 2.5 Flash",
} as const;
