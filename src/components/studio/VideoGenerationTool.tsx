"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Upload,
  X,
  Download,
  Loader2,
  Wand2,
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Music,
  Clapperboard,
  Camera,
  Palette,
  Settings2,
  Image as ImageIcon,
  Film,
  Sparkles,
  Eye,
  Volume2,
  VolumeX,
  LayoutTemplate,
  Type,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  MOTION_STYLES,
  CAMERA_ANGLES,
  MUSIC_MOODS,
  VIDEO_TEMPLATES,
  ASPECT_RATIOS,
  BRANDING_POSITIONS,
  type MotionStyle,
  type CameraAngle,
  type MusicMood,
  type VideoTemplate,
} from "@/lib/video-generation-data";
import {
  DESIGN_MODELS,
  DESIGN_BACKGROUNDS,
  type DesignModel,
  type DesignBackground,
} from "@/lib/design-model-data";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

type GenerationStep =
  | "idle"
  | "uploading"
  | "analyzing"
  | "compositing"
  | "rendering"
  | "encoding"
  | "finalizing"
  | "done"
  | "error";

const STEP_LABELS: Record<GenerationStep, string> = {
  idle:         "",
  uploading:    "Képek feltöltése...",
  analyzing:    "Ruhadarab elemzése...",
  compositing:  "Jelenetek összeállítása...",
  rendering:    "Videó renderelése...",
  encoding:     "Videó kódolása...",
  finalizing:   "Véglegesítés...",
  done:         "Kész!",
  error:        "Hiba történt",
};

const STEP_SCHEDULE: Array<[GenerationStep, number]> = [
  ["uploading",    0],
  ["analyzing",    5_000],
  ["compositing",  15_000],
  ["rendering",    40_000],
  ["encoding",     120_000],
  ["finalizing",   180_000],
];

type ModelFilter = "all" | "slavic" | "french" | "blonde" | "brunette";
type BgFilter = "all" | "studio" | "lifestyle";

interface CollectionPhoto {
  id: string;
  name: string;
  output_image_url: string | null;
}

const WIZARD_STEPS = [
  { step: 1 as WizardStep, label: "Feltöltés", labelEn: "Upload", icon: Upload },
  { step: 2 as WizardStep, label: "Sablon & Mozgás", labelEn: "Template & Motion", icon: Clapperboard },
  { step: 3 as WizardStep, label: "Kamera & Idő", labelEn: "Camera & Timing", icon: Camera },
  { step: 4 as WizardStep, label: "Modell & Háttér", labelEn: "Model & Background", icon: Palette },
  { step: 5 as WizardStep, label: "Zene & Branding", labelEn: "Music & Branding", icon: Music },
  { step: 6 as WizardStep, label: "Előnézet & Generálás", labelEn: "Preview & Generate", icon: Sparkles },
];

// ─── Image compression ──────────────────────────────────────────────────────

async function compressImage(file: File, maxMB = 1.5, maxPx = 1920): Promise<File> {
  return new Promise((resolve) => {
    if (file.size <= maxMB * 1024 * 1024) { resolve(file); return; }
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxPx || h > maxPx) {
        const r = Math.min(maxPx / w, maxPx / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const attempt = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size > maxMB * 1024 * 1024 && quality > 0.45) {
              attempt(quality - 0.1);
            } else {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            }
          },
          "image/jpeg",
          quality,
        );
      };
      attempt(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.src = blobUrl;
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function VideoGenerationTool({
  collectionId,
}: {
  collectionId: string;
}) {
  const { t, lang } = useLanguage();

  // ── Wizard navigation ──
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // ── Step 1: Upload ──
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [sideImage, setSideImage] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [sidePreview, setSidePreview] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");

  // ── Step 2: Template & Motion ──
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedMotion, setSelectedMotion] = useState<string>("slow-cinematic");

  // ── Step 3: Camera & Timing ──
  const [selectedCamera, setSelectedCamera] = useState<string>("front");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<"9:16" | "16:9" | "1:1" | "4:5">("9:16");
  const [duration, setDuration] = useState<number>(5);
  const [loopVideo, setLoopVideo] = useState(true);

  // ── Step 4: Model & Background ──
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState<ModelFilter>("all");
  const [bgFilter, setBgFilter] = useState<BgFilter>("all");

  // ── Step 5: Music & Branding ──
  const [selectedMusic, setSelectedMusic] = useState<string>("none");
  const [brandingPosition, setBrandingPosition] = useState<string>("none");
  const [brandingText, setBrandingText] = useState("");
  const [brandingLogo, setBrandingLogo] = useState<File | null>(null);
  const [brandingLogoPreview, setBrandingLogoPreview] = useState<string | null>(null);

  // ── Step 6: Generate ──
  const [genStep, setGenStep] = useState<GenerationStep>("idle");
  const [genError, setGenError] = useState<string | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [resultProjectId, setResultProjectId] = useState<string | null>(null);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Drag-and-drop state ──
  const [dragging, setDragging] = useState<"front" | "back" | "side" | null>(null);

  // ── Collection photos (existing project images) ──
  const [collectionPhotos, setCollectionPhotos] = useState<CollectionPhoto[]>([]);
  const [collectionPhotosLoading, setCollectionPhotosLoading] = useState(false);
  const [selectedSourcePhotoId, setSelectedSourcePhotoId] = useState<string | null>(null);

  // ── Refs for file inputs ──
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const sideRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // ── Fetch collection photos ──
  useEffect(() => {
    if (!collectionId) return;
    setCollectionPhotosLoading(true);
    fetch(`/api/projects?collectionId=${collectionId}`)
      .then((r) => r.json())
      .then((projects: Array<{ id: string; name: string; status: string; prompt_used?: string | null; output_image_url?: string | null }>) => {
        const photos = projects.filter(
          (p) => p.status === "completed" && p.output_image_url
        );
        setCollectionPhotos(photos.map((p) => ({ id: p.id, name: p.name, output_image_url: p.output_image_url ?? null })));
      })
      .catch(() => {})
      .finally(() => setCollectionPhotosLoading(false));
  }, [collectionId]);

  // ── Helpers ──

  const handleImageSelect = useCallback(
    (which: "front" | "back" | "side", file: File | null) => {
      const setters = {
        front: [setFrontImage, setFrontPreview] as const,
        back:  [setBackImage,  setBackPreview] as const,
        side:  [setSideImage,  setSidePreview] as const,
      };
      const [setFile, setPreview] = setters[which];
      setFile(file);
      setPreview(file ? URL.createObjectURL(file) : null);
      // Clear source photo selection when manually uploading
      if (which === "front") setSelectedSourcePhotoId(null);
    },
    [],
  );

  const handleDropFile = useCallback(
    (which: "front" | "back" | "side", e: React.DragEvent) => {
      e.preventDefault();
      setDragging(null);
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) {
        handleImageSelect(which, f);
      }
    },
    [handleImageSelect],
  );

  const handleSelectSourcePhoto = useCallback(
    (photoId: string) => {
      setSelectedSourcePhotoId((prev) => prev === photoId ? null : photoId);
    },
    [],
  );

  const applyTemplate = useCallback((templateId: string) => {
    const tmpl = VIDEO_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    setSelectedTemplate(templateId);
    setSelectedMotion(tmpl.motionStyleId);
    setSelectedCamera(tmpl.cameraAngleId);
    setSelectedMusic(tmpl.musicMoodId);
    setSelectedAspectRatio(tmpl.aspectRatio);
    setDuration(tmpl.duration);
  }, []);

  const canProceed = useCallback(
    (step: WizardStep): boolean => {
      switch (step) {
        case 1: return !!frontImage || !!selectedSourcePhotoId;
        case 2: return !!selectedMotion;
        case 3: return !!selectedCamera && duration >= 2;
        case 4: return true; // model/bg are optional enhancements
        case 5: return true; // music/branding are optional
        case 6: return true;
        default: return false;
      }
    },
    [frontImage, selectedSourcePhotoId, selectedMotion, selectedCamera, duration],
  );

  const goNext = useCallback(() => {
    if (currentStep < 6 && canProceed(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, 6) as WizardStep);
    }
  }, [currentStep, canProceed]);

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => Math.max(s - 1, 1) as WizardStep);
    }
  }, [currentStep]);

  const clearStepTimers = useCallback(() => {
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
  }, []);

  // ── Generate ──

  const handleGenerate = useCallback(async () => {
    if (!frontImage && !selectedSourcePhotoId) {
      toast.error("Tölts fel ruhafotót, vagy válassz fotót a projektből.");
      return;
    }

    setGenStep("uploading");
    setGenError(null);
    setResultVideoUrl(null);
    clearStepTimers();

    // Start step animation
    for (const [step, delay] of STEP_SCHEDULE) {
      stepTimers.current.push(setTimeout(() => setGenStep(step), delay));
    }

    try {
      const formData = new FormData();
      if (selectedSourcePhotoId) {
        formData.append("sourceProjectId", selectedSourcePhotoId);
      } else {
        formData.append("front", await compressImage(frontImage!));
        if (backImage) formData.append("back", await compressImage(backImage));
        if (sideImage) formData.append("side", await compressImage(sideImage));
      }
      formData.append("projectName", projectName || "Video Generation");
      formData.append("motionStyle", selectedMotion);
      formData.append("cameraAngle", selectedCamera);
      formData.append("aspectRatio", selectedAspectRatio);
      formData.append("duration", String(duration));
      formData.append("loop", String(loopVideo));
      formData.append("musicMood", selectedMusic);
      formData.append("brandingPosition", brandingPosition);
      formData.append("brandingText", brandingText);
      if (brandingLogo) formData.append("brandingLogo", brandingLogo);
      if (selectedModel) formData.append("modelId", selectedModel);
      if (selectedBackground) formData.append("backgroundId", selectedBackground);
      formData.append("collectionId", collectionId);

      const res = await fetch("/api/generate-video", {
        method: "POST",
        body: formData,
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch {
        throw new Error(`Server error ${res.status}: response was not JSON`);
      }
      if (!res.ok) throw new Error((data.error as string) || `Server error ${res.status}`);

      clearStepTimers();
      setGenStep("done");
      setResultVideoUrl(data.outputUrl as string);
      setResultProjectId(data.projectId as string);
      toast.success("Video generated successfully!");
    } catch (err: unknown) {
      clearStepTimers();
      const msg = err instanceof Error ? err.message : String(err);
      setGenStep("error");
      setGenError(msg);
      toast.error(msg);
    }
  }, [
    frontImage, backImage, sideImage, selectedSourcePhotoId, projectName,
    selectedMotion, selectedCamera, selectedAspectRatio, duration, loopVideo,
    selectedMusic, brandingPosition, brandingText, brandingLogo, selectedModel,
    selectedBackground, collectionId, clearStepTimers,
  ]);

  // ── Current motion/camera/music objects ──
  const activeMotion = MOTION_STYLES.find((m) => m.id === selectedMotion)!;
  const activeCamera = CAMERA_ANGLES.find((c) => c.id === selectedCamera)!;
  const activeMusic  = MUSIC_MOODS.find((m) => m.id === selectedMusic)!;
  const activeAspect = ASPECT_RATIOS.find((a) => a.id === selectedAspectRatio)!;
  const activeModel  = selectedModel ? DESIGN_MODELS.find((m) => m.id === selectedModel) : null;
  const activeBg     = selectedBackground ? DESIGN_BACKGROUNDS.find((b) => b.id === selectedBackground) : null;

  // Effective preview: either uploaded front image or selected source photo thumbnail
  const effectivePreview = frontPreview
    ?? (selectedSourcePhotoId ? collectionPhotos.find((p) => p.id === selectedSourcePhotoId)?.output_image_url ?? null : null);

  const filteredModels = DESIGN_MODELS.filter((m) => {
    if (modelFilter === "all") return true;
    if (modelFilter === "slavic") return m.origin === "slavic";
    if (modelFilter === "french") return m.origin === "french";
    if (modelFilter === "blonde") return m.hairColor === "blonde";
    if (modelFilter === "brunette") return m.hairColor === "brunette";
    return true;
  });

  const filteredBgs = DESIGN_BACKGROUNDS.filter((b) => {
    if (bgFilter === "all") return true;
    return b.type === bgFilter;
  });

  const isGenerating = genStep !== "idle" && genStep !== "done" && genStep !== "error";
  const backHref = collectionId ? `/studio/projects/${collectionId}` : "/studio/projects";

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Header ── */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Vissza
          </Link>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Film className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Fashion Video Studio</h1>
              <p className="text-[10px] text-gray-400">AI-powered video generation</p>
            </div>
          </div>
        </div>

        {/* Step indicator (compact) */}
        <div className="flex items-center gap-1">
          {WIZARD_STEPS.map(({ step, label, labelEn, icon: Icon }) => (
            <button
              key={step}
              onClick={() => {
                if (step <= currentStep || canProceed(step - 1 as WizardStep)) {
                  setCurrentStep(step);
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                currentStep === step
                  ? "bg-indigo-600 text-white shadow-sm"
                  : step < currentStep
                    ? "bg-indigo-50 text-indigo-600"
                    : "bg-gray-100 text-gray-400",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{lang === "hu" ? label : labelEn}</span>
              <span className="lg:hidden">{step}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Wizard step content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="max-w-3xl mx-auto"
            >
              {/* ─── Step 1: Upload ─── */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Képek feltöltése</h2>
                    <p className="text-sm text-gray-500">
                      Töltsd fel a ruhadarab fotóit, vagy válassz egy meglévő képet a projektből. Az elülső kép kötelező.
                    </p>
                  </div>

                  {/* Collection photos selector */}
                  {(collectionPhotosLoading || collectionPhotos.length > 0) && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fotók a projektből</p>
                        <p className="text-xs text-gray-500 mt-0.5">Válassz meglévő fotót forrásként, vagy tölts fel sajátot alább.</p>
                      </div>

                      {collectionPhotosLoading ? (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-xs">Betöltés…</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {collectionPhotos.map((photo) => (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => handleSelectSourcePhoto(photo.id)}
                              className={cn(
                                "relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-1 transition-all",
                                selectedSourcePhotoId === photo.id
                                  ? "border-indigo-600 shadow-md"
                                  : "border-gray-200 hover:border-gray-400",
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
                                  <ImageIcon className="w-6 h-6 text-gray-300" />
                                </div>
                              )}
                              <span className="text-[10px] text-gray-600 font-medium max-w-[96px] truncate">{photo.name}</span>
                              {selectedSourcePhotoId === photo.id && (
                                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedSourcePhotoId && (
                        <p className="text-xs text-indigo-600 font-medium">Projekt fotó kiválasztva — ruhafeltöltés nem szükséges</p>
                      )}
                    </div>
                  )}

                  {/* Upload slots with drag-and-drop */}
                  <div className="grid grid-cols-3 gap-4">
                    {(
                      [
                        { key: "front" as const, label: "Elülső", file: frontImage, preview: frontPreview, ref: frontRef, required: true },
                        { key: "back" as const, label: "Hátsó", file: backImage, preview: backPreview, ref: backRef, required: false },
                        { key: "side" as const, label: "Oldalsó", file: sideImage, preview: sidePreview, ref: sideRef, required: false },
                      ] as const
                    ).map(({ key, label, file, preview, ref, required }) => (
                      <div key={key} className="flex flex-col gap-2">
                        <Label className="text-xs font-semibold text-gray-700">
                          {label}
                          {required && <span className="text-red-400 ml-1">*</span>}
                        </Label>
                        <div
                          onClick={() => ref.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); setDragging(key); }}
                          onDragEnter={(e) => { e.preventDefault(); setDragging(key); }}
                          onDragLeave={() => setDragging(null)}
                          onDrop={(e) => handleDropFile(key, e)}
                          className={cn(
                            "aspect-[3/4] rounded-xl border-2 overflow-hidden cursor-pointer transition-all",
                            file
                              ? "border-indigo-300 bg-indigo-50"
                              : dragging === key
                                ? "border-indigo-400 bg-indigo-50 shadow-lg scale-[1.02]"
                                : "border-dashed border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                          )}
                        >
                          {preview ? (
                            <div className="relative w-full h-full group">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={preview} alt={label} className="w-full h-full object-contain" />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleImageSelect(key, null); }}
                                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
                              <Upload className={cn("w-6 h-6", dragging === key && "text-indigo-400 animate-bounce")} />
                              <span className="text-[10px] font-medium text-center px-2">
                                {dragging === key ? "Engedd el ide" : "Húzd ide vagy kattints"}
                              </span>
                            </div>
                          )}
                        </div>
                        <input
                          ref={ref}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => { handleImageSelect(key, e.target.files?.[0] ?? null); e.target.value = ""; }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="max-w-sm">
                    <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                      Projekt neve
                    </Label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="pl. Nyári kollekció videó"
                      className="text-sm"
                    />
                  </div>
                </div>
              )}

              {/* ─── Step 2: Template & Motion Style ─── */}
              {currentStep === 2 && (
                <div className="space-y-8">
                  {/* Templates */}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Gyors sablonok</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      Válassz egy előre beállított sablont, vagy konfiguráld manuálisan alább.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {VIDEO_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl.id}
                          onClick={() => applyTemplate(tmpl.id)}
                          className={cn(
                            "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                            selectedTemplate === tmpl.id
                              ? "border-indigo-500 bg-indigo-50 shadow-sm"
                              : "border-gray-200 bg-white hover:border-gray-300",
                          )}
                        >
                          <span className="text-2xl">{tmpl.icon}</span>
                          <span className="text-xs font-bold text-gray-900">{tmpl.name}</span>
                          <span className="text-[10px] text-gray-500">
                            {lang === "hu" ? tmpl.description_hu : tmpl.description_en}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400">
                            {tmpl.aspectRatio} · {tmpl.duration}s
                          </span>
                          {selectedTemplate === tmpl.id && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Motion styles */}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Mozgásstílus</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      Hogyan mozogjon a videó? Botika 6-ot kínál — mi 10-et, speciális divatos effektekkel.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {MOTION_STYLES.map((ms) => (
                        <button
                          key={ms.id}
                          onClick={() => { setSelectedMotion(ms.id); setSelectedTemplate(null); }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                            selectedMotion === ms.id
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-gray-200 bg-white hover:border-gray-300",
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-lg shrink-0",
                            ms.gradient,
                          )}>
                            {ms.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900">{ms.name}</div>
                            <div className="text-[10px] text-gray-500 truncate">
                              {lang === "hu" ? ms.description_hu : ms.description_en}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {ms.durationRange[0]}–{ms.durationRange[1]}s
                            </div>
                          </div>
                          {selectedMotion === ms.id && (
                            <Check className="w-4 h-4 text-indigo-500 shrink-0 ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Step 3: Camera & Timing ─── */}
              {currentStep === 3 && (
                <div className="space-y-8">
                  {/* Camera angles */}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Kameraszög</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      Válaszd ki a kamera perspektíváját — ez a Botikánál nem elérhető.
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                      {CAMERA_ANGLES.map((ca) => (
                        <button
                          key={ca.id}
                          onClick={() => { setSelectedCamera(ca.id); setSelectedTemplate(null); }}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                            selectedCamera === ca.id
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-gray-200 bg-white hover:border-gray-300",
                          )}
                        >
                          <span className="text-xl">{ca.icon}</span>
                          <span className="text-xs font-bold text-gray-900">{ca.name}</span>
                          <span className="text-[10px] text-gray-500">{ca.description_hu}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Képarány</h2>
                    <p className="text-sm text-gray-500 mb-4">Válaszd ki a célplatformnak megfelelő formátumot.</p>
                    <div className="grid grid-cols-4 gap-3">
                      {ASPECT_RATIOS.map((ar) => (
                        <button
                          key={ar.id}
                          onClick={() => { setSelectedAspectRatio(ar.id); setSelectedTemplate(null); }}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                            selectedAspectRatio === ar.id
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-gray-200 bg-white hover:border-gray-300",
                          )}
                        >
                          <div
                            className={cn(
                              "border-2 rounded",
                              selectedAspectRatio === ar.id ? "border-indigo-400" : "border-gray-300",
                            )}
                            style={{
                              width: ar.width > ar.height ? 40 : Math.round(40 * ar.width / ar.height),
                              height: ar.height > ar.width ? 40 : Math.round(40 * ar.height / ar.width),
                            }}
                          />
                          <span className="text-xs font-bold text-gray-900">{ar.id}</span>
                          <span className="text-[10px] text-gray-500">{ar.useCase}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration & Loop */}
                  <div className="flex gap-8">
                    <div className="flex-1">
                      <Label className="text-sm font-bold text-gray-900 mb-2 block">
                        Időtartam: {duration}s
                      </Label>
                      <Slider
                        value={[duration]}
                        onValueChange={([v]) => { setDuration(v); setSelectedTemplate(null); }}
                        min={2}
                        max={10}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>2s</span>
                        <span>10s</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-bold text-gray-900 mb-2 block">Loop</Label>
                      <button
                        onClick={() => setLoopVideo(!loopVideo)}
                        className={cn(
                          "w-14 h-7 rounded-full transition-colors relative",
                          loopVideo ? "bg-indigo-500" : "bg-gray-300",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform",
                            loopVideo ? "translate-x-7" : "translate-x-0.5",
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Step 4: Model & Background ─── */}
              {currentStep === 4 && (
                <div className="space-y-8">
                  {/* Model selection */}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">AI Modell (opcionális)</h2>
                    <p className="text-sm text-gray-500 mb-3">
                      Válassz egy AI modellt, aki viseli a ruhadarabot a videóban. Hagyd üresen a flat lay stílushoz.
                    </p>

                    {/* Filters */}
                    <div className="flex gap-2 mb-4">
                      {(["all", "slavic", "french", "blonde", "brunette"] as ModelFilter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setModelFilter(f)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                            modelFilter === f
                              ? "bg-gray-900 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                          )}
                        >
                          {f === "all" ? "Mind" : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                      {selectedModel && (
                        <button
                          onClick={() => setSelectedModel(null)}
                          className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          Modell törlése
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                      {filteredModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModel(selectedModel === m.id ? null : m.id)}
                          className={cn(
                            "relative rounded-xl border-2 overflow-hidden transition-all group",
                            selectedModel === m.id
                              ? `border-2 ${m.accentColor} shadow-md`
                              : "border-gray-200 hover:border-gray-300",
                          )}
                        >
                          <div className={cn("aspect-[3/4] bg-gradient-to-b flex items-center justify-center", m.gradient)}>
                            {m.portraitPath ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.portraitPath}
                                alt={m.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-3xl font-bold text-white/30">{m.letter}</span>
                            )}
                          </div>
                          <div className="px-2 py-1.5 bg-white">
                            <div className="text-xs font-bold text-gray-900">{m.name}</div>
                            <div className="text-[10px] text-gray-400">{m.style}</div>
                          </div>
                          {selectedModel === m.id && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background selection */}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Háttér (opcionális)</h2>
                    <p className="text-sm text-gray-500 mb-3">
                      Válassz egyedi hátteret a videóhoz.
                    </p>

                    <div className="flex gap-2 mb-4">
                      {(["all", "studio", "lifestyle"] as BgFilter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setBgFilter(f)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                            bgFilter === f
                              ? "bg-gray-900 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                          )}
                        >
                          {f === "all" ? "Mind" : f === "studio" ? "Stúdió" : "Életstílus"}
                        </button>
                      ))}
                      {selectedBackground && (
                        <button
                          onClick={() => setSelectedBackground(null)}
                          className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100"
                        >
                          Háttér törlése
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      {filteredBgs.map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => setSelectedBackground(selectedBackground === bg.id ? null : bg.id)}
                          className={cn(
                            "relative rounded-xl border-2 overflow-hidden transition-all",
                            selectedBackground === bg.id
                              ? "border-indigo-500 shadow-md"
                              : "border-gray-200 hover:border-gray-300",
                          )}
                        >
                          <div className={cn("aspect-video bg-gradient-to-br flex items-center justify-center", bg.gradient)}>
                            {bg.imagePath ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={bg.imagePath} alt={bg.label_en} className="w-full h-full object-cover" />
                            ) : (
                              <div className={cn("w-4 h-4 rounded-full", bg.dot)} />
                            )}
                          </div>
                          <div className="px-2 py-1.5 bg-white text-center">
                            <div className="text-[10px] font-bold text-gray-900">
                              {lang === "hu" ? bg.label_hu : bg.label_en}
                            </div>
                          </div>
                          {selectedBackground === bg.id && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Step 5: Music & Branding ─── */}
              {currentStep === 5 && (
                <div className="space-y-8">
                  {/* Music */}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Zene hangulat</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      Válassz zenei hangulatot a videóhoz — ez a Botikánál egyáltalán nem elérhető.
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                      {MUSIC_MOODS.map((mm) => (
                        <button
                          key={mm.id}
                          onClick={() => { setSelectedMusic(mm.id); setSelectedTemplate(null); }}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                            selectedMusic === mm.id
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-gray-200 bg-white hover:border-gray-300",
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center",
                            mm.gradient,
                          )}>
                            {mm.id === "none" ? (
                              <VolumeX className="w-5 h-5 text-white" />
                            ) : (
                              <Volume2 className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-900">{mm.name}</span>
                          <span className="text-[10px] text-gray-500">{mm.genre}</span>
                          {mm.id !== "none" && (
                            <span className="text-[10px] text-gray-400">{mm.bpm} BPM</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Branding */}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Branding overlay</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      Adj hozzá márkalogót vagy szöveget a videóhoz — szintén egyedülálló funkció.
                    </p>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Position */}
                      <div>
                        <Label className="text-xs font-semibold text-gray-700 mb-2 block">Pozíció</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {BRANDING_POSITIONS.map((bp) => (
                            <button
                              key={bp.id}
                              onClick={() => setBrandingPosition(bp.id)}
                              className={cn(
                                "py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all",
                                brandingPosition === bp.id
                                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                              )}
                            >
                              {bp.description_hu}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Text & Logo */}
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                            <Type className="w-3 h-3 inline mr-1" />
                            Szöveg
                          </Label>
                          <Input
                            value={brandingText}
                            onChange={(e) => setBrandingText(e.target.value)}
                            placeholder="pl. márkanév, #hashtag"
                            className="text-sm"
                            disabled={brandingPosition === "none"}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                            <ImageIcon className="w-3 h-3 inline mr-1" />
                            Logó
                          </Label>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => logoRef.current?.click()}
                              disabled={brandingPosition === "none"}
                              className={cn(
                                "px-4 py-2 rounded-lg border-2 border-dashed text-xs font-medium transition-all",
                                brandingPosition === "none"
                                  ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400"
                                  : "border-gray-300 text-gray-600 hover:border-gray-400",
                              )}
                            >
                              {brandingLogo ? brandingLogo.name : "Logó feltöltése"}
                            </button>
                            {brandingLogo && (
                              <button
                                onClick={() => { setBrandingLogo(null); setBrandingLogoPreview(null); }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <input
                            ref={logoRef}
                            type="file"
                            accept="image/png,image/svg+xml"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              setBrandingLogo(f);
                              setBrandingLogoPreview(f ? URL.createObjectURL(f) : null);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Step 6: Preview & Generate ─── */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Összefoglaló & Generálás</h2>
                    <p className="text-sm text-gray-500">
                      Ellenőrizd a beállításokat, majd indítsd a generálást.
                    </p>
                  </div>

                  {/* Summary grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Images */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Képek</div>
                      <div className="flex gap-2">
                        {selectedSourcePhotoId ? (
                          <div className="w-16 h-20 rounded-lg overflow-hidden border-2 border-indigo-300">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={collectionPhotos.find((p) => p.id === selectedSourcePhotoId)?.output_image_url ?? ""}
                              alt="Forrás"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          [
                            { preview: frontPreview, label: "Front" },
                            { preview: backPreview, label: "Back" },
                            { preview: sidePreview, label: "Side" },
                          ].map(({ preview, label }) =>
                            preview ? (
                              <div key={label} className="w-16 h-20 rounded-lg overflow-hidden border border-gray-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={preview} alt={label} className="w-full h-full object-cover" />
                              </div>
                            ) : null,
                          )
                        )}
                      </div>
                    </div>

                    {/* Motion & Camera */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Mozgás & Kamera</div>
                      <div className="space-y-1.5 text-xs text-gray-700">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Mozgás:</span>
                          <span className="font-medium">{activeMotion.icon} {activeMotion.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Kamera:</span>
                          <span className="font-medium">{activeCamera.icon} {activeCamera.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Képarány:</span>
                          <span className="font-medium">{selectedAspectRatio}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Időtartam:</span>
                          <span className="font-medium">{duration}s {loopVideo ? "(loop)" : ""}</span>
                        </div>
                      </div>
                    </div>

                    {/* Model & Background */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Modell & Háttér</div>
                      <div className="space-y-1.5 text-xs text-gray-700">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Modell:</span>
                          <span className="font-medium">{activeModel ? activeModel.name : "Nincs (flat lay)"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Háttér:</span>
                          <span className="font-medium">
                            {activeBg ? (lang === "hu" ? activeBg.label_hu : activeBg.label_en) : "Eredeti"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Music & Branding */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Zene & Branding</div>
                      <div className="space-y-1.5 text-xs text-gray-700">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Zene:</span>
                          <span className="font-medium">{activeMusic.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Branding:</span>
                          <span className="font-medium">
                            {brandingPosition === "none"
                              ? "Nincs"
                              : `${BRANDING_POSITIONS.find((b) => b.id === brandingPosition)?.description_hu ?? brandingPosition}${brandingText ? ` — "${brandingText}"` : ""}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Generation progress / result */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    {genStep === "idle" && (
                      <div className="text-center">
                        <Button
                          onClick={handleGenerate}
                          disabled={!frontImage && !selectedSourcePhotoId}
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3 text-sm font-bold rounded-xl shadow-lg"
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          Videó generálása
                        </Button>
                        <p className="text-[10px] text-gray-400 mt-2">
                          A videó generálás ~2–5 percet vesz igénybe
                        </p>
                      </div>
                    )}

                    {isGenerating && (
                      <div className="text-center space-y-4">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{STEP_LABELS[genStep]}</p>
                          <p className="text-[10px] text-gray-400 mt-1">Kérjük ne zárd be az oldalt</p>
                        </div>
                        {/* Progress bar */}
                        <div className="w-64 mx-auto h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{
                              width:
                                genStep === "uploading" ? "10%" :
                                genStep === "analyzing" ? "25%" :
                                genStep === "compositing" ? "45%" :
                                genStep === "rendering" ? "65%" :
                                genStep === "encoding" ? "85%" :
                                genStep === "finalizing" ? "95%" : "0%",
                            }}
                            transition={{ duration: 2, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    )}

                    {genStep === "done" && resultVideoUrl && (
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                          <Check className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="text-sm font-bold text-green-700">Videó sikeresen generálva!</p>
                        <div className="max-w-sm mx-auto rounded-xl overflow-hidden border border-gray-200 bg-black">
                          <video
                            src={resultVideoUrl}
                            controls
                            loop={loopVideo}
                            className="w-full"
                            autoPlay
                            muted
                          />
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <a
                            href={resultVideoUrl}
                            download
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Letöltés
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setGenStep("idle"); setResultVideoUrl(null); }}
                            className="text-xs"
                          >
                            Új generálás
                          </Button>
                        </div>
                      </div>
                    )}

                    {genStep === "error" && (
                      <div className="text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                          <X className="w-6 h-6 text-red-600" />
                        </div>
                        <p className="text-sm font-bold text-red-700">Hiba történt</p>
                        <p className="text-xs text-gray-500">{genError}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setGenStep("idle"); setGenError(null); }}
                          className="text-xs"
                        >
                          Újrapróbálás
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: Live preview sidebar */}
        <div className="w-72 shrink-0 bg-white border-l border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              Élő előnézet
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Image preview */}
            <div
              className="bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center"
              style={{
                aspectRatio: `${activeAspect.width}/${activeAspect.height}`,
              }}
            >
              {effectivePreview ? (
                <div className="relative w-full h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={effectivePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  {/* Motion overlay hint */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-end justify-center pb-3">
                    <div className="flex items-center gap-1.5 text-white text-[10px] font-medium bg-black/30 px-2.5 py-1 rounded-full backdrop-blur-sm">
                      <Play className="w-3 h-3" />
                      {activeMotion.name}
                    </div>
                  </div>
                  {/* Branding preview */}
                  {brandingPosition !== "none" && brandingText && (
                    <div
                      className={cn(
                        "absolute text-[8px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm",
                        brandingPosition === "top-left" && "top-2 left-2",
                        brandingPosition === "top-right" && "top-2 right-2",
                        brandingPosition === "bottom-left" && "bottom-2 left-2",
                        brandingPosition === "bottom-right" && "bottom-2 right-2",
                        brandingPosition === "center-bottom" && "bottom-2 left-1/2 -translate-x-1/2",
                      )}
                    >
                      {brandingText}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-300 space-y-2 p-6">
                  <Film className="w-8 h-8 mx-auto" />
                  <p className="text-[10px]">Tölts fel egy képet az előnézethez</p>
                </div>
              )}
            </div>

            {/* Quick config summary */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Mozgás</span>
                <span className="font-medium text-gray-700">{activeMotion.icon} {activeMotion.name}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Kamera</span>
                <span className="font-medium text-gray-700">{activeCamera.icon} {activeCamera.name}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Formátum</span>
                <span className="font-medium text-gray-700">{selectedAspectRatio} · {duration}s</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Modell</span>
                <span className="font-medium text-gray-700">{activeModel?.name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Zene</span>
                <span className="font-medium text-gray-700">{activeMusic.name}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Branding</span>
                <span className="font-medium text-gray-700">
                  {brandingPosition === "none" ? "—" : brandingText || "Logo"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer navigation ── */}
      <footer className="shrink-0 flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
        <Button
          variant="outline"
          size="sm"
          onClick={goBack}
          disabled={currentStep === 1 || isGenerating}
          className="text-xs"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          Előző
        </Button>

        <div className="flex items-center gap-1.5">
          {WIZARD_STEPS.map(({ step }) => (
            <div
              key={step}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                step === currentStep ? "bg-indigo-500" : step < currentStep ? "bg-indigo-200" : "bg-gray-200",
              )}
            />
          ))}
        </div>

        {currentStep < 6 ? (
          <Button
            size="sm"
            onClick={goNext}
            disabled={!canProceed(currentStep) || isGenerating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
          >
            Következő
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={(!frontImage && !selectedSourcePhotoId) || isGenerating}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs"
          >
            <Wand2 className="w-3.5 h-3.5 mr-1" />
            Generálás
          </Button>
        )}
      </footer>
    </div>
  );
}
