"use client";

import { useState } from "react";
import { Wand2, Download, RotateCcw, ChevronDown, Loader2, Cpu, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { GenerationResult, GenerationStep, UploadedImages } from "@/types";

interface SettingsPanelProps {
  images: UploadedImages;
  step: GenerationStep;
  result: GenerationResult | null;
  projectName: string;
  refinePrompt: string;
  onProjectNameChange: (v: string) => void;
  onRefinePromptChange: (v: string) => void;
  onGenerate: () => void;
  onRegenerate: () => void;
}

function downloadImage(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function SettingsPanel({
  images,
  step,
  result,
  projectName,
  refinePrompt,
  onProjectNameChange,
  onRefinePromptChange,
  onGenerate,
  onRegenerate,
}: SettingsPanelProps) {
  const [showRefine, setShowRefine] = useState(false);

  const isLoading = step !== "idle" && step !== "done" && step !== "error";
  const isDone = step === "done" && result !== null;
  const canGenerate = !!images.front && !!images.back && !isLoading;

  const handleDownloadPng = () => {
    if (!result) return;
    // Convert to PNG via canvas if needed, or just download as-is
    downloadImage(result.outputUrl, `ghost-mannequin-${result.projectId.slice(0, 8)}.png`);
  };

  const handleDownloadWebP = () => {
    if (!result) return;
    downloadImage(result.outputUrl, `ghost-mannequin-${result.projectId.slice(0, 8)}.webp`);
  };

  return (
    <div className="w-72 shrink-0 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Settings</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">Configure and generate.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Project name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Project name
          </Label>
          <Input
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="e.g. Blue denim jacket"
            disabled={isLoading}
            className="text-sm border-gray-200 focus:border-gray-400 h-9"
          />
        </div>

        {/* Model info */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <span className="text-[11px] font-semibold text-gray-700">AI Model</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-900">
              Gemini 2.0 Flash
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Image-to-image generation. Sends your photos directly to Gemini and receives a
              ghost mannequin composite.
            </p>
          </div>
        </div>

        {/* Prompt (collapsed by default) */}
        <div>
          <button
            type="button"
            onClick={() => setShowRefine(!showRefine)}
            className="flex items-center justify-between w-full group"
          >
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Refine prompt
            </span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-gray-400 transition-transform duration-200",
                showRefine && "rotate-180"
              )}
            />
          </button>

          {showRefine && (
            <div className="mt-2.5 space-y-1.5">
              <Textarea
                value={refinePrompt}
                onChange={(e) => onRefinePromptChange(e.target.value)}
                placeholder="Optional extra instructions, e.g. 'make neckline cleaner' or 'ensure buttons are fully visible'"
                disabled={isLoading}
                className="text-xs border-gray-200 resize-none h-20 leading-relaxed"
              />
              <p className="text-[10px] text-gray-400">
                These are appended to the system prompt. Keep it minimal.
              </p>
            </div>
          )}
        </div>

        {/* Image checklist */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide block">
            Checklist
          </span>
          {[
            { key: "front" as const, label: "Front view", required: true },
            { key: "back" as const, label: "Back view", required: true },
            { key: "side" as const, label: "Side / detail", required: false },
          ].map(({ key, label, required }) => (
            <div key={key} className="flex items-center gap-2.5">
              <div
                className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  images[key]
                    ? "border-gray-900 bg-gray-900"
                    : required
                    ? "border-gray-300"
                    : "border-gray-200"
                )}
              >
                {images[key] && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                className={cn(
                  "text-xs",
                  images[key] ? "text-gray-700" : required ? "text-gray-500" : "text-gray-400"
                )}
              >
                {label}
                {!required && (
                  <span className="text-gray-400 ml-1 text-[10px]">(optional)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom action zone */}
      <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-3 shrink-0">
        {/* Result info */}
        {isDone && result && (
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2.5">
            <p className="text-[11px] font-semibold text-gray-700">Download</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-gray-200"
                onClick={handleDownloadPng}
              >
                <Download className="w-3 h-3" /> PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-gray-200"
                onClick={handleDownloadWebP}
              >
                <Download className="w-3 h-3" /> WebP
              </Button>
            </div>
            <a
              href={`/studio/projects`}
              className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View in projects
            </a>
          </div>
        )}

        {/* Regenerate */}
        {isDone && (
          <Button
            variant="outline"
            className="w-full gap-2 h-9 text-sm border-gray-200 text-gray-700"
            onClick={onRegenerate}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Regenerate
          </Button>
        )}

        <Separator className="bg-gray-100" />

        {/* Main Generate button */}
        <Button
          onClick={onGenerate}
          disabled={!canGenerate}
          className={cn(
            "w-full h-11 gap-2 font-semibold text-sm transition-all duration-200",
            canGenerate && !isLoading
              ? "bg-gray-900 text-white hover:bg-gray-700 shadow-sm"
              : isLoading
              ? "bg-gray-900 text-white opacity-80"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate Ghost Mannequin
            </>
          )}
        </Button>

        {!canGenerate && !isLoading && (
          <p className="text-[11px] text-center text-gray-400">
            Upload front &amp; back photos to continue
          </p>
        )}
      </div>
    </div>
  );
}
