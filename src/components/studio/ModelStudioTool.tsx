"use client";

import { useState, useCallback, useRef, useEffect, KeyboardEvent, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import {
  Wand2, RotateCcw, Loader2, Download, ImageOff,
  X, Plus, Camera, Trees, Cpu, Shuffle, Square,
} from "lucide-react";

// Ghost photo shape returned by /api/projects
interface GhostPhoto {
  id: string;
  name: string;
  status: string;
  prompt_used: string | null;
  output_image_url: string | null;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ModelUploadPanel } from "./ModelUploadPanel";
import type {
  UploadedImages,
  UploadedPreviews,
  GenerationResult,
} from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type SlotState = "idle" | "loading" | "done" | "error";

interface PhotoSlot {
  state: SlotState;
  result: GenerationResult | null;
  error: string | null;
}

type HairVariant = "blonde" | "brunette" | "both";

// ─── Constants ────────────────────────────────────────────────────────────────

const PHOTO_COUNTS = [4, 6, 8] as const;
type PhotoCount = typeof PHOTO_COUNTS[number];

const SCENE_CHIPS: Record<"photoshoot" | "lifestyle", string[]> = {
  photoshoot: ["Minimal", "Dynamic", "Editorial", "Power pose", "Walking", "Sitting", "Profile"],
  lifestyle:  ["Park", "Street", "Cafe", "Golden hour", "Beach", "Shopping", "Rooftop", "Interior"],
};

function emptySlots(count: number): PhotoSlot[] {
  return Array.from({ length: count }, () => ({ state: "idle" as SlotState, result: null, error: null }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revokePreviews(prev: UploadedPreviews) {
  if (prev.front) URL.revokeObjectURL(prev.front);
  if (prev.back)  URL.revokeObjectURL(prev.back);
  if (prev.side)  URL.revokeObjectURL(prev.side);
}

async function callGenerateSingle(
  images: UploadedImages,
  name: string,
  variant: "blonde" | "brunette",
  poseIndex: number,
  sceneType: "photoshoot" | "lifestyle",
  keywords: string[],
  ghostProjectId?: string | null,
  collectionId?: string | null,
  extraPrompt?: string
): Promise<GenerationResult> {
  const fd = new FormData();
  if (ghostProjectId) {
    fd.append("ghostProjectId", ghostProjectId);
  } else {
    fd.append("front", images.front!);
    fd.append("back",  images.back!);
    if (images.side) fd.append("side", images.side);
  }
  fd.append("projectName", name);
  fd.append("variant",     variant);
  fd.append("poseIndex",   String(poseIndex));
  fd.append("sceneType",   sceneType);
  fd.append("keywords",    keywords.join(","));
  if (collectionId) fd.append("collectionId", collectionId);
  if (extraPrompt) fd.append("extraPrompt", extraPrompt);

  const res  = await fetch("/api/generate-model", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

  return {
    outputUrl:     data.outputUrl,
    outputPath:    data.outputPath,
    projectId:     data.projectId,
    mimeType:      data.mimeType,
    generatedAt:   new Date(),
    versionNumber: data.versionNumber,
  };
}

async function downloadSlot(result: GenerationResult, label: string, fmt: "png" | "webp") {
  try {
    const blob = await fetch(result.outputUrl).then((r) => r.blob());
    const a    = Object.assign(document.createElement("a"), {
      href:     URL.createObjectURL(blob),
      download: `${label}.${fmt}`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    toast.error("Letöltés sikertelen");
  }
}

// ─── Photo slot card ──────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: PhotoSlot;
  index: number;
  label: string;
  onRegenerate: () => void;
  onRequestRegen: () => void;
}

function SlotCard({ slot, index, label, onRegenerate, onRequestRegen }: SlotCardProps) {
  return (
    <div className="flex flex-col bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm group">
      {/* Image area */}
      <div className="relative aspect-[3/4] bg-gray-50 flex items-center justify-center">
        {slot.state === "idle" && (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <ImageOff className="w-6 h-6" />
            <span className="text-[10px] font-medium text-gray-400">#{index + 1}</span>
          </div>
        )}

        {slot.state === "loading" && (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
            <span className="text-[11px] font-medium text-gray-500">Generálás…</span>
          </div>
        )}

        {slot.state === "done" && slot.result && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.result.outputUrl}
              alt={label}
              className="w-full h-full object-cover"
            />
            {/* Re-generate on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <button
                onClick={onRequestRegen}
                className="flex items-center gap-1.5 bg-white/90 text-gray-800 text-[11px] font-bold px-3 py-1.5 rounded-full shadow hover:bg-white transition-colors"
                title="Újragenerálás"
              >
                <RotateCcw className="w-3 h-3" /> Újra
              </button>
            </div>
          </>
        )}

        {slot.state === "error" && (
          <div className="flex flex-col items-center gap-2 px-3 text-center">
            <X className="w-5 h-5 text-red-300" />
            <span className="text-[10px] text-red-400 leading-relaxed">{slot.error ?? "Hiba"}</span>
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-full transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Újragenerálás
            </button>
          </div>
        )}

        {/* Slot number badge */}
        <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-black/30 text-white px-1.5 py-0.5 rounded-full">
          #{index + 1}
        </span>
      </div>

      {/* Download row */}
      {slot.state === "done" && slot.result && (
        <div className="flex gap-1.5 p-1.5">
          <Button size="sm" variant="outline"
            className="flex-1 h-7 text-[11px] gap-1 border-gray-100 px-1"
            onClick={() => downloadSlot(slot.result!, label, "png")}>
            <Download className="w-3 h-3" />PNG
          </Button>
          <Button size="sm" variant="outline"
            className="flex-1 h-7 text-[11px] gap-1 border-gray-100 px-1"
            onClick={() => downloadSlot(slot.result!, label, "webp")}>
            <Download className="w-3 h-3" />WebP
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Variant grid ─────────────────────────────────────────────────────────────

interface VariantGridProps {
  label: string;
  badgeClass: string;
  slots: PhotoSlot[];
  variantKey: "blonde" | "brunette";
  onRegenerate: (index: number) => void;
  onRequestRegen: (index: number) => void;
}

function VariantGrid({ label, badgeClass, slots, variantKey, onRegenerate, onRequestRegen }: VariantGridProps) {
  const done  = slots.filter((s) => s.state === "done").length;
  const total = slots.length;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", badgeClass)}>{label}</span>
        <span className="text-xs text-gray-400">{done}/{total} kész</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {slots.map((slot, i) => (
          <SlotCard
            key={i}
            slot={slot}
            index={i}
            label={`${variantKey === "blonde" ? "Szoke" : "Barna"}_${i + 1}`}
            onRegenerate={() => onRegenerate(i)}
            onRequestRegen={() => onRequestRegen(i)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ModelStudioToolProps {
  collectionId?: string | null;
}

export function ModelStudioTool({ collectionId }: ModelStudioToolProps) {
  const { t } = useLanguage();

  // ── Upload state
  const [images,   setImages]   = useState<UploadedImages>({ front: null, back: null, side: null });
  const [previews, setPreviews] = useState<UploadedPreviews>({ front: null, back: null, side: null });

  // ── Ghost photo state
  const [ghostPhotos,     setGhostPhotos]     = useState<GhostPhoto[]>([]);
  const [selectedGhostId, setSelectedGhostId] = useState<string | null>(null);

  // ── Config
  const [projectName,    setProjectName]    = useState("");
  const [hairVariant,    setHairVariant]    = useState<HairVariant>("blonde");
  const [photoCount,     setPhotoCount]     = useState<PhotoCount>(4);
  const [sceneType,      setSceneType]      = useState<"photoshoot" | "lifestyle" | "mixture">("photoshoot");
  const [activeChips,    setActiveChips]    = useState<Set<string>>(new Set());
  const [customKwInput,  setCustomKwInput]  = useState("");
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);

  // ── Regen modal state
  const [regenModal,       setRegenModal]       = useState<{ variant: "blonde" | "brunette"; index: number } | null>(null);
  const [regenExtraPrompt, setRegenExtraPrompt] = useState("");

  // ── Slot state
  const [blondeSlots,   setBlondeSlots]   = useState<PhotoSlot[]>([]);
  const [brunetteSlots, setBrunetteSlots] = useState<PhotoSlot[]>([]);
  const [isRunning,     setIsRunning]     = useState(false);
  const abortRef    = useRef(false);
  const baseNameRef = useRef<string>("");

  // ── Pre-populate from ghost studio transfer
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as Record<string, unknown>;
    const transfer = win.__ghostTransfer as { images: UploadedImages } | undefined;
    if (!transfer?.images) return;
    delete win.__ghostTransfer;

    const { images: src } = transfer;
    setImages({ front: src.front, back: src.back, side: src.side });
    setPreviews({
      front: src.front ? URL.createObjectURL(src.front) : null,
      back:  src.back  ? URL.createObjectURL(src.back)  : null,
      side:  src.side  ? URL.createObjectURL(src.side)  : null,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch ghost photos for the collection
  useEffect(() => {
    if (!collectionId) return;
    fetch(`/api/projects?collectionId=${collectionId}`)
      .then((r) => r.json())
      .then((projects: GhostPhoto[]) => {
        const ghosts = projects.filter(
          (p) => p.status === "completed" && !p.prompt_used?.startsWith("model-")
        );
        setGhostPhotos(ghosts);
      })
      .catch(() => {});
  }, [collectionId]);

  // ── Image handling
  const handleImageChange = useCallback((key: keyof UploadedImages, file: File | null) => {
    // Uploading a photo deselects any ghost project (uploaded files take priority)
    if (file) setSelectedGhostId(null);
    setImages((prev) => {
      const next = { ...prev, [key]: file };
      setPreviews((old) => {
        if (old[key]) URL.revokeObjectURL(old[key]!);
        return { ...old, [key]: file ? URL.createObjectURL(file) : null };
      });
      return next;
    });
  }, []);

  useEffect(() => () => {
    revokePreviews(previews);
    abortRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard handling for regen modal
  useEffect(() => {
    if (!regenModal) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setRegenModal(null);
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleRegenerateSingle(regenModal.variant, regenModal.index, regenExtraPrompt.trim() || undefined);
        setRegenModal(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenModal, regenExtraPrompt]);

  const handleSceneChange = (s: "photoshoot" | "lifestyle" | "mixture") => {
    setSceneType(s);
    setActiveChips(new Set());
  };

  const toggleChip = (chip: string) =>
    setActiveChips((prev) => { const n = new Set(prev); n.has(chip) ? n.delete(chip) : n.add(chip); return n; });

  const addCustomKeyword = () => {
    const kw = customKwInput.trim();
    if (kw && !customKeywords.includes(kw)) setCustomKeywords((prev) => [...prev, kw]);
    setCustomKwInput("");
  };
  const handleKwKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCustomKeyword(); }
  };
  const removeCustomKeyword = (kw: string) =>
    setCustomKeywords((prev) => prev.filter((k) => k !== kw));

  const allKeywords = [...activeChips, ...customKeywords];

  // ── Core: generate one variant sequentially
  async function runVariant(
    variant: "blonde" | "brunette",
    setSlots: Dispatch<SetStateAction<PhotoSlot[]>>,
    count: number,
    scene: "photoshoot" | "lifestyle" | "mixture",
    kws: string[],
    baseName: string,
    ghostId?: string | null,
    colId?: string | null
  ) {
    const isRandomScene = scene === "mixture";
    for (let i = 0; i < count; i++) {
      if (abortRef.current) break;

      setSlots((prev) => {
        const next = [...prev];
        next[i] = { state: "loading", result: null, error: null };
        return next;
      });

      try {
        const variantLabel = variant === "blonde" ? "Szőke" : "Barna";
        const actualScene: "photoshoot" | "lifestyle" = isRandomScene
          ? (Math.random() < 0.5 ? "photoshoot" : "lifestyle")
          : scene;
        const actualPoseIndex = isRandomScene
          ? Math.floor(Math.random() * 8)
          : i;
        const result = await callGenerateSingle(
          images,
          `${baseName} – ${variantLabel} ${i + 1}`,
          variant,
          actualPoseIndex,
          actualScene,
          kws,
          ghostId,
          colId
        );
        if (abortRef.current) break;
        setSlots((prev) => {
          const next = [...prev];
          next[i] = { state: "done", result, error: null };
          return next;
        });
        const sceneLabel = isRandomScene ? `(${actualScene})` : "";
        toast.success(`${variantLabel} ${i + 1}/${count} kész ${sceneLabel}`.trim());
        // Small pause between calls to avoid hitting Gemini QPM rate limits
        if (i < count - 1 && !abortRef.current) {
          await new Promise((r) => setTimeout(r, 6_000));
        }
      } catch (err) {
        if (abortRef.current) break;
        setSlots((prev) => {
          const next = [...prev];
          next[i] = { state: "error", result: null, error: err instanceof Error ? err.message : "Hiba" };
          return next;
        });
      }
    }
  }

  // ── Handle generate
  const handleGenerate = useCallback(async () => {
    if (!selectedGhostId && (!images.front || !images.back)) {
      toast.error(t("up_needs_both"));
      return;
    }

    abortRef.current = false;
    setIsRunning(true);

    const count = photoCount;
    const scene = sceneType;
    const kws   = [...activeChips, ...customKeywords];
    const baseName = projectName.trim()
      || `Model ${new Date().toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}`;

    baseNameRef.current = baseName;

    const blank = emptySlots(count);

    if (hairVariant === "blonde" || hairVariant === "both") setBlondeSlots([...blank]);
    if (hairVariant === "brunette" || hairVariant === "both") setBrunetteSlots([...blank]);

    const tasks: Promise<void>[] = [];
    if (hairVariant === "blonde" || hairVariant === "both")
      tasks.push(runVariant("blonde",   setBlondeSlots,   count, scene, kws, baseName, selectedGhostId, collectionId));
    if (hairVariant === "brunette" || hairVariant === "both")
      tasks.push(runVariant("brunette", setBrunetteSlots, count, scene, kws, baseName, selectedGhostId, collectionId));

    await Promise.allSettled(tasks);
    setIsRunning(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, projectName, hairVariant, photoCount, sceneType, activeChips, customKeywords, selectedGhostId, collectionId]);

  // ── Re-generate a single slot independently
  const handleRegenerateSingle = useCallback(async (
    variant: "blonde" | "brunette",
    slotIndex: number,
    extraPrompt?: string
  ) => {
    const setSlots = variant === "blonde" ? setBlondeSlots : setBrunetteSlots;
    const variantLabel = variant === "blonde" ? "Szőke" : "Barna";

    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = { state: "loading", result: null, error: null };
      return next;
    });

    try {
      const kws = [...activeChips, ...customKeywords];
      const isRandomScene = sceneType === "mixture";
      const actualScene: "photoshoot" | "lifestyle" = isRandomScene
        ? (Math.random() < 0.5 ? "photoshoot" : "lifestyle")
        : sceneType;
      const actualPoseIndex = isRandomScene
        ? Math.floor(Math.random() * 8)
        : slotIndex;
      const result = await callGenerateSingle(
        images,
        `${baseNameRef.current} – ${variantLabel} ${slotIndex + 1}`,
        variant,
        actualPoseIndex,
        actualScene,
        kws,
        selectedGhostId,
        collectionId,
        extraPrompt
      );
      setSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = { state: "done", result, error: null };
        return next;
      });
      toast.success(`${variantLabel} ${slotIndex + 1} kész`);
    } catch (err) {
      setSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = { state: "error", result: null, error: err instanceof Error ? err.message : "Hiba" };
        return next;
      });
      toast.error("Generálás sikertelen");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, sceneType, activeChips, customKeywords, selectedGhostId, collectionId]);

  const handleStop = () => {
    abortRef.current = true;
    setIsRunning(false);
  };

  const handleReset = () => {
    abortRef.current = true;
    setIsRunning(false);
    setBlondeSlots([]);
    setBrunetteSlots([]);
  };

  const hasStarted  = blondeSlots.length > 0 || brunetteSlots.length > 0;
  const hasImages   = !!(images.front || images.back || images.side);
  const canGenerate = (!!selectedGhostId || (!!images.front && !!images.back)) && !isRunning;

  const showBlonde   = hairVariant === "blonde"   || hairVariant === "both";
  const showBrunette = hairVariant === "brunette" || hairVariant === "both";

  const totalExpected = photoCount * (hairVariant === "both" ? 2 : 1);

  return (
    <div className="flex h-full min-h-0 overflow-hidden">

      {/* ── Left: Upload ───────────────────────────────────────────────────── */}
      <ModelUploadPanel images={images} previews={previews} disabled={isRunning} onImageChange={handleImageChange} />

      {/* ── Center: Results ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-auto bg-gray-50 p-6 gap-6">

        {!hasStarted && !hasImages && ghostPhotos.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
              <span className="text-3xl">👗</span>
            </div>
            <h3 className="font-bold text-gray-900">{t("mod_empty_title")}</h3>
            <p className="text-sm text-gray-500 max-w-xs">{t("mod_empty_hint")}</p>
          </div>
        )}

        {ghostPhotos.length > 0 && !hasStarted && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ghost fotók a projektből</p>
            <p className="text-xs text-gray-500">Válassz ki egy ghost fotót, amit a modell viseljen:</p>
            <div className="flex flex-wrap gap-3">
              {ghostPhotos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setSelectedGhostId((prev) => prev === photo.id ? null : photo.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-1 transition-all",
                    selectedGhostId === photo.id
                      ? "border-violet-500 shadow-md"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  {photo.output_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.output_image_url}
                      alt={photo.name}
                      className="w-24 h-24 object-contain rounded-lg bg-gray-50"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center">
                      <ImageOff className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                  <span className="text-[10px] text-gray-600 font-medium max-w-[96px] truncate">{photo.name}</span>
                  {selectedGhostId === photo.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {selectedGhostId && (
              <p className="text-xs text-violet-600 font-medium">Ghost fotó kiválasztva — fotók feltöltése nem szükséges</p>
            )}
          </div>
        )}

        {!hasStarted && hasImages && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Feltöltött ruhafotók</p>
            <div className="flex gap-3">
              {(["front", "back", "side"] as const).filter((k) => previews[k]).map((k) => (
                <div key={k} className="flex flex-col items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previews[k]!} alt={k}
                    className="w-28 h-28 rounded-xl object-cover border border-gray-100 bg-white" />
                  <span className="text-[11px] text-gray-400 capitalize">{k}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Válaszd ki a modellt és kattints a <strong>Modell fotók generálása</strong> gombra.
            </p>
          </div>
        )}

        {hasStarted && (
          <div className="space-y-8">
            {showBlonde && blondeSlots.length > 0 && (
              <VariantGrid
                label={t("mod_blonde")}
                badgeClass="bg-amber-100 text-amber-800"
                slots={blondeSlots}
                variantKey="blonde"
                onRegenerate={(i) => handleRegenerateSingle("blonde", i)}
                onRequestRegen={(i) => { setRegenExtraPrompt(""); setRegenModal({ variant: "blonde", index: i }); }}
              />
            )}
            {showBrunette && brunetteSlots.length > 0 && (
              <VariantGrid
                label={t("mod_brunette")}
                badgeClass="bg-stone-100 text-stone-800"
                slots={brunetteSlots}
                variantKey="brunette"
                onRegenerate={(i) => handleRegenerateSingle("brunette", i)}
                onRequestRegen={(i) => { setRegenExtraPrompt(""); setRegenModal({ variant: "brunette", index: i }); }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Right: Settings ────────────────────────────────────────────────── */}
      <div className="w-80 shrink-0 bg-white flex flex-col h-full border-l border-gray-100">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">{t("mod_title")}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{t("mod_subtitle")}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Project name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-gray-700">{t("set_project")}</Label>
            <Input value={projectName} onChange={(e) => setProjectName(e.target.value)}
              placeholder={t("set_project_ph")} disabled={isRunning}
              className="text-sm border-gray-200 focus:border-violet-400 h-10" />
          </div>

          {/* ── Hair variant selector ────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">Modell haja</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "blonde"   as HairVariant, label: "Szőke",    emoji: "👱‍♀️",
                  active: "bg-amber-500 text-white border-amber-500" },
                { value: "brunette" as HairVariant, label: "Barna",    emoji: "👩",
                  active: "bg-stone-700 text-white border-stone-700" },
                { value: "both"     as HairVariant, label: "Mindkettő", emoji: "✨",
                  active: "bg-violet-600 text-white border-violet-600" },
              ]).map(({ value, label, emoji, active }) => (
                <button key={value} onClick={() => setHairVariant(value)} disabled={isRunning}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all",
                    hairVariant === value
                      ? active + " shadow-sm"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                  )}>
                  <span className="text-lg leading-none">{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Photo count ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">Fotók száma (modellenként)</Label>
            <div className="flex gap-2">
              {PHOTO_COUNTS.map((n) => (
                <button key={n} onClick={() => setPhotoCount(n)} disabled={isRunning}
                  className={cn(
                    "flex-1 h-9 rounded-xl text-sm font-bold border transition-all",
                    photoCount === n
                      ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700"
                  )}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">
              {photoCount} kép/modell — összesen {totalExpected} kép
            </p>
          </div>

          {/* ── Scene type ───────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">Jelenet típusa</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "photoshoot" as const, label: "Photoshoot", icon: Camera,
                  desc: "Fehér háttér, stúdió", active: "bg-gray-900 text-white border-gray-900" },
                { value: "lifestyle"  as const, label: "Lifestyle",  icon: Trees,
                  desc: "Park, utca, kávézó…",  active: "bg-emerald-600 text-white border-emerald-600" },
                { value: "mixture"    as const, label: "Mixture",    icon: Shuffle,
                  desc: "Vegyes, véletlenszerű", active: "bg-violet-600 text-white border-violet-600" },
              ]).map(({ value, label, icon: Icon, desc, active }) => (
                <button key={value} onClick={() => handleSceneChange(value)} disabled={isRunning}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 rounded-xl border transition-all",
                    sceneType === value ? active + " shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  )}>
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-bold">{label}</span>
                  <span className={cn("text-[10px]", sceneType === value ? "opacity-80" : "text-gray-400")}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Preset keyword chips ─────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">Stílus kulcsszavak</Label>
            <div className="flex flex-wrap gap-1.5">
              {(sceneType === "mixture"
                ? [...new Set([...SCENE_CHIPS.photoshoot, ...SCENE_CHIPS.lifestyle])]
                : SCENE_CHIPS[sceneType]
              ).map((chip) => (
                <button key={chip} onClick={() => toggleChip(chip)} disabled={isRunning}
                  className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full border transition-all",
                    activeChips.has(chip)
                      ? "bg-violet-100 text-violet-700 border-violet-300"
                      : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                  )}>
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* ── Custom keywords ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">Egyéni kulcsszavak</Label>
            <div className="flex gap-2">
              <Input
                value={customKwInput}
                onChange={(e) => setCustomKwInput(e.target.value)}
                onKeyDown={handleKwKeyDown}
                placeholder="pl. evening wear, foggy…"
                disabled={isRunning}
                className="text-sm border-gray-200 focus:border-violet-400 h-9 flex-1"
              />
              <Button size="sm" variant="outline" onClick={addCustomKeyword}
                disabled={isRunning || !customKwInput.trim()}
                className="h-9 px-3 border-gray-200">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {customKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {customKeywords.map((kw) => (
                  <span key={kw}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                    {kw}
                    <button onClick={() => removeCustomKeyword(kw)} disabled={isRunning}
                      className="hover:text-violet-900 transition-colors">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-gray-400">Enter vagy vesszővel add hozzá.</p>
          </div>

          {/* Active keyword summary */}
          {allKeywords.length > 0 && (
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-2.5">
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-1">Aktív kulcsszavak</p>
              <p className="text-xs text-violet-700 leading-relaxed">{allKeywords.join(" · ")}</p>
            </div>
          )}

          {/* AI model info */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs font-semibold text-gray-500">{t("set_model")}</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{t("mod_info")}</p>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <span className="text-sm font-semibold text-gray-700 block">{t("set_checklist")}</span>
            {([
              { key: "front" as const, label: t("set_front"), required: true  },
              { key: "back"  as const, label: t("set_back"),  required: true  },
              { key: "side"  as const, label: t("set_side"),  required: false },
            ]).map(({ key, label, required }) => (
              <div key={key} className="flex items-center gap-3">
                <div className={cn(
                  "w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  images[key] ? "border-violet-600 bg-violet-600" : required ? "border-gray-300" : "border-gray-200"
                )}>
                  {images[key] && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className={cn("text-sm", images[key] ? "text-gray-700" : required ? "text-gray-500" : "text-gray-400")}>
                  {label}
                  {!required && <span className="text-gray-400 ml-1 text-xs">({t("up_optional").toLowerCase()})</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-3 shrink-0">
          {hasStarted && !isRunning && (
            <Button variant="outline" className="w-full gap-2 h-10 text-sm border-gray-200 text-gray-700"
              onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />{t("mod_regenerate")}
            </Button>
          )}

          {isRunning ? (
            <Button
              onClick={handleStop}
              className="w-full h-12 gap-2 font-bold text-sm bg-red-600 hover:bg-red-700 text-white transition-all duration-200"
            >
              <Square className="w-4 h-4" /> Leállítás
            </Button>
          ) : (
            <Button onClick={handleGenerate} disabled={!canGenerate}
              className={cn(
                "w-full h-12 gap-2 font-bold text-sm transition-all duration-200",
                canGenerate ? "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}>
              <Wand2 className="w-4 h-4" />{t("mod_generate")}
            </Button>
          )}

          {!canGenerate && !isRunning && (
            <p className="text-xs text-center text-gray-400">{t("mod_need_photos")}</p>
          )}
        </div>
      </div>

      {/* ── Regen modal ────────────────────────────────────────────────────── */}
      {regenModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setRegenModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-[400px] max-w-[90vw] p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Újragenerálás – #{regenModal.index + 1}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Add meg az egyéni utasításokat ehhez a fotóhoz (opcionális).
              </p>
            </div>
            <Textarea
              autoFocus
              rows={3}
              value={regenExtraPrompt}
              onChange={(e) => setRegenExtraPrompt(e.target.value)}
              placeholder="pl. sötétebb háttér, dinamikusabb póz…"
              className="text-sm border-gray-200 focus:border-violet-400 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                className="border-gray-200 text-gray-600 h-9"
                onClick={() => setRegenModal(null)}
              >
                Mégse
              </Button>
              <Button
                className="bg-violet-600 text-white hover:bg-violet-700 h-9"
                onClick={() => {
                  handleRegenerateSingle(regenModal.variant, regenModal.index, regenExtraPrompt.trim() || undefined);
                  setRegenModal(null);
                }}
              >
                Generálás
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
