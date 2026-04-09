"use client";

import { useRef, useCallback } from "react";
import { Upload, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadedImages, UploadedPreviews } from "@/types";

interface UploadSlotProps {
  label: string;
  badge: "Required" | "Optional";
  hint: string;
  file: File | null;
  preview: string | null;
  disabled: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}

function UploadSlot({
  label,
  badge,
  hint,
  file,
  preview,
  disabled,
  onFile,
  onRemove,
}: UploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) onFile(f);
    },
    [disabled, onFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = "";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          {label}
        </span>
        <span
          className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
            badge === "Required"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-500"
          )}
        >
          {badge}
        </span>
      </div>

      {/* Slot card */}
      <div
        onClick={() => !file && !disabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "relative rounded-xl border-2 transition-all duration-150",
          file
            ? "border-gray-200 bg-gray-50"
            : disabled
            ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
            : "border-dashed border-gray-200 hover:border-gray-400 hover:bg-gray-50 cursor-pointer"
        )}
        style={{ aspectRatio: "3/4" }}
      >
        {file && preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={label}
              className="w-full h-full object-cover rounded-[10px]"
            />
            {/* Remove button */}
            {!disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-600" />
              </button>
            )}
            {/* File name overlay */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/40 to-transparent rounded-b-[10px] px-2.5 py-2">
              <p className="text-white text-[10px] font-medium truncate">
                {file.name}
              </p>
              <p className="text-white/70 text-[10px]">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Upload className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-medium text-gray-500">{hint}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                JPG · PNG · WebP · 10 MB
              </p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}

interface UploadPanelProps {
  images: UploadedImages;
  previews: UploadedPreviews;
  disabled: boolean;
  onImageChange: (key: keyof UploadedImages, file: File | null) => void;
}

export function UploadPanel({
  images,
  previews,
  disabled,
  onImageChange,
}: UploadPanelProps) {
  const hasFrontAndBack = !!images.front && !!images.back;
  const uploadedCount = [images.front, images.back, images.side].filter(Boolean).length;

  return (
    <div className="w-64 shrink-0 border-r border-gray-100 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">Garment Photos</h2>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
          Upload the garment on a mannequin, model, or hanger.
        </p>
      </div>

      {/* Slots */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <UploadSlot
          label="Front View"
          badge="Required"
          hint="Front of garment"
          file={images.front}
          preview={previews.front}
          disabled={disabled}
          onFile={(f) => onImageChange("front", f)}
          onRemove={() => onImageChange("front", null)}
        />
        <UploadSlot
          label="Back View"
          badge="Required"
          hint="Back of garment"
          file={images.back}
          preview={previews.back}
          disabled={disabled}
          onFile={(f) => onImageChange("back", f)}
          onRemove={() => onImageChange("back", null)}
        />
        <UploadSlot
          label="Side / Detail"
          badge="Optional"
          hint="Side angle or close-up"
          file={images.side}
          preview={previews.side}
          disabled={disabled}
          onFile={(f) => onImageChange("side", f)}
          onRemove={() => onImageChange("side", null)}
        />
      </div>

      {/* Footer status */}
      <div className="px-4 py-3 border-t border-gray-50">
        {!hasFrontAndBack ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-500">
              Front and back photos are required.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <p className="text-[11px] text-gray-500">
              {uploadedCount} photo{uploadedCount !== 1 ? "s" : ""} ready
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
