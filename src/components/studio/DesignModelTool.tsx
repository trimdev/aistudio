"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Upload,
  X,
  Download,
  ImageOff,
  Loader2,
  Wand2,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ZoomIn,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { compressImage, downloadFile as downloadImage } from "@/lib/image-utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  DESIGN_MODELS,
  DESIGN_BACKGROUNDS,
  DESIGN_POSES,
  type DesignModel,
  type DesignBackground,
  type DesignPose,
} from "@/lib/design-model-data";

type ModelFilter = "all" | "slavic" | "french" | "blonde" | "brunette";
type BgFilter = "all" | "studio" | "lifestyle";

type GenerationStep =
  | "idle"
  | "uploading"
  | "analyzing"
  | "fitting"
  | "styling"
  | "finalizing"
  | "done"
  | "error";

const STEP_LABELS: Record<GenerationStep, string> = {
  idle:       "",
  uploading:  "Képek feltöltése...",
  analyzing:  "Ruha elemzése...",
  fitting:    "Modellre szabás...",
  styling:    "Stílusozás...",
  finalizing: "Véglegesítés...",
  done:       "Kész",
  error:      "Hiba",
};

const STEP_SCHEDULE: Array<[GenerationStep, number]> = [
  ["uploading",  0],
  ["analyzing",  3_000],
  ["fitting",    9_000],
  ["styling",    18_000],
  ["finalizing", 28_000],
];

interface SlotResult {
  status: "idle" | "loading" | "done" | "error";
  url: string | null;
  error: string | null;
  modelId: string;
  poseId: string;
  projectId?: string;
}

// A pose assignment for a model slot: which poseId to use for a given (modelIdx, slotIdx)
interface PoseAssignment {
  modelIdx: number;
  slotIdx: number;
  poseId: string;
}

// Step progress indicator

const WIZARD_STEPS = ["Modell", "Ruha", "Háttér & Póz", "Generálás"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 px-6">
      {WIZARD_STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                i < current
                  ? "bg-gray-950 text-white"
                  : i === current
                  ? "bg-gray-950 text-white ring-4 ring-gray-200"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-[10px] font-semibold mt-1 whitespace-nowrap",
                i === current ? "text-gray-950" : i < current ? "text-gray-500" : "text-gray-300"
              )}
            >
              {label}
            </span>
          </div>
          {i < WIZARD_STEPS.length - 1 && (
            <div
              className={cn(
                "h-px w-12 mx-1 mb-4 transition-colors",
                i < current ? "bg-gray-950" : "bg-gray-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ModelCard({
  model,
  selected,
  onClick,
}: {
  model: DesignModel;
  selected: boolean;
  onClick: () => void;
}) {
  const originFlag = model.origin === "french" ? "🇫🇷" : "🌍";
  const originLabel = model.origin === "french" ? "French" : "Slavic";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col rounded-2xl border-2 transition-all text-left group overflow-hidden",
        selected
          ? "border-gray-950 shadow-lg ring-2 ring-gray-950 ring-offset-1"
          : "border-gray-100 hover:border-gray-300 hover:shadow-sm"
      )}
    >
      {/* Portrait image */}
      <div className="w-full aspect-[3/4] bg-gray-100 shrink-0 relative">
        <img
          src={model.portraitPath}
          alt={model.name}
          className="w-full h-full object-cover object-top"
          loading="lazy"
        />
        {/* Selected overlay */}
        {selected && (
          <div className="absolute inset-0 bg-gray-950/20" />
        )}
        {/* Selected checkmark badge */}
        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-950 flex items-center justify-center shadow-md">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      <div className={cn("p-2 text-center transition-colors", selected ? "bg-gray-950" : "bg-white")}>
        <p className={cn("text-xs font-bold leading-tight", selected ? "text-white" : "text-gray-900")}>{model.name}</p>
        <p className={cn("text-[10px] font-medium mt-0.5", selected ? "text-gray-300" : "text-gray-400")}>{model.style}</p>
      </div>

    </button>
  );
}

interface UploadSlotProps {
  label: string;
  required?: boolean;
  file: File | null;
  preview: string | null;
  disabled?: boolean;
  onFile: (f: File | null) => void;
}

function UploadSlot({ label, required, file, preview, disabled, onFile }: UploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) onFile(f);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
        {!required && <span className="text-gray-400 ml-1 text-[10px]">(opcionális)</span>}
      </label>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative aspect-[3/4] rounded-xl border-2 overflow-hidden cursor-pointer transition-all",
          file
            ? "border-gray-300 bg-gray-50"
            : dragging
            ? "border-gray-400 bg-gray-50"
            : "border-dashed border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="w-full h-full object-cover" />
            {!disabled && (
              <button
                onClick={(e) => { e.stopPropagation(); onFile(null); }}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors"
              >
                <X className="w-3 h-3 text-gray-600" />
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
            <Upload className="w-5 h-5" />
            <span className="text-[10px] font-medium text-gray-400">Feltöltés</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; onFile(f ?? null); e.target.value = ""; }}
      />
    </div>
  );
}

function BackgroundCard({
  bg,
  selected,
  onClick,
  lang,
}: {
  bg: DesignBackground;
  selected: boolean;
  onClick: () => void;
  lang: "en" | "hu";
}) {
  const label = lang === "hu" ? bg.label_hu : bg.label_en;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col rounded-xl border-2 overflow-hidden transition-all text-left group",
        selected
          ? "border-gray-950 shadow-lg"
          : "border-gray-100 hover:border-gray-300 hover:shadow-sm"
      )}
    >
      {/* Preview image */}
      <div className="w-full aspect-[4/3] bg-gray-100 overflow-hidden relative">
        <img
          src={bg.imagePath}
          alt={label}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Type badge */}
        <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide bg-black/50 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm">
          {bg.type === "studio" ? "Studio" : "Outdoor"}
        </span>
      </div>
      <div className="p-2">
        <p className="text-[11px] font-semibold text-gray-800 leading-tight">{label}</p>
      </div>
      {selected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-gray-950 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}

function PoseChip({
  pose,
  selected,
  onClick,
  lang,
}: {
  pose: DesignPose;
  selected: boolean;
  onClick: () => void;
  lang: "en" | "hu";
}) {
  const label = lang === "hu" ? pose.label_hu : pose.label_en;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center",
        selected
          ? "border-gray-950 bg-gray-950 text-white shadow-md"
          : "border-gray-100 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-colors",
        selected ? "bg-white/10" : "bg-gray-50"
      )}>
        {pose.icon}
      </div>
      <span className="text-[11px] font-semibold leading-tight">{label}</span>
    </button>
  );
}

function PoseSlotRow({
  count,
  poses,
  lang,
  onChange,
}: {
  count: number;
  poses: string[];
  lang: "en" | "hu";
  onChange: (slotIdx: number, poseId: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: count }, (_, i) => {
        const currentPose = poses[i] ?? DESIGN_POSES[i % DESIGN_POSES.length].id;
        return (
          <div key={i} className="shrink-0 flex flex-col gap-2" style={{ width: 360 }}>
            <p className="text-xs font-bold text-gray-400 text-center">Fotó #{i + 1}</p>
            <div className="grid grid-cols-2 gap-3">
              {DESIGN_POSES.map((pose) => {
                const selected = currentPose === pose.id;
                const label = lang === "hu" ? pose.label_hu : pose.label_en;
                return (
                  <button
                    key={pose.id}
                    type="button"
                    onClick={() => onChange(i, pose.id)}
                    title={label}
                    className={cn(
                      "flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 text-center transition-all",
                      selected
                        ? "border-gray-950 bg-gray-950 text-white shadow-md"
                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-300 hover:shadow-sm"
                    )}
                  >
                    <span className="text-2xl leading-none">{pose.icon}</span>
                    <span className="text-[11px] font-semibold leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultCard({
  slot,
  index,
  modelName,
  poseName,
  onRetry,
  onOpen,
}: {
  slot: SlotResult;
  index: number;
  modelName: string;
  poseName: string;
  onRetry: () => void;
  onOpen: (url: string) => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm group">
      <div className="relative aspect-[3/4] bg-gray-50 flex items-center justify-center">
        {slot.status === "idle" && (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <ImageOff className="w-6 h-6" />
            <span className="text-[10px] font-medium text-gray-400">#{index + 1}</span>
          </div>
        )}
        {slot.status === "loading" && (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-gray-400 animate-spin" />
            <span className="text-[11px] font-medium text-gray-500">Generálás…</span>
          </div>
        )}
        {slot.status === "done" && slot.url && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slot.url} alt={`${modelName} – ${poseName}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onOpen(slot.url!)}
              className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center"
            >
              <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
            </button>
          </>
        )}
        {slot.status === "error" && (
          <div className="flex flex-col items-center gap-2 px-3 text-center">
            <X className="w-5 h-5 text-red-300" />
            <span className="text-[10px] text-red-400 leading-relaxed">{slot.error ?? "Hiba"}</span>
            <button
              onClick={onRetry}
              className="flex items-center gap-1 text-[10px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-full transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Újra
            </button>
          </div>
        )}
        <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-black/30 text-white px-1.5 py-0.5 rounded-full">
          #{index + 1}
        </span>
      </div>
      <div className="px-2 py-1.5 border-t border-gray-50">
        <p className="text-[10px] font-semibold text-gray-700 truncate">{modelName}</p>
        <p className="text-[10px] text-gray-400 truncate">{poseName}</p>
      </div>
      {slot.status === "done" && slot.url && (
        <div className="flex gap-1 p-1.5 pt-0">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-[10px] gap-1 border-gray-100 px-1"
            onClick={() => downloadImage(slot.url!, `${modelName}-${poseName}.png`)}
          >
            <Download className="w-3 h-3" /> PNG
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-[10px] gap-1 border-gray-100 px-1"
            onClick={() => downloadImage(slot.url!, `${modelName}-${poseName}.webp`)}
          >
            <Download className="w-3 h-3" /> WebP
          </Button>
        </div>
      )}
    </div>
  );
}


interface DesignModelToolProps {
  collectionId: string | null;
}

export function DesignModelTool({ collectionId: collectionIdProp }: DesignModelToolProps) {
  const { lang } = useLanguage();

  const [activeCollectionId] = useState<string | null>(collectionIdProp);

  const [ghostPhotos, setGhostPhotos] = useState<Array<{ id: string; name: string; output_image_url: string | null }>>([]);
  const [selectedGhostId, setSelectedGhostId] = useState<string | null>(null);
  const [ghostLoading, setGhostLoading] = useState(false);

  const [step, setStep] = useState(0);

  const [modelFilter, setModelFilter] = useState<ModelFilter>("all");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [sideFile, setSideFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [sidePreview, setSidePreview] = useState<string | null>(null);

  const [bgFilter, setBgFilter] = useState<BgFilter>("all");
  const [selectedBgId, setSelectedBgId] = useState<string>("studio_white");
  // Single model: count 1=single; per-slot poses array
  const [singlePhotoCount, setSinglePhotoCount] = useState<1 | 2 | 4 | 6 | 8>(1);
  const [singlePoseId, setSinglePoseId] = useState<string>("standing_natural");
  const [singlePhotoPoses, setSinglePhotoPoses] = useState<string[]>([]);
  // Multi-model: count per model + per-model per-slot poses (string[])
  const [multiModelPhotoCount, setMultiModelPhotoCount] = useState<1 | 2 | 4>(1);
  const [perModelPoses, setPerModelPoses] = useState<Record<string, string[]>>({});

  const [projectName, setProjectName] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [results, setResults] = useState<SlotResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [genStep, setGenStep] = useState<GenerationStep>("idle");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const abortRef = useRef(false);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      if (backPreview) URL.revokeObjectURL(backPreview);
      if (sidePreview) URL.revokeObjectURL(sidePreview);
      stepTimers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch ghost photos for the active collection
  useEffect(() => {
    if (!activeCollectionId) return;
    setGhostLoading(true);
    fetch(`/api/projects?collectionId=${activeCollectionId}`)
      .then((r) => r.json())
      .then((projects: Array<{ id: string; name: string; status: string; prompt_used?: string | null; output_image_url?: string | null }>) => {
        const ghosts = projects.filter(
          (p) =>
            p.status === "completed" &&
            p.output_image_url &&
            !p.prompt_used?.startsWith("model-") &&
            !p.prompt_used?.startsWith("design-model-")
        );
        setGhostPhotos(ghosts.map((p) => ({ id: p.id, name: p.name, output_image_url: p.output_image_url ?? null })));
      })
      .catch(() => {})
      .finally(() => setGhostLoading(false));
  }, [activeCollectionId]);

  const isMultiModel = selectedModelIds.length > 1;
  const selectedModels = DESIGN_MODELS.filter((m) => selectedModelIds.includes(m.id));

  const filteredModels = DESIGN_MODELS.filter((m) => {
    if (modelFilter === "slavic") return m.origin === "slavic";
    if (modelFilter === "french") return m.origin === "french";
    if (modelFilter === "blonde") return m.hairColor === "blonde";
    if (modelFilter === "brunette") return m.hairColor === "brunette";
    return true;
  });

  const filteredBgs = DESIGN_BACKGROUNDS.filter((b) => {
    if (bgFilter === "studio") return b.type === "studio";
    if (bgFilter === "lifestyle") return b.type === "lifestyle";
    return true;
  });

  // Build the generation slots list
  const buildSlots = useCallback((): Array<{ modelId: string; poseId: string }> => {
    if (isMultiModel) {
      return selectedModels.flatMap((m) =>
        Array.from({ length: multiModelPhotoCount }, (_, slotIdx) => ({
          modelId: m.id,
          poseId: perModelPoses[m.id]?.[slotIdx] ?? DESIGN_POSES[slotIdx % DESIGN_POSES.length].id,
        }))
      );
    } else {
      const modelId = selectedModelIds[0];
      if (!modelId) return [];
      if (singlePhotoCount === 1) {
        return [{ modelId, poseId: singlePoseId }];
      }
      return Array.from({ length: singlePhotoCount }, (_, i) => ({
        modelId,
        poseId: singlePhotoPoses[i] ?? DESIGN_POSES[i % DESIGN_POSES.length].id,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedModelIds, isMultiModel, selectedModels,
    perModelPoses, multiModelPhotoCount,
    singlePhotoCount, singlePhotoPoses, singlePoseId,
  ]);

  const totalPhotos = buildSlots().length;

  // Auto-set project name when models change
  useEffect(() => {
    if (selectedModels.length > 0 && !projectName) {
      setProjectName(`Design – ${selectedModels[0].name}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModelIds]);

  function makeFileHandler(
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
    prevPreview: string | null
  ) {
    return (f: File | null) => {
      if (prevPreview) URL.revokeObjectURL(prevPreview);
      setFile(f);
      setPreview(f ? URL.createObjectURL(f) : null);
    };
  }

  const handleFront = makeFileHandler(setFrontFile, setFrontPreview, frontPreview);
  const handleBack = makeFileHandler(setBackFile, setBackPreview, backPreview);
  const handleSide = makeFileHandler(setSideFile, setSidePreview, sidePreview);

  function startStepAnimation() {
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
    STEP_SCHEDULE.forEach(([s, delay]) => {
      const id = setTimeout(() => setGenStep(s), delay);
      stepTimers.current.push(id);
    });
  }

  function stopStepAnimation() {
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
  }

  async function generateSlot(
    slotIndex: number,
    modelId: string,
    poseId: string,
    name: string,
    seriesInfo?: { index: number; total: number },
    ghostId?: string | null
  ): Promise<void> {
    const model = DESIGN_MODELS.find((m) => m.id === modelId)!;
    const bg = DESIGN_BACKGROUNDS.find((b) => b.id === selectedBgId)!;
    const pose = DESIGN_POSES.find((p) => p.id === poseId)!;

    setResults((prev) => {
      const next = [...prev];
      next[slotIndex] = { status: "loading", url: null, error: null, modelId, poseId };
      return next;
    });
    setCurrentSlot(slotIndex);
    setGenStep("idle");
    startStepAnimation();

    try {
      const fd = new FormData();

      if (ghostId) {
        fd.append("ghostProjectId", ghostId);
      } else {
        const [cFront, cBack, cSide] = await Promise.all([
          compressImage(frontFile!),
          backFile ? compressImage(backFile) : Promise.resolve(null),
          sideFile ? compressImage(sideFile) : Promise.resolve(null),
        ]);
        fd.append("front", cFront, "front.jpg");
        if (cBack) fd.append("back", cBack, "back.jpg");
        if (cSide) fd.append("side", cSide, "side.jpg");
      }
      fd.append("modelId", modelId);
      fd.append("backgroundId", bg.id);
      fd.append("poseId", poseId);
      fd.append("projectName", `${name} – ${model.name} ${pose.label_en}`);
      if (activeCollectionId) fd.append("collectionId", activeCollectionId);
      if (extraPrompt.trim()) fd.append("extraPrompt", extraPrompt.trim());
      if (seriesInfo) {
        fd.append("seriesIndex", String(seriesInfo.index));
        fd.append("seriesTotal", String(seriesInfo.total));
      }

      const res = await fetch("/api/generate-design-model", { method: "POST", body: fd });
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { throw new Error(`Server error ${res.status}`); }
      if (!res.ok) throw new Error((data.error as string) || `Server error ${res.status}`);

      stopStepAnimation();
      setGenStep("done");
      const returnedProjectId = data.projectId as string | undefined;
      setResults((prev) => {
        const next = [...prev];
        next[slotIndex] = { status: "done", url: data.outputUrl as string, error: null, modelId, poseId, projectId: returnedProjectId };
        return next;
      });
      toast.success(`${model.name} – ${pose.label_en} kész`);
    } catch (err) {
      stopStepAnimation();
      setGenStep("error");
      const msg = err instanceof Error ? err.message : "Generálás sikertelen";
      setResults((prev) => {
        const next = [...prev];
        next[slotIndex] = { status: "error", url: null, error: msg, modelId, poseId };
        return next;
      });
      toast.error(`Hiba: ${msg}`);
    }
  }

  const handleGenerate = useCallback(async () => {
    if (!frontFile && !selectedGhostId) {
      toast.error("Tölts fel ruhafotót, vagy válassz ghost fotót.");
      return;
    }
    const slots = buildSlots();
    if (slots.length === 0) return;

    abortRef.current = false;
    setIsRunning(true);

    const name = projectName.trim() || `Design – ${new Date().toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}`;

    const initialResults: SlotResult[] = slots.map((s) => ({
      status: "idle",
      url: null,
      error: null,
      modelId: s.modelId,
      poseId: s.poseId,
    }));
    setResults(initialResults);

    const total = slots.length;
    for (let i = 0; i < slots.length; i++) {
      if (abortRef.current) break;
      await generateSlot(i, slots[i].modelId, slots[i].poseId, name, total > 1 ? { index: i, total } : undefined, selectedGhostId);
      if (i < slots.length - 1 && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 4_000));
      }
    }

    setIsRunning(false);
    setCurrentSlot(null);
    setGenStep("idle");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontFile, selectedGhostId, buildSlots, projectName, extraPrompt, activeCollectionId, selectedBgId]);


  const handleRetry = useCallback(async (slotIndex: number) => {
    const slots = buildSlots();
    const slot = slots[slotIndex];
    if (!slot) return;
    const name = projectName.trim() || "Design";
    await generateSlot(slotIndex, slot.modelId, slot.poseId, name, undefined, selectedGhostId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildSlots, projectName, extraPrompt, activeCollectionId, selectedBgId, frontFile, selectedGhostId]);

  const handleStop = () => {
    abortRef.current = true;
    stopStepAnimation();
    setIsRunning(false);
    setCurrentSlot(null);
    setGenStep("idle");
  };

  const handleReset = () => {
    abortRef.current = true;
    setIsRunning(false);
    setResults([]);
    setCurrentSlot(null);
    setGenStep("idle");
    setStep(0);
  };

  const canProceed0 = selectedModelIds.length > 0;
  const canProceed1 = !!frontFile || !!selectedGhostId;
  const canProceed2 = !!selectedBgId;

  const hasResults = results.length > 0;
  const allDone = results.length > 0 && results.every((r) => r.status === "done" || r.status === "error");

  if (!activeCollectionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto">
            <FolderOpen className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Projekt mappa szükséges</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            A design modell fotó generáláshoz először hozz létre vagy válassz ki egy projekt mappát.
            Navigálj a <strong>Projektek</strong> oldalra, és onnan indítsd a generálást.
          </p>
          <a
            href="/studio/projects"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Projektek megnyitása
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0">
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Design Studio</p>
        <h1 className="text-lg font-bold text-gray-950 mt-0.5">Design Modell Fotó</h1>
      </div>

      {/* ── Step indicator ────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0 flex items-center justify-between">
        <StepIndicator current={step} />
        {hasResults && !isRunning && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs border-gray-200 text-gray-600 h-8" onClick={handleReset}>
            <RotateCcw className="w-3 h-3" /> Újrakezdés
          </Button>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 pb-2">
        <AnimatePresence mode="sync">
          {/* ══ STEP 0: Select Models ══ */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-6 space-y-5"
            >
              <div>
                <h2 className="text-base font-bold text-gray-900">Válassz modellt</h2>
                <p className="text-sm text-gray-400 mt-0.5">Több modellt is kiválaszthatsz — minden modellhez egy fotó generálódik.</p>
              </div>

              {/* Filter bar */}
              <div className="flex gap-2 flex-wrap">
                {(["all", "slavic", "french", "blonde", "brunette"] as ModelFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setModelFilter(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                      modelFilter === f
                        ? "bg-gray-950 text-white border-gray-950"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    )}
                  >
                    {f === "all" ? "Mind" : f === "slavic" ? "Szláv" : f === "french" ? "Francia" : f === "blonde" ? "Szőke" : "Barna"}
                  </button>
                ))}
                {selectedModelIds.length > 0 && (
                  <span className="ml-auto text-xs font-semibold text-gray-500 self-center">
                    {selectedModelIds.length} kiválasztva
                  </span>
                )}
              </div>

              {/* Model grid — 5 per row on large, responsive */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    selected={selectedModelIds.includes(model.id)}
                    onClick={() => {
                      setSelectedModelIds((prev) =>
                        prev.includes(model.id)
                          ? prev.filter((id) => id !== model.id)
                          : [...prev, model.id]
                      );
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ══ STEP 1: Upload Garment ══ */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-6 space-y-5 max-w-2xl"
            >
              <div>
                <h2 className="text-base font-bold text-gray-900">Ruha feltöltése</h2>
                <p className="text-sm text-gray-400 mt-0.5">Töltsd fel a ruha fotóit. Az elöl nézet kötelező.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <UploadSlot
                  label="Elöl nézet"
                  required
                  file={frontFile}
                  preview={frontPreview}
                  onFile={handleFront}
                />
                <UploadSlot
                  label="Hátul nézet"
                  file={backFile}
                  preview={backPreview}
                  onFile={handleBack}
                />
                <UploadSlot
                  label="Oldal / Részlet"
                  file={sideFile}
                  preview={sidePreview}
                  onFile={handleSide}
                />
              </div>

              <div className="rounded-xl bg-gray-100 border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-600 mb-1">Tipp</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Minél több nézetet töltesz fel, annál pontosabb lesz az AI által generált fotó.
                  A hátul és oldal nézetek segítenek a ruha részleteinek pontos megjelenítésében.
                </p>
              </div>

              {/* Ghost photo picker — shown only when the collection has ghost photos */}
              {(ghostLoading || ghostPhotos.length > 0) && (
                <div className="space-y-3 pt-1">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ghost fotók a projektből</p>
                    <p className="text-xs text-gray-500 mt-0.5">Válassz ghost fotót az elöl nézethez, vagy tölts fel sajátot felül.</p>
                  </div>

                  {ghostLoading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Betöltés…</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {ghostPhotos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => setSelectedGhostId((prev) => prev === photo.id ? null : photo.id)}
                          className={cn(
                            "relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-1 transition-all",
                            selectedGhostId === photo.id
                              ? "border-gray-950 shadow-md"
                              : "border-gray-200 hover:border-gray-400"
                          )}
                        >
                          {photo.output_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo.output_image_url}
                              alt={photo.name}
                              className="w-24 h-24 object-contain rounded-lg bg-gray-50"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center">
                              <ImageOff className="w-6 h-6 text-gray-300" />
                            </div>
                          )}
                          <span className="text-[10px] text-gray-600 font-medium max-w-[96px] truncate">{photo.name}</span>
                          {selectedGhostId === photo.id && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-950 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedGhostId && (
                    <p className="text-xs text-gray-600 font-medium">Ghost fotó kiválasztva — ruhafeltöltés nem szükséges</p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ══ STEP 2: Background & Pose ══ */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-6 space-y-8"
            >
              {/* ── Background ── */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Háttér</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Válassz helyszínt a fotóhoz.</p>
                </div>
                <div className="flex gap-2">
                  {(["all", "studio", "lifestyle"] as BgFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setBgFilter(f)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        bgFilter === f
                          ? "bg-gray-950 text-white border-gray-950"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                      )}
                    >
                      {f === "all" ? "Mind" : f === "studio" ? "Stúdió" : "Lifestyle"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredBgs.map((bg) => (
                    <BackgroundCard
                      key={bg.id}
                      bg={bg}
                      selected={selectedBgId === bg.id}
                      onClick={() => setSelectedBgId(bg.id)}
                      lang={lang as "en" | "hu"}
                    />
                  ))}
                </div>
              </div>

              {/* ── Pose ── */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Póz</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Válassz pózokat minden fotóhoz.
                  </p>
                </div>

                {isMultiModel ? (
                  /* Multi-model */
                  <div className="space-y-6">
                    {/* Count per model */}
                    <div className="flex items-center gap-4">
                      <p className="text-xs font-semibold text-gray-700 shrink-0">Fotók modellenként</p>
                      <div className="flex gap-2">
                        {([1, 2, 4] as const).map((n) => (
                          <button
                            key={n}
                            onClick={() => setMultiModelPhotoCount(n)}
                            className={cn(
                              "w-10 h-9 rounded-xl text-sm font-bold border transition-all",
                              multiModelPhotoCount === n
                                ? "bg-gray-950 text-white border-gray-950"
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        = {selectedModels.length * multiModelPhotoCount} fotó összesen
                      </p>
                    </div>

                    {/* Per-model: slots side by side */}
                    <div className="space-y-6">
                      {selectedModels.map((model) => (
                        <div key={model.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md overflow-hidden shrink-0">
                              <img src={model.portraitPath} alt={model.name} className="w-full h-full object-cover object-top" />
                            </div>
                            <p className="text-sm font-bold text-gray-800">{model.name}</p>
                          </div>
                          <PoseSlotRow
                            count={multiModelPhotoCount}
                            poses={perModelPoses[model.id] ?? []}
                            lang={lang as "en" | "hu"}
                            onChange={(slotIdx, poseId) =>
                              setPerModelPoses((prev) => {
                                const arr = [...(prev[model.id] ?? [])];
                                arr[slotIdx] = poseId;
                                return { ...prev, [model.id]: arr };
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Single model */
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <p className="text-xs font-semibold text-gray-700 shrink-0">Fotók száma</p>
                      <div className="flex gap-2">
                        {([1, 2, 4, 6, 8] as const).map((n) => (
                          <button
                            key={n}
                            onClick={() => {
                              setSinglePhotoCount(n);
                              setSinglePhotoPoses((prev) => {
                                const next = [...prev];
                                while (next.length < n) next.push(DESIGN_POSES[next.length % DESIGN_POSES.length].id);
                                return next.slice(0, n);
                              });
                            }}
                            className={cn(
                              "w-10 h-9 rounded-xl text-sm font-bold border transition-all",
                              singlePhotoCount === n
                                ? "bg-gray-950 text-white border-gray-950"
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {singlePhotoCount === 1 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {DESIGN_POSES.map((pose) => (
                          <PoseChip
                            key={pose.id}
                            pose={pose}
                            selected={singlePoseId === pose.id}
                            onClick={() => setSinglePoseId(pose.id)}
                            lang={lang as "en" | "hu"}
                          />
                        ))}
                      </div>
                    ) : (
                      <PoseSlotRow
                        count={singlePhotoCount}
                        poses={singlePhotoPoses}
                        lang={lang as "en" | "hu"}
                        onChange={(i, poseId) =>
                          setSinglePhotoPoses((prev) => {
                            const next = [...prev];
                            while (next.length <= i) next.push(DESIGN_POSES[next.length % DESIGN_POSES.length].id);
                            next[i] = poseId;
                            return next;
                          })
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══ STEP 3: Configure & Generate ══ */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-6 space-y-6"
            >
              {/* Config row */}
              {!hasResults && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-3xl">
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">Konfiguráció</h2>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-gray-700">Projekt neve</Label>
                      <Input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="pl. Design – Zoya"
                        disabled={isRunning}
                        className="h-10 text-sm border-gray-200 focus:border-gray-400"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-gray-700">
                        Egyéni utasítás <span className="text-gray-400 font-normal text-xs">(opcionális)</span>
                      </Label>
                      <Textarea
                        value={extraPrompt}
                        onChange={(e) => setExtraPrompt(e.target.value)}
                        placeholder="pl. sötétebb háttér tónus, dinamikusabb megjelenítés..."
                        disabled={isRunning}
                        rows={3}
                        className="text-sm border-gray-200 focus:border-gray-400 resize-none"
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-700">Összefoglaló</h3>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Modellek</span>
                        <span className="font-semibold text-gray-900">{selectedModels.map((m) => m.name).join(", ")}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Háttér</span>
                        <span className="font-semibold text-gray-900">
                          {lang === "hu"
                            ? (DESIGN_BACKGROUNDS.find((b) => b.id === selectedBgId)?.label_hu ?? "—")
                            : (DESIGN_BACKGROUNDS.find((b) => b.id === selectedBgId)?.label_en ?? "—")}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Fotók száma</span>
                        <span className="font-bold text-gray-950">{totalPhotos}</span>
                      </div>
                    </div>

                    <Button
                      onClick={handleGenerate}
                      disabled={isRunning}
                      className="w-full h-12 gap-2 font-bold text-sm bg-gray-950 text-white hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Wand2 className="w-4 h-4" />
                      {totalPhotos} fotó generálása
                    </Button>
                  </div>
                </div>
              )}

              {/* Progress indicator */}
              {isRunning && currentSlot !== null && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 max-w-sm">
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {currentSlot + 1} / {totalPhotos} — {STEP_LABELS[genStep]}
                    </p>
                    <p className="text-[11px] text-gray-400">A Studio AI dolgozik…</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-8 text-xs border-gray-300 text-gray-600 shrink-0"
                    onClick={handleStop}
                  >
                    Leállítás
                  </Button>
                </div>
              )}

              {/* Results grid */}
              {hasResults && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">
                      Generált fotók —{" "}
                      {results.filter((r) => r.status === "done").length}/{results.length} kész
                    </h3>
                    {allDone && (
                      <a
                        href="/studio/projects"
                        className="text-xs font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900 transition-colors"
                      >
                        Megtekintés a projektekben →
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {results.map((slot, i) => {
                      const model = DESIGN_MODELS.find((m) => m.id === slot.modelId);
                      const pose = DESIGN_POSES.find((p) => p.id === slot.poseId);
                      return (
                        <ResultCard
                          key={i}
                          slot={slot}
                          index={i}
                          modelName={model?.name ?? slot.modelId}
                          poseName={lang === "hu" ? (pose?.label_hu ?? slot.poseId) : (pose?.label_en ?? slot.poseId)}
                          onRetry={() => handleRetry(i)}
                          onOpen={(url) => setLightboxUrl(url)}
                        />
                      );
                    })}
                  </div>

                  {!isRunning && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        className="gap-2 border-gray-200 text-gray-700 h-9 text-sm"
                        onClick={handleReset}
                      >
                        <RotateCcw className="w-4 h-4" /> Mentés és új generálás
                      </Button>
                      <Link
                        href={activeCollectionId ? `/studio/projects/${activeCollectionId}` : "/studio/projects"}
                        className="flex items-center gap-2 px-4 h-9 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                      >
                        Vissza a projektekhez
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Navigation footer — pinned below scroll area, always visible ─── */}
      {!hasResults && (
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-between">
          <button
            type="button"
            onClick={() => { if (step > 0 && !isRunning) setStep((s) => s - 1); }}
            disabled={step === 0 || isRunning}
            className={cn(
              "flex items-center gap-2 px-4 h-10 rounded-lg border text-sm font-semibold transition-colors",
              step === 0 || isRunning
                ? "border-gray-100 text-gray-300 cursor-not-allowed"
                : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <ChevronLeft className="w-4 h-4" /> Vissza
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && selectedModels.length > 0 && (
              <div className="hidden sm:flex gap-1.5">
                {selectedModels.slice(0, 3).map((m) => (
                  <span key={m.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                    {m.name}
                  </span>
                ))}
                {selectedModels.length > 3 && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                    +{selectedModels.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (isRunning) return;
                if (step === 0 && !canProceed0) { toast.error("Válassz legalább egy modellt"); return; }
                if (step === 1 && !canProceed1) { toast.error("Tölts fel ruhafotót, vagy válassz ghost fotót"); return; }
                if (step === 2 && !canProceed2) { toast.error("Válassz hátteret"); return; }
                setStep((s) => Math.min(3, s + 1));
              }}
              className="flex items-center gap-2 px-5 h-10 rounded-lg text-sm font-semibold bg-gray-950 text-white hover:bg-gray-800 transition-all"
            >
              Tovább <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            !hasResults && (
              <button
                type="button"
                onClick={() => {
                  if (isRunning) return;
                  if (!frontFile && !selectedGhostId) { toast.error("Tölts fel ruhafotót, vagy válassz ghost fotót"); return; }
                  handleGenerate();
                }}
                disabled={isRunning}
                className="flex items-center gap-2 px-5 h-10 rounded-lg text-sm font-bold bg-gray-950 text-white hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wand2 className="w-4 h-4" /> {totalPhotos} fotó generálása
              </button>
            )
          )}
        </div>
      )}

      {/* ── Lightbox ───────────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
