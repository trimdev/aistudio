"use client";

import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  UploadedImages,
  UploadedPreviews,
  GenerationStep,
  GenerationResult,
} from "@/types";

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS: Array<{ key: GenerationStep; label: string }> = [
  { key: "uploading", label: "Uploading images" },
  { key: "analyzing", label: "Analyzing garment" },
  { key: "removing", label: "Removing mannequin" },
  { key: "preserving", label: "Preserving details" },
  { key: "compositing", label: "Creating front/back layout" },
  { key: "finalizing", label: "Finalizing image" },
];

const STEP_ORDER: GenerationStep[] = [
  "uploading",
  "analyzing",
  "removing",
  "preserving",
  "compositing",
  "finalizing",
  "done",
];

function stepIndex(step: GenerationStep) {
  return STEP_ORDER.indexOf(step);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
      <div className="relative">
        {/* Three stacked placeholder frames */}
        {[2, 1, 0].map((i) => (
          <div
            key={i}
            className="absolute rounded-2xl border-2 border-dashed border-gray-150 bg-gray-50"
            style={{
              width: 120,
              height: 150,
              left: i * 10 - 20,
              top: i * -6,
              zIndex: i,
              opacity: 1 - i * 0.2,
            }}
          />
        ))}
        <div
          className="relative rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center"
          style={{ width: 120, height: 150, zIndex: 3 }}
        >
          <ImageIcon className="w-8 h-8 text-gray-300" />
        </div>
      </div>
      <div className="text-center mt-6">
        <p className="text-sm font-medium text-gray-500">No images yet</p>
        <p className="text-xs text-gray-400 mt-1 max-w-[220px] leading-relaxed">
          Upload front and back photos of the garment to get started.
        </p>
      </div>
    </div>
  );
}

function InputPreview({ previews }: { previews: UploadedPreviews }) {
  const slots = [
    { key: "front" as const, label: "Front" },
    { key: "back" as const, label: "Back" },
    { key: "side" as const, label: "Side" },
  ].filter((s) => previews[s.key]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
        Input photos
      </p>
      <div className="flex gap-4 items-end justify-center">
        {slots.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center gap-2">
            <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50"
              style={{ width: key === "front" ? 140 : 110, height: key === "front" ? 175 : 138 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[key]!}
                alt={label}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-medium text-gray-400">{label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">
        Click <strong className="text-gray-600">Generate</strong> in the settings panel →
      </p>
    </div>
  );
}

function LoadingState({ step }: { step: GenerationStep }) {
  const currentIdx = stepIndex(step);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8">
      {/* Animated ghost icon */}
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-gray-900 flex items-center justify-center animate-pulse">
          <span className="text-4xl select-none">👻</span>
        </div>
        {/* Orbiting dot */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: "3s" }}>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-gray-400" />
        </div>
      </div>

      {/* Progress steps */}
      <div className="w-full max-w-xs space-y-2.5">
        {STEPS.map(({ key, label }, i) => {
          const done = i < currentIdx;
          const active = key === step;
          return (
            <div key={key} className="flex items-center gap-3">
              {/* Dot */}
              <div
                className={cn(
                  "w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-all duration-500",
                  done
                    ? "bg-gray-900"
                    : active
                    ? "bg-gray-900 ring-4 ring-gray-200"
                    : "bg-gray-200"
                )}
              >
                {done && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </div>
              {/* Label */}
              <span
                className={cn(
                  "text-xs transition-all duration-300",
                  done ? "text-gray-400 line-through" : active ? "text-gray-900 font-semibold" : "text-gray-300"
                )}
              >
                {label}
                {active && (
                  <span className="ml-1 text-gray-400 font-normal">
                    {"...".split("").map((c, j) => (
                      <span
                        key={j}
                        className="inline-block animate-bounce"
                        style={{ animationDelay: `${j * 150}ms`, animationDuration: "1s" }}
                      >
                        {c}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center max-w-[200px] leading-relaxed">
        This may take 20–60 seconds. Sit tight while Gemini works its magic.
      </p>
    </div>
  );
}

function ResultView({ result }: { result: GenerationResult }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider shrink-0">
        Generated result
      </p>
      <div
        className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-lg bg-gray-50 flex-1 w-full max-h-full"
        style={{ maxWidth: 520 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.outputUrl}
          alt="Ghost mannequin result"
          className="w-full h-full object-contain"
          style={{ maxHeight: "calc(100vh - 280px)" }}
        />
        {/* Success badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm border border-gray-100">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[11px] font-medium text-gray-700">Generated</span>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 shrink-0">
        {result.generatedAt.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })}
        {" · "}
        Gemini 2.0 Flash
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
      <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-900">Generation failed</p>
        <p className="text-xs text-gray-500 mt-2 max-w-[260px] leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PreviewPanelProps {
  images: UploadedImages;
  previews: UploadedPreviews;
  step: GenerationStep;
  result: GenerationResult | null;
  error: string | null;
}

export function PreviewPanel({
  images,
  previews,
  step,
  result,
  error,
}: PreviewPanelProps) {
  const hasPreviews = previews.front || previews.back;
  const isLoading =
    step !== "idle" && step !== "done" && step !== "error";

  return (
    <div className="flex-1 min-w-0 border-r border-gray-100 bg-gray-50/50 flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="px-5 pt-5 pb-3 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
          {step === "done" && result && (
            <span className="text-[10px] font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Ready
            </span>
          )}
          {isLoading && (
            <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full animate-pulse">
              Generating
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {error ? (
          <ErrorState message={error} />
        ) : step === "done" && result ? (
          <ResultView result={result} />
        ) : isLoading ? (
          <LoadingState step={step} />
        ) : hasPreviews ? (
          <InputPreview previews={previews} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
