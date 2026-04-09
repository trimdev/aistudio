"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Upload, X, Wand2, Loader2, ChevronDown, ChevronUp, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GhostMannequinResult } from "@/lib/ai/gemini";

type UploadedFile = { file: File; preview: string; label: string };
const FILE_LABELS = ["Front", "Back", "Interior / label"];

interface GeneratorFormProps {
  onResult: (result: GhostMannequinResult, projectId: string) => void;
}

export function GeneratorForm({ onResult }: GeneratorFormProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [projectName, setProjectName] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "generating" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const allowed = incoming
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 3 - files.length);
    if (!allowed.length) return;
    const newUploads: UploadedFile[] = allowed.map((file, i) => ({
      file,
      preview: URL.createObjectURL(file),
      label: FILE_LABELS[files.length + i] ?? `Image ${files.length + i + 1}`,
    }));
    setFiles((prev) => [...prev, ...newUploads].slice(0, 3));
  }, [files]);

  const removeFile = (i: number) => {
    setFiles((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[i].preview);
      next.splice(i, 1);
      return next;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleGenerate = async () => {
    if (!files.length) {
      toast.error("Upload at least one garment image.");
      return;
    }

    const name = projectName.trim() || `Project ${new Date().toLocaleDateString()}`;

    setStatus("uploading");
    setProgress(20);

    const formData = new FormData();
    files.forEach((u) => formData.append("images", u.file));
    formData.append("projectName", name);
    if (customPrompt) formData.append("customPrompt", customPrompt);

    setProgress(45);
    setStatus("generating");

    try {
      const res = await fetch("/api/generate", { method: "POST", body: formData });
      setProgress(85);

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Generation failed");
      }

      const { result, projectId } = await res.json();
      setProgress(100);
      setStatus("done");
      onResult(result, projectId);
      toast.success("Ghost mannequin analysis complete!");
    } catch (err: unknown) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const isLoading = status === "uploading" || status === "generating";
  const statusLabel =
    status === "uploading" ? "Uploading images…" :
    status === "generating" ? "Analysing garment…" : "";

  return (
    <div className="space-y-6">
      {/* Project name */}
      <div className="space-y-1.5">
        <Label htmlFor="project-name" className="text-sm font-medium text-gray-700">
          Project name
        </Label>
        <Input
          id="project-name"
          placeholder="e.g. Blue denim jacket – Season 2025"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          disabled={isLoading}
          className="border-gray-200 focus:border-gray-400"
        />
      </div>

      {/* Drop zone */}
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-2 block">
          Garment images{" "}
          <span className="font-normal text-gray-400">(1-3 photos: front, back, interior)</span>
        </Label>

        <div
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={cn(
            "border-2 border-dashed rounded-2xl transition-colors",
            files.length < 3
              ? "border-gray-200 hover:border-gray-300 cursor-pointer"
              : "border-gray-100 bg-gray-50"
          )}
          onClick={() => files.length < 3 && fileInputRef.current?.click()}
        >
          {files.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-gray-400">
              <Upload className="w-8 h-8" />
              <div className="text-center">
                <p className="text-sm font-medium">Drop images here or click to browse</p>
                <p className="text-xs mt-1">PNG, JPG, WebP up to 10 MB each</p>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex flex-wrap gap-3">
                {files.map((u, i) => (
                  <div key={i} className="relative group">
                    <div className="w-28 h-36 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u.preview} alt={u.label} className="w-full h-full object-cover" />
                    </div>
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-medium bg-white/90 px-2 py-0.5 rounded-full text-gray-600 whitespace-nowrap shadow-sm">
                      {u.label}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                ))}
                {files.length < 3 && (
                  <div className="w-28 h-36 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-gray-300 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-[11px]">Add image</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {/* Advanced options */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Advanced options
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Custom prompt (optional)</Label>
            <Textarea
              placeholder="Any specific instructions for the AI, e.g. 'focus on the collar detail' or 'add wrinkle-free finish'"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={isLoading}
              className="border-gray-200 resize-none h-24 text-sm"
            />
          </div>
        )}
      </div>

      {/* Progress */}
      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{statusLabel}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-gray-100" />
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={isLoading || !files.length}
        className="w-full bg-gray-900 text-white hover:bg-gray-700 h-11 gap-2 font-medium"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {statusLabel}
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4" />
            Generate ghost mannequin shot
          </>
        )}
      </Button>
    </div>
  );
}
