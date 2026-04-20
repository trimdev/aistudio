import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerUser } from "@/lib/supabase/server";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { listWorkspaceMemories } from "@/lib/workspace-memory";
import { buildMemoryPromptBlock } from "@/lib/memory-utils";

export const maxDuration = 60;

const QA_SYSTEM_PROMPT = `You are a strict quality-assurance inspector for ghost mannequin (invisible mannequin) product photography.

Your job: inspect the provided image and report ANY quality issues.

CRITICAL DEFECTS (these MUST be flagged):
- Any visible mannequin body part: neck form, torso shape, arm form, shoulder form, leg form
- Mannequin edges or outlines visible around the neckline, collar, armholes, or hem
- Mannequin color/texture bleeding through the garment
- Skin-toned or plastic-looking areas where the mannequin was not fully removed
- Clips, pins, or support hardware visible

OTHER DEFECTS TO CHECK:
- Background not pure white (gray areas, shadows, gradients)
- Garment proportions distorted or unnatural
- Missing or cut-off garment parts
- Obvious AI artifacts (blurred areas, extra fingers on gloves, warped patterns)
- Color shifts or unnatural saturation
- Layout issues (not side-by-side, misaligned views)

Respond in EXACTLY this JSON format (no markdown, no code fences):
{
  "pass": true/false,
  "issues": ["issue 1 description", "issue 2 description"],
  "severity": "ok" | "warning" | "critical",
  "summary": "One sentence summary in Hungarian"
}

Rules:
- "pass" is false if ANY mannequin visibility issue is found (critical defect)
- "pass" can be true even with minor warnings (slight background issues, etc.)
- "severity" is "critical" if mannequin is visible, "warning" for minor issues, "ok" if clean
- Keep issue descriptions short and specific (e.g. "Mannequin neck form visible at collar area")
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
      // If we can't parse, return a conservative fail
      return NextResponse.json({
        pass: false,
        issues: ["QA válasz feldolgozási hiba"],
        severity: "warning",
        summary: "A QA ellenőrzés nem tudta feldolgozni az eredményt.",
        raw: text,
      });
    }
  } catch (err) {
    console.error("[qa-check]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "QA check failed" },
      { status: 500 }
    );
  }
}
