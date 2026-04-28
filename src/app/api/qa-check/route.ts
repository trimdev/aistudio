import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerUser } from "@/lib/supabase/server";
import { getEffectiveWorkspace } from "@/lib/workspace";

export const maxDuration = 60;

const QA_SYSTEM_PROMPT = `You are a layout inspector for ghost mannequin product photos.

Only flag these two things. Nothing else matters.

1. LAYOUT — front and back must be SIDE BY SIDE with a clear visible gap:
   - The two garments must NOT touch each other
   - The two garments must NOT overlap each other
   - They must be arranged horizontally side by side (one left, one right)
   - If they touch, overlap, or are stacked vertically — pass=false, severity="critical".

2. IDENTITY — the two garments must be the SAME garment from the input photos:
   - Same color, same pattern, same shape, same details
   - Do not flag if there are minor differences in drape or fabric folds (those are natural variations between front/back views).
   - Only flag if the model clearly hallucinated a different garment, a different color, or a different design.

DO NOT flag:
- Mannequin visibility, skin tones, hollow interiors, collar/sleeve interiors
- Background color, gray backgrounds, lighting, shadows
- Color accuracy of the garment unless it's an obviously wrong garment color
- Stitching, prints, logos, small details
- 3D volume, drape, proportions

If both checks pass: pass=true, severity="ok", issues=[].

Respond in EXACTLY this JSON format (no markdown, no code fences):
{
  "pass": true/false,
  "issues": ["short specific issue"],
  "regions": [],
  "severity": "ok" | "warning" | "critical",
  "summary": "One sentence summary in Hungarian"
}`;

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

  const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
  const mimeType = imageFile.type || "image/png";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = QA_SYSTEM_PROMPT;

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

    // Log the raw model response (no image data) so we can diagnose future QA misses.
    console.log("[qa-check] raw model response:", text);

    let qa: {
      pass?: unknown;
      issues?: unknown;
      regions?: unknown;
      severity?: unknown;
      summary?: unknown;
    };
    try {
      qa = JSON.parse(jsonStr);
    } catch {
      // If we can't parse, return a conservative fail — treat as critical
      const failure = {
        pass: false,
        issues: ["QA válasz feldolgozási hiba"],
        regions: [],
        severity: "critical" as const,
        summary: "A QA ellenőrzés nem tudta feldolgozni az eredményt.",
        raw: text,
      };
      console.warn("[qa-check] parse failed — defaulting to critical fail", failure);
      return NextResponse.json(failure);
    }

    // ─── Server-side defensive re-classification ──────────────────────────────
    // Default-fail: missing/invalid fields are treated as critical, never as pass.
    const validSeverities = ["ok", "warning", "critical"] as const;
    type Severity = typeof validSeverities[number];

    const rawPass = qa.pass;
    const rawSeverity = qa.severity;
    const rawIssues = Array.isArray(qa.issues) ? qa.issues.filter((x) => typeof x === "string") as string[] : [];
    const rawRegions = Array.isArray(qa.regions) ? qa.regions : [];
    const rawSummary = typeof qa.summary === "string" ? qa.summary : "";

    const pass = typeof rawPass === "boolean" ? rawPass : false;
    const severity: Severity =
      typeof rawSeverity === "string" && (validSeverities as readonly string[]).includes(rawSeverity)
        ? (rawSeverity as Severity)
        : "critical";

    const verdict = {
      pass,
      issues: rawIssues,
      regions: rawRegions,
      severity,
      summary: rawSummary,
    };

    console.log("[qa-check] post-classification verdict:", verdict);
    return NextResponse.json(verdict);
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
