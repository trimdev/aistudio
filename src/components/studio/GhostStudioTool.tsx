"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { UploadPanel } from "./UploadPanel";
import { PreviewPanel } from "./PreviewPanel";
import { SettingsPanel } from "./SettingsPanel";
import type {
  UploadedImages,
  UploadedPreviews,
  GenerationStep,
  GenerationResult,
} from "@/types";

// ─── Step timing schedule ─────────────────────────────────────────────────────
// Each entry: [step, delay-before-transitioning-to-it (ms)]
// The last step ("finalizing") stays until the API resolves.
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

export function GhostStudioTool() {
  const [images, setImages] = useState<UploadedImages>({
    front: null,
    back: null,
    side: null,
  });
  const [previews, setPreviews] = useState<UploadedPreviews>({
    front: null,
    back: null,
    side: null,
  });
  const [projectName, setProjectName] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [step, setStep] = useState<GenerationStep>("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Image management ────────────────────────────────────────────────────────
  const handleImageChange = useCallback(
    (key: keyof UploadedImages, file: File | null) => {
      setImages((prev) => {
        const next = { ...prev, [key]: file };
        setPreviews((oldPreviews) => {
          // Revoke old preview for this slot
          if (oldPreviews[key]) URL.revokeObjectURL(oldPreviews[key]!);
          return { ...oldPreviews, [key]: file ? URL.createObjectURL(file) : null };
        });
        return next;
      });
    },
    []
  );

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      revokePreviews(previews);
      stepTimers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast.error("Upload front and back photos first.");
      return;
    }

    setResult(null);
    setError(null);
    startStepAnimation();

    const name = projectName.trim() || `Ghost Shot ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    const formData = new FormData();
    formData.append("front", images.front);
    formData.append("back", images.back);
    if (images.side) formData.append("side", images.side);
    formData.append("projectName", name);
    if (refinePrompt.trim()) formData.append("refinePrompt", refinePrompt.trim());

    try {
      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error ${res.status}`);
      }

      stopStepAnimation();
      setStep("done");
      setResult({
        outputUrl: data.outputUrl,
        outputPath: data.outputPath,
        projectId: data.projectId,
        mimeType: data.mimeType,
        generatedAt: new Date(),
      });
      toast.success("Ghost mannequin image generated!");
    } catch (err: unknown) {
      stopStepAnimation();
      setStep("error");
      const msg = err instanceof Error ? err.message : "Generation failed";
      setError(msg);
      toast.error(msg);
    }
  }, [images, projectName, refinePrompt]);

  // ── Regenerate (same images, same prompt) ───────────────────────────────────
  const handleRegenerate = useCallback(() => {
    setResult(null);
    setError(null);
    setStep("idle");
    // Small tick so React re-renders the idle state, then trigger generation
    setTimeout(handleGenerate, 50);
  }, [handleGenerate]);

  const isLoading = step !== "idle" && step !== "done" && step !== "error";

  return (
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
  );
}
