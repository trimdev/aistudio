"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadPanel } from "./UploadPanel";
import { PreviewPanel } from "./PreviewPanel";
import { SettingsPanel } from "./SettingsPanel";

import type {
  UploadedImages,
  UploadedPreviews,
  GenerationStep,
  GenerationResult,
  ProjectVersionWithUrl,
} from "@/types";

// ─── Step timing schedule ─────────────────────────────────────────────────────
const STEP_SCHEDULE: Array<[GenerationStep, number]> = [
  ["uploading", 0],
  ["analyzing", 2_500],
  ["removing", 7_000],
  ["preserving", 14_000],
  ["compositing", 22_000],
  ["finalizing", 30_000],
];

function buildPreviews(images: UploadedImages): UploadedPreviews {
  return {
    front: images.front ? URL.createObjectURL(images.front) : null,
    back: images.back ? URL.createObjectURL(images.back) : null,
    side: images.side ? URL.createObjectURL(images.side) : null,
  };
}

function revokePreviews(prev: UploadedPreviews) {
  if (prev.front) URL.revokeObjectURL(prev.front);
  if (prev.back) URL.revokeObjectURL(prev.back);
  if (prev.side) URL.revokeObjectURL(prev.side);
}

export function GhostStudioTool({ collectionId }: { collectionId?: string | null }) {
  const router = useRouter();
  const [images, setImages] = useState<UploadedImages>({ front: null, back: null, side: null });
  const [previews, setPreviews] = useState<UploadedPreviews>({ front: null, back: null, side: null });
  const [projectName, setProjectName] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [step, setStep] = useState<GenerationStep>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Version history state
  const [versions, setVersions] = useState<ProjectVersionWithUrl[]>([]);
  const [activeVersionIndex, setActiveVersionIndex] = useState(0);

  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Image management ────────────────────────────────────────────────────────
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

  // ── Fetch versions ──────────────────────────────────────────────────────────
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

  // ── Step animation ──────────────────────────────────────────────────────────
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

  // ── Generate ────────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!images.front || !images.back) {
      toast.error("Az elöl és hátul fotók feltöltése szükséges.");
      return;
    }

    setResult(null);
    setError(null);
    setVersions([]);
    startStepAnimation();

    const name = projectName.trim() || `Ghost Shot ${new Date().toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}`;

    const formData = new FormData();
    formData.append("front", images.front);
    formData.append("back", images.back);
    if (images.side) formData.append("side", images.side);
    formData.append("projectName", name);
    if (refinePrompt.trim()) formData.append("refinePrompt", refinePrompt.trim());
    if (collectionId) formData.append("collectionId", collectionId);

    try {
      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

      stopStepAnimation();
      setStep("done");
      const newResult: GenerationResult = {
        outputUrl: data.outputUrl,
        outputPath: data.outputPath,
        projectId: data.projectId,
        mimeType: data.mimeType,
        generatedAt: new Date(),
        versionNumber: data.versionNumber,
      };
      setResult(newResult);

      // Load versions
      await fetchVersions(data.projectId);

      toast.success("Szellemfigura kép elkészült!");
    } catch (err: unknown) {
      stopStepAnimation();
      setStep("error");
      const msg = err instanceof Error ? err.message : "Generálás sikertelen";
      setError(msg);
      toast.error(msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, projectName, refinePrompt, fetchVersions]);

  // ── Regenerate ──────────────────────────────────────────────────────────────
  const handleRegenerate = useCallback(() => {
    setResult(null);
    setError(null);
    setStep("idle");
    setVersions([]);
    setTimeout(handleGenerate, 50);
  }, [handleGenerate]);

  // ── Handle refined result ───────────────────────────────────────────────────
  const handleRefined = useCallback(async (refinedResult: GenerationResult) => {
    setResult(refinedResult);
    if (result?.projectId) {
      await fetchVersions(result.projectId);
    }
  }, [result, fetchVersions]);


  const isLoading = step !== "idle" && step !== "done" && step !== "error";

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
        />
        <SettingsPanel
          images={images}
          step={step}
          result={result}
          projectName={projectName}
          refinePrompt={refinePrompt}
          onProjectNameChange={setProjectName}
          onRefinePromptChange={setRefinePrompt}
          onGenerate={handleGenerate}
          onRegenerate={handleRegenerate}
        />
      </div>

    </>
  );
}
