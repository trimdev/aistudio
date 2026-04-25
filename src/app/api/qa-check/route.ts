import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerUser } from "@/lib/supabase/server";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { listWorkspaceMemories } from "@/lib/workspace-memory";
import { buildMemoryPromptBlock } from "@/lib/memory-utils";

export const maxDuration = 60;

const QA_SYSTEM_PROMPT = `You are a strict quality-assurance inspector for professional fashion e-commerce ghost mannequin (invisible mannequin / hollow man) product photography.

Your job: inspect the provided image and report ANY quality issues against professional e-commerce standards.

CRITICAL DEFECTS (these MUST be flagged — any single one means pass=false, severity="critical"):

1. MANNEQUIN VISIBILITY:
- Any visible mannequin body part: neck form, torso shape, arm form, shoulder form, leg form
- Mannequin edges or outlines visible around the neckline, collar, armholes, or hem
- Mannequin color/texture bleeding through the garment
- Skin-toned or plastic-looking areas where the mannequin was not fully removed
- Clips, pins, hangers, hands, or any support hardware visible

2. HOLLOW INTERIOR CHECK (most frequent failures):
- NECKLINE / COLLAR: The collar interior must appear hollow/empty — only fabric edges visible, no mannequin neck form. The neckline should be open and natural, revealing the hollow interior.
- BOTTOM / HEM / WAISTBAND: The hem must end cleanly with no mannequin base, stand, or leg form visible beneath it.
- ARMHOLES / SLEEVE OPENINGS: Sleeve openings must appear hollow — no arm forms visible inside.
If you see ANY mannequin artifact in these areas, it is ALWAYS a critical defect — never downgrade to warning.

3. BACKGROUND AND LIGHTING:
- Background is NOT pure white (#FFFFFF) or neutral light grey — any dark gray, gradient, or colored background is a critical defect
- Harsh shadows visible — cast shadows, drop shadows, strong contact shadows
- Note: soft, even studio lighting with very subtle contact shadows is acceptable for professional e-commerce

4. COLOR ACCURACY:
- Colors have been visibly altered, enhanced, saturated, or shifted compared to what a natural garment would look like
- Unnatural color casts across the image

5. DETAIL PRESERVATION:
- Any text, logo, number, or printed graphic that appears backwards, mirrored, or reversed
- Words or letters that read right-to-left instead of left-to-right
- Missing or simplified design details (stitching, buttons, zippers, pockets, embroidery, prints, patterns)

6. 3D VOLUME AND DRAPE:
- Garment appears flat, 2D, or unnaturally stiff instead of having natural 3D volume
- Garment proportions distorted or unnatural
- Fabric drape looks unrealistic

OTHER DEFECTS TO CHECK (warning level):
- Missing or cut-off garment parts
- Obvious AI artifacts (blurred areas, warped patterns, extra elements)
- Layout issues (not side-by-side, misaligned views, inconsistent scale between front and back)

For EACH issue found, also provide a bounding box showing WHERE in the image the issue is located.
Use normalized coordinates [ymin, xmin, ymax, xmax] where each value is 0–1000 (0 = top/left edge, 1000 = bottom/right edge).

Respond in EXACTLY this JSON format (no markdown, no code fences):
{
  "pass": true/false,
  "issues": ["issue 1 description", "issue 2 description"],
  "regions": [
    {"bbox": [ymin, xmin, ymax, xmax], "label": "short description of what is wrong here"}
  ],
  "severity": "ok" | "warning" | "critical",
  "summary": "One sentence summary in Hungarian"
}

Rules:
- "pass" is false if ANY critical defect is found (mannequin visible, bad background, harsh shadows, mirrored text, missing details)
- "pass" can be true if the image meets professional e-commerce ghost mannequin standards
- "severity" is "critical" for critical defects, "warning" for minor issues, "ok" if clean
- Keep issue descriptions short and specific (e.g. "Mannequin neck form visible at collar area")
- "regions" must contain one entry per issue, with a tight bounding box around the defect area. If no issues, return an empty array.
- Summary must be in Hungarian
- If you also receive workspace memory notes, use them as additional QA criteria`;

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const formData = await req.formData();
  const imageFile = formData.get("image") as File | null;

  if (!imageFile) {
    return NextResponse.json({ error: "Image is required." }, { status: 400 });
  }

  const workspace = await getEffectiveWorkspace();
  const apiKey = (workspace?.gemini_api_key || process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 500 });
  }

  // Load workspace memories for additional QA criteria
  const memories = await listWorkspaceMemories(workspace.id).catch(() => []);
  const memoryBlock = buildMemoryPromptBlock(memories);

  const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
  const mimeType = imageFile.type || "image/png";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = memoryBlock
    ? `${QA_SYSTEM_PROMPT}\n\nWorkspace memory notes (use as additional QA criteria):\n${memoryBlock}`
    : QA_SYSTEM_PROMPT;

  try {
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { inlineData: { data: imageBuffer.toString("base64"), mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp" } },
          { text: prompt },
        ],
      }],
    });

    const text = result.response.text().trim();
    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      const qa = JSON.parse(jsonStr);
      return NextResponse.json(qa);
    } catch {
      // If we can't parse, return a conservative fail — treat as critical
      return NextResponse.json({
        pass: false,
        issues: ["QA válasz feldolgozási hiba"],
        severity: "critical",
        summary: "A QA ellenőrzés nem tudta feldolgozni az eredményt.",
        raw: text,
      });
    }
  } catch (err) {
    console.error("[qa-check]", err);
    const message = err instanceof Error ? err.message : "QA check failed";
    // Surface Gemini rate-limit errors as 429 so the client can use proper backoff
    const isRateLimit = message.includes("RESOURCE_EXHAUSTED") || message.includes("429") || message.includes("quota");
    return NextResponse.json(
      { error: message },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
