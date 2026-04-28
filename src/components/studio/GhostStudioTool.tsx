"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadPanel } from "./UploadPanel";
import { PreviewPanel } from "./PreviewPanel";
import { SettingsPanel } from "./SettingsPanel";
import { useLanguage } from "@/components/providers/LanguageProvider";

import { compressImage, revokePreviews } from "@/lib/image-utils";

import type {
  UploadedImages,
  UploadedPreviews,
  GenerationStep,
  GenerationResult,
  ProjectVersionWithUrl,
} from "@/types";

const STEP_SCHEDULE: Array<[GenerationStep, number]> = [
  ["uploading", 0],
  ["analyzing", 2_500],
  ["removing", 7_000],
  ["preserving", 14_000],
  ["compositing", 22_000],
  ["finalizing", 30_000],
];

interface QaVerdict {
  pass: boolean;
  severity: "ok" | "warning" | "critical";
  issues: string[];
  summary: string;
}

// Defensive: catch mannequin mentions even if QA returned them as "warning".
const MANNEQUIN_KEYWORDS = /mannequin|manöken|neck form|arm form|leg form|torso|shoulder form|skin[- ]?ton|plastic|hanger|clip|pin\b|akasztó|csipesz|tű\b|fej\b|nyak\b|test\b/i;

function qaMentionsMannequin(qa: QaVerdict): boolean {
  if (qa.issues.some((i) => MANNEQUIN_KEYWORDS.test(i))) return true;
  if (qa.summary && MANNEQUIN_KEYWORDS.test(qa.summary)) return true;
  return false;
}

// Same retry pattern as BatchGhostStudioTool — 5 retries, exponential backoff up to 64s.
async function runQaCheck(blob: Blob): Promise<QaVerdict | undefined> {
  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const form = new FormData();
      form.append("image", blob, "check.png");
      const res = await fetch("/api/qa-check", { method: "POST", body: form });
      if (res.ok) return (await res.json()) as QaVerdict;
      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, Math.min(8_000 * Math.pow(2, attempt - 1), 64_000)));
          continue;
        }
      }
      return undefined;
    } catch {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, Math.min(8_000 * Math.pow(2, attempt - 1), 64_000)));
        continue;
      }
    }
  }
  return undefined;
}

function buildPreviews(images: UploadedImages): UploadedPreviews {
  return {
    front: images.front ? URL.createObjectURL(images.front) : null,
    back: images.back ? URL.createObjectURL(images.back) : null,
    side: images.side ? URL.createObjectURL(images.side) : null,
  };
}

type QaState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "passed" }
  | { kind: "failed"; summary: string; issues: string[] }
  | { kind: "no_run" };

export function GhostStudioTool({ collectionId }: { collectionId?: string | null }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [images, setImages] = useState<UploadedImages>({ front: null, back: null, side: null });
  const [previews, setPreviews] = useState<UploadedPreviews>({ front: null, back: null, side: null });
  const [projectName, setProjectName] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [step, setStep] = useState<GenerationStep>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qaState, setQaState] = useState<QaState>({ kind: "idle" });
  // Holds the just-generated result while QA runs — only promoted to `result` once QA passes.
  const [pendingResult, setPendingResult] = useState<GenerationResult | null>(null);

  // Version history state
  const [versions, setVersions] = useState<ProjectVersionWithUrl[]>([]);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);

  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleImageChange = useCallback(
    (key: keyof UploadedImages, file: File | null) => {
      setImages((prev) => {
        const next = { ...prev, [key]: file };
        setPreviews((oldPreviews) => {
          if (oldPreviews[key]) URL.revokeObjectURL(oldPreviews[key]!);
          return { ...oldPreviews, [key]: file ? URL.createObjectURL(file) : null };
        });
        return next;
      });
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revokePreviews(previews);
      stepTimers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchVersions = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/versions?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions ?? []);
        setActiveVersionIndex((data.versions?.length ?? 1) - 1);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  function startStepAnimation() {
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
    STEP_SCHEDULE.forEach(([s, delay]) => {
      const id = setTimeout(() => setStep(s), delay);
      stepTimers.current.push(id);
    });
  }

  function stopStepAnimation() {
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
  }

  const handleGenerate = useCallback(async () => {
    if (!images.front || !images.back) {
      toast.error("Az elöl és hátul fotók feltöltése szükséges.");
      return;
    }

    setResult(null);
    setError(null);
    setVersions([]);
    setQaState({ kind: "idle" });
    setPendingResult(null);
    startStepAnimation();

    const name = projectName.trim() || `Ghost Shot ${new Date().toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}`;

    // Compress images client-side so the total request stays under Vercel's 4.5 MB limit.
    // Compressed files are always JPEG, so the safe extension is always "jpg".
    // Using explicit ASCII filenames also avoids a Safari bug with non-ASCII names in FormData.
    const [cFront, cBack, cSide] = await Promise.all([
      compressImage(images.front),
      compressImage(images.back),
      images.side ? compressImage(images.side) : Promise.resolve(null),
    ]);

    const formData = new FormData();
    formData.append("front", cFront, "front.jpg");
    formData.append("back", cBack, "back.jpg");
    if (cSide) formData.append("side", cSide, "side.jpg");
    formData.append("projectName", name);
    if (refinePrompt.trim()) formData.append("refinePrompt", refinePrompt.trim());
    if (collectionId) formData.append("collectionId", collectionId);

    try {
      const res = await fetch("/api/generate", { method: "POST", body: formData });

      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error("[generate] res.json() failed:", jsonErr, "status:", res.status, "statusText:", res.statusText);
        throw new Error(`Server error ${res.status}: response was not JSON (${(jsonErr as Error).message})`);
      }

      if (!res.ok) throw new Error((data.error as string) || `Server error ${res.status}`);

      stopStepAnimation();
      const newResult: GenerationResult = {
        outputUrl: data.outputUrl as string,
        outputPath: data.outputPath as string,
        projectId: data.projectId as string,
        collectionId: (data.collectionId as string | null) ?? collectionId,
        mimeType: data.mimeType as string,
        generatedAt: new Date(),
        versionNumber: data.versionNumber as number,
      };

      setPendingResult(newResult);
      setQaState({ kind: "running" });
      fetchVersions(newResult.projectId).catch(() => {});

      try {
        await new Promise((r) => setTimeout(r, 2_000));
        const imgRes = await fetch(newResult.outputUrl);
        if (!imgRes.ok) {
          setResult(newResult);
          setStep("done");
          setQaState({ kind: "idle" });
          return;
        }
        const blob = await imgRes.blob();
        const qa = await runQaCheck(blob);
        if (!qa) {
          setResult(newResult);
          setStep("done");
          setQaState({ kind: "idle" });
          return;
        }
        const isFailure = !qa.pass || qa.severity === "critical";
        if (isFailure) {
          setQaState({
            kind: "failed",
            summary: qa.summary || "QA hibát talált.",
            issues: qa.issues || [],
          });
          setStep("idle");
          return;
        }
        setResult(newResult);
        setStep("done");
        setQaState({ kind: "passed" });
      } catch {
        setResult(newResult);
        setStep("done");
        setQaState({ kind: "idle" });
      }
    } catch (err: unknown) {
      const errName = err instanceof Error ? err.constructor.name : "Unknown";
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[generate] caught ${errName}:`, errMsg, err);
      stopStepAnimation();
      setStep("error");
      const msg = err instanceof Error ? `[${errName}] ${err.message}` : "Generálás sikertelen";
      setError(msg);
      toast.error(msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, projectName, refinePrompt, fetchVersions]);

  const handleRegenerate = useCallback(() => {
    setResult(null);
    setError(null);
    setStep("idle");
    setVersions([]);
    setQaState({ kind: "idle" });
    setPendingResult(null);
    setTimeout(handleGenerate, 50);
  }, [handleGenerate]);

  // User overrides QA verdict and accepts the image manually.
  const handleAcceptAnyway = useCallback(() => {
    if (!pendingResult) return;
    setResult(pendingResult);
    setStep("done");
    setQaState({ kind: "passed" });
  }, [pendingResult]);

  const handleRefined = useCallback(async (refinedResult: GenerationResult) => {
    setResult(refinedResult);
    if (result?.projectId) {
      await fetchVersions(result.projectId);
    }
  }, [result, fetchVersions]);


  const isGenerating = step !== "idle" && step !== "done" && step !== "error";
  const isQaRunning = qaState.kind === "running";
  const isLoading = isGenerating || isQaRunning;
  const qaBlocked = qaState.kind === "failed" || qaState.kind === "no_run";

  return (
    <>
      <div className="flex h-full min-h-0 overflow-hidden">
        <UploadPanel
          images={images}
          previews={previews}
          disabled={isLoading}
          onImageChange={handleImageChange}
        />
        <PreviewPanel
          images={images}
          previews={previews}
          step={step}
          result={result}
          error={error}
          versions={versions}
          activeVersionIndex={activeVersionIndex}
          onSelectVersion={setActiveVersionIndex}
          onRefined={handleRefined}
          qaState={qaState}
          pendingPreviewUrl={pendingResult?.outputUrl ?? null}
          onAcceptAnyway={handleAcceptAnyway}
          onRegenerate={handleRegenerate}
        />
        <SettingsPanel
          images={images}
          step={step}
          result={result}
          projectName={projectName}
          refinePrompt={refinePrompt}
          collectionId={result?.collectionId ?? collectionId}
          onProjectNameChange={setProjectName}
          onRefinePromptChange={setRefinePrompt}
          onGenerate={handleGenerate}
          onRegenerate={handleRegenerate}
          qaBlocked={qaBlocked}
          qaRunning={isQaRunning}
        />
      </div>

    </>
  );
}
