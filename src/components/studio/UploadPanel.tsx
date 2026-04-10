"use client";

import { useRef, useCallback } from "react";
import { Upload, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { UploadedImages, UploadedPreviews } from "@/types";

interface UploadSlotProps {
  label: string;
  badge: string;
  badgeHighlight: boolean;
  hint: string;
  file: File | null;
  preview: string | null;
  disabled: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}

function UploadSlot({ label, badge, badgeHighlight, hint, file, preview, disabled, onFile, onRemove }: UploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) onFile(f);
  }, [disabled, onFile]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <span className={cn(
          "text-xs font-semibold px-2 py-0.5 rounded-full",
          badgeHighlight ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
        )}>
          {badge}
        </span>
      </div>

      <div
        onClick={() => !file && !disabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "relative rounded-xl border-2 transition-all duration-150",
          file ? "border-gray-200 bg-gray-50"
            : disabled ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
            : "border-dashed border-gray-200 hover:border-gray-400 hover:bg-gray-50 cursor-pointer"
        )}
        style={{ aspectRatio: "3/4" }}
      >
        {file && preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="w-full h-full object-cover rounded-[10px]" />
            {!disabled && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-600" />
              </button>
            )}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent rounded-b-[10px] px-2.5 py-2">
              <p className="text-white text-xs font-medium truncate">{file.name}</p>
              <p className="text-white/70 text-xs">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <Upload className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">{hint}</p>
              <p className="text-xs text-gray-400 mt-0.5">JPG · PNG · WebP · 10 MB</p>
            </div>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
        disabled={disabled} />
    </div>
  );
}

interface UploadPanelProps {
  images: UploadedImages;
  previews: UploadedPreviews;
  disabled: boolean;
  onImageChange: (key: keyof UploadedImages, file: File | null) => void;
}

export function UploadPanel({ images, previews, disabled, onImageChange }: UploadPanelProps) {
  const { t } = useLanguage();
  const hasFrontAndBack = !!images.front && !!images.back;
  const uploadedCount = [images.front, images.back, images.side].filter(Boolean).length;

  return (
    <div className="w-64 shrink-0 border-r border-gray-100 bg-white flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 border-b border-gray-50">
        <h2 className="text-base font-bold text-gray-900">{t("up_title")}</h2>
        <p className="text-sm text-gray-400 mt-1 leading-relaxed">{t("up_hint")}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <UploadSlot label={t("up_front")} badge={t("up_required")} badgeHighlight
          hint={t("up_front_hint")} file={images.front} preview={previews.front}
          disabled={disabled} onFile={(f) => onImageChange("front", f)} onRemove={() => onImageChange("front", null)} />
        <UploadSlot label={t("up_back")} badge={t("up_required")} badgeHighlight
          hint={t("up_back_hint")} file={images.back} preview={previews.back}
          disabled={disabled} onFile={(f) => onImageChange("back", f)} onRemove={() => onImageChange("back", null)} />
        <UploadSlot label={t("up_side")} badge={t("up_optional")} badgeHighlight={false}
          hint={t("up_side_hint")} file={images.side} preview={previews.side}
          disabled={disabled} onFile={(f) => onImageChange("side", f)} onRemove={() => onImageChange("side", null)} />
      </div>

      <div className="px-4 py-3 border-t border-gray-50">
        {!hasFrontAndBack ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-500">{t("up_needs_both")}</p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-sm text-gray-500">{uploadedCount} {t("up_ready")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
