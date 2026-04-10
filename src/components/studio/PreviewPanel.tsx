"use client";

import { useState, useEffect, useRef } from "react";
import { Download, ImageIcon, Send, ChevronDown, ChevronRight, Clock, Loader2, Pencil, X, Pin, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { toast } from "sonner";
import type { UploadedImages, UploadedPreviews, GenerationStep, GenerationResult, ProjectVersionWithUrl } from "@/types";

// ─── Step config ──────────────────────────────────────────────────────────────
const STEP_KEYS = [
  { key: "uploading" as GenerationStep, label_key: "step_uploading" as const },
  { key: "analyzing" as GenerationStep, label_key: "step_analyzing" as const },
  { key: "removing" as GenerationStep, label_key: "step_removing" as const },
  { key: "preserving" as GenerationStep, label_key: "step_preserving" as const },
  { key: "compositing" as GenerationStep, label_key: "step_compositing" as const },
  { key: "finalizing" as GenerationStep, label_key: "step_finalizing" as const },
];

const STEP_ORDER: GenerationStep[] = ["uploading","analyzing","removing","preserving","compositing","finalizing","done"];

function stepIndex(step: GenerationStep) { return STEP_ORDER.indexOf(step); }

async function downloadFile(url: string, filename: string) {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
}

function formatHuDate(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function EmptyState() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
      <div className="relative">
        {[2, 1, 0].map((i) => (
          <div key={i} className="absolute rounded-2xl border-2 border-dashed border-gray-150 bg-gray-50"
            style={{ width: 120, height: 150, left: i * 10 - 20, top: i * -6, zIndex: i, opacity: 1 - i * 0.2 }} />
        ))}
        <div className="relative rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center"
          style={{ width: 120, height: 150, zIndex: 3 }}>
          <ImageIcon className="w-8 h-8 text-gray-300" />
        </div>
      </div>
      <div className="text-center mt-6">
        <p className="text-base font-semibold text-gray-500">{t("prev_empty_title")}</p>
        <p className="text-sm text-gray-400 mt-1 max-w-[220px] leading-relaxed">{t("prev_empty_hint")}</p>
      </div>
    </div>
  );
}

function InputPreview({ previews }: { previews: UploadedPreviews }) {
  const { t } = useLanguage();
  const slots = (["front","back","side"] as const).filter(k => previews[k]);
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("prev_input")}</p>
      <div className="flex gap-4 items-end justify-center">
        {slots.map((key) => (
          <div key={key} className="flex flex-col items-center gap-2">
            <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50"
              style={{ width: key === "front" ? 140 : 110, height: key === "front" ? 175 : 138 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[key]!} alt={key} className="w-full h-full object-cover" />
            </div>
            <span className="text-xs font-medium text-gray-400 capitalize">{key}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-400">{t("prev_hint")}</p>
    </div>
  );
}

function LoadingState({ step }: { step: GenerationStep }) {
  const { t } = useLanguage();
  const currentIdx = stepIndex(step);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-gray-900 flex items-center justify-center animate-pulse">
          <span className="text-4xl select-none">👻</span>
        </div>
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: "3s" }}>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-gray-400" />
        </div>
      </div>

      <div className="w-full max-w-xs space-y-3">
        {STEP_KEYS.map(({ key, label_key }, i) => {
          const done = i < currentIdx;
          const active = key === step;
          return (
            <div key={key} className="flex items-center gap-3">
              <div className={cn(
                "w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all duration-500",
                done ? "bg-gray-900" : active ? "bg-gray-900 ring-4 ring-gray-200" : "bg-gray-200"
              )}>
                {done && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {active && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
              </div>
              <span className={cn(
                "text-sm transition-all duration-300",
                done ? "text-gray-400 line-through" : active ? "text-gray-900 font-semibold" : "text-gray-300"
              )}>
                {t(label_key)}
                {active && [".", ".", "."].map((c, j) => (
                  <span key={j} className="inline-block animate-bounce ml-0.5"
                    style={{ animationDelay: `${j * 150}ms`, animationDuration: "1s" }}>{c}</span>
                ))}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-gray-400 text-center max-w-[220px] leading-relaxed">{t("prev_step_wait")}</p>
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────

interface HistoryPanelProps {
  versions: ProjectVersionWithUrl[];
  activeVersionIndex: number;
  onSelectVersion: (index: number) => void;
}

function HistoryPanel({ versions, activeVersionIndex, onSelectVersion }: HistoryPanelProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);

  if (versions.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-gray-100 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{t("hist_title")}</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{versions.length}</span>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
          {versions.map((v, idx) => (
            <button
              key={v.id}
              onClick={() => onSelectVersion(idx)}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all",
                activeVersionIndex === idx ? "bg-gray-900 text-white" : "hover:bg-gray-50 text-gray-700"
              )}
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-100 border border-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.output_image_thumb_url} alt={`v${v.version_number}`} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[11px] font-bold", activeVersionIndex === idx ? "text-white/70" : "text-gray-400")}>
                    v{v.version_number}
                  </span>
                  <span className={cn("text-xs font-semibold truncate", activeVersionIndex === idx ? "text-white" : "text-gray-700")}>
                    {v.description}
                  </span>
                </div>
                <p className={cn("text-[11px] mt-0.5", activeVersionIndex === idx ? "text-white/60" : "text-gray-400")}>
                  {formatHuDate(v.created_at)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Refinement Panel ────────────────────────────────────────────────────────

interface RefinementPanelProps {
  projectId: string;
  onRefined: (result: GenerationResult) => void;
  annotationBlob?: Blob | null;
  onClearAnnotation?: () => void;
}

interface WorkspaceMemoryItem { id: string; note: string; }

function RefinementPanel({ projectId, onRefined, annotationBlob, onClearAnnotation }: RefinementPanelProps) {
  const { t } = useLanguage();
  const [feedback, setFeedback] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [annotationPreviewUrl, setAnnotationPreviewUrl] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [isPinning, setIsPinning] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [memories, setMemories] = useState<WorkspaceMemoryItem[]>([]);

  useEffect(() => {
    fetch("/api/workspace-memory")
      .then((r) => r.json())
      .then((d) => { if (d.memories) setMemories(d.memories); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!annotationBlob) { setAnnotationPreviewUrl(null); return; }
    const url = URL.createObjectURL(annotationBlob);
    setAnnotationPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [annotationBlob]);

  const handleRefine = async () => {
    if (!feedback.trim() || isRefining) return;
    const sent = feedback.trim();
    setIsRefining(true);
    setPinned(false);
    setLastFeedback(null);
    try {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("feedback", sent);
      if (annotationBlob) {
        formData.append("annotation", annotationBlob, "annotation.png");
      }

      const res = await fetch("/api/refine", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Refinement failed");

      onRefined({
        outputUrl: data.outputUrl,
        outputPath: data.outputPath,
        projectId: data.projectId,
        mimeType: data.mimeType,
        generatedAt: new Date(),
        versionNumber: data.versionNumber,
      });

      setFeedback("");
      setLastFeedback(sent);
      toast.success(t("refine_success"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("refine_error"));
    } finally {
      setIsRefining(false);
    }
  };

  const handlePin = async () => {
    if (!lastFeedback || isPinning || pinned) return;
    setIsPinning(true);
    try {
      const res = await fetch("/api/workspace-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: lastFeedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemories((prev) => [data.memory, ...prev]);
      setPinned(true);
      toast.success(t("wsmem_pinned"));
    } catch {
      toast.error("Could not save to memory");
    } finally {
      setIsPinning(false);
    }
  };

  const handleForgetMemory = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await fetch("/api/workspace-memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  };

  return (
    <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
      {/* Active workspace memories */}
      {memories.length > 0 && (
        <div className="mb-3 p-2.5 rounded-xl bg-blue-50 border border-blue-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain className="w-3 h-3 text-blue-500" />
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">
              {memories.length} {memories.length === 1 ? t("wsmem_active") : t("wsmem_active_plural")}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {memories.map((m) => (
              <div key={m.id} className="group flex items-center gap-1 bg-white border border-blue-100 rounded-lg px-2 py-1">
                <span className="text-[11px] text-blue-700 leading-tight max-w-[200px] truncate">{m.note}</span>
                <button
                  onClick={() => handleForgetMemory(m.id)}
                  className="opacity-0 group-hover:opacity-100 text-blue-300 hover:text-red-400 transition-all ml-0.5"
                  aria-label="Remove memory"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {annotationPreviewUrl && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-red-50 border border-red-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={annotationPreviewUrl} alt="annotation" className="w-10 h-10 rounded-lg object-cover border border-red-100 bg-white" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-700">Jelölt terület csatolva</p>
            <p className="text-[11px] text-red-500">Az AI a piros területre fókuszál</p>
          </div>
          <button onClick={onClearAnnotation} className="text-red-300 hover:text-red-600 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <p className="text-xs font-semibold text-gray-700 mb-1">{t("refine_title")}</p>
      <p className="text-xs text-gray-400 mb-3">{t("refine_desc")}</p>
      <div className="flex gap-2">
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={t("refine_ph")}
          disabled={isRefining}
          rows={2}
          className="text-sm border-gray-200 resize-none leading-relaxed flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRefine();
          }}
        />
        <Button
          onClick={handleRefine}
          disabled={!feedback.trim() || isRefining}
          className="self-end h-9 px-3 bg-gray-900 text-white hover:bg-gray-700 shrink-0"
        >
          {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {/* Remember this feedback */}
      {lastFeedback && !pinned && (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-[11px] text-gray-400 truncate flex-1">"{lastFeedback}"</p>
          <button
            onClick={handlePin}
            disabled={isPinning}
            className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Pin className="w-3 h-3" />
            {isPinning ? "…" : t("wsmem_pin")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Result View ──────────────────────────────────────────────────────────────

interface ResultViewProps {
  result: GenerationResult;
  versions: ProjectVersionWithUrl[];
  activeVersionIndex: number;
  onSelectVersion: (index: number) => void;
  onRefined: (result: GenerationResult) => void;
}

function ResultView({ result, versions, activeVersionIndex, onSelectVersion, onRefined }: ResultViewProps) {
  const { t } = useLanguage();
  const slug = result.projectId.slice(0, 8);

  const [drawingMode, setDrawingMode] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [annotationBlob, setAnnotationBlob] = useState<Blob | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const displayUrl = versions.length > 0
    ? versions[activeVersionIndex]?.output_image_url ?? result.outputUrl
    : result.outputUrl;

  const setupCtx = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "rgba(239, 68, 68, 0.75)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  useEffect(() => {
    setAnnotationBlob(null);
    setHasDrawing(false);

    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const syncSize = () => {
      const rect = img.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      setupCtx(canvas);
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(img);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayUrl]);

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode) return;
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    lastPosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPosRef.current = { x, y };
    setHasDrawing(true);
  };

  const stopDraw = () => {
    isDrawingRef.current = false;
  };

  const clearAnnotation = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      setupCtx(canvas);
    }
    setAnnotationBlob(null);
    setHasDrawing(false);
    setDrawingMode(false);
  };

  const finalizeAnnotation = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) setAnnotationBlob(blob);
      setDrawingMode(false);
    }, "image/png");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Generated image — fills available space, perfectly centered */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-6 bg-gray-50/50">
        <div className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-lg bg-white max-w-full max-h-full flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={displayUrl}
            alt="Ghost mannequin result"
            className="object-contain max-h-[calc(100vh-420px)] max-w-full block mx-auto"
            style={{ display: "block" }}
          />
          <canvas
            ref={canvasRef}
            className={cn(
              "absolute inset-0 w-full h-full",
              drawingMode ? "cursor-crosshair" : "pointer-events-none opacity-60"
            )}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
          />
          {drawingMode && (
            <div className="absolute top-3 right-3 flex gap-2 z-10">
              <Button size="sm" variant="outline"
                className="h-7 px-2.5 text-xs bg-white/90 backdrop-blur-sm border-gray-200"
                onClick={clearAnnotation}>
                Törlés
              </Button>
              <Button size="sm"
                className="h-7 px-2.5 text-xs bg-red-600 hover:bg-red-700 text-white"
                onClick={finalizeAnnotation}
                disabled={!hasDrawing}>
                Kész
              </Button>
            </div>
          )}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm border border-gray-100">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold text-gray-700">
              {t("prev_generated")} {versions.length > 0 && `· v${versions[activeVersionIndex]?.version_number ?? 1}`}
            </span>
          </div>
          {!drawingMode && (
            <div className="absolute bottom-3 right-3 z-10">
              {annotationBlob ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 border border-green-200">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Annotáció csatolva
                  <button onClick={clearAnnotation} className="ml-1 text-gray-400 hover:text-gray-600">×</button>
                </div>
              ) : (
                <Button size="sm" variant="outline"
                  className="h-7 px-2.5 text-xs bg-white/90 backdrop-blur-sm border-gray-200 gap-1.5"
                  onClick={() => setDrawingMode(true)}>
                  <Pencil className="w-3 h-3" />
                  Terület jelölése
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Download bar */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3">
        <div className="flex gap-2">
          <Button
            onClick={() => downloadFile(displayUrl, `ghost-${slug}.png`)}
            className="flex-1 bg-gray-900 text-white hover:bg-gray-700 gap-2 h-9 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            {t("prev_dl_png")}
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadFile(displayUrl, `ghost-${slug}.webp`)}
            className="flex-1 border-gray-200 gap-2 h-9 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            {t("prev_dl_webp")}
          </Button>
        </div>
      </div>

      {/* Refinement panel */}
      <RefinementPanel
        projectId={result.projectId}
        onRefined={onRefined}
        annotationBlob={annotationBlob}
        onClearAnnotation={clearAnnotation}
      />

      {/* History panel */}
      <HistoryPanel
        versions={versions}
        activeVersionIndex={activeVersionIndex}
        onSelectVersion={onSelectVersion}
      />
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
        <p className="text-base font-semibold text-gray-900">Generálás sikertelen</p>
        <p className="text-sm text-gray-500 mt-2 max-w-[260px] leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

interface PreviewPanelProps {
  images: UploadedImages;
  previews: UploadedPreviews;
  step: GenerationStep;
  result: GenerationResult | null;
  error: string | null;
  versions: ProjectVersionWithUrl[];
  activeVersionIndex: number;
  onSelectVersion: (index: number) => void;
  onRefined: (result: GenerationResult) => void;
}

export function PreviewPanel({
  images, previews, step, result, error,
  versions, activeVersionIndex, onSelectVersion, onRefined,
}: PreviewPanelProps) {
  const { t } = useLanguage();
  const hasPreviews = previews.front || previews.back;
  const isLoading = step !== "idle" && step !== "done" && step !== "error";

  return (
    <div className="flex-1 min-w-0 border-r border-gray-100 bg-gray-50/50 flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-gray-900">{t("prev_title")}</h2>
          {step === "done" && result && (
            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {t("prev_generated")}
            </span>
          )}
          {isLoading && (
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full animate-pulse">
              {t("set_generating")}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto flex flex-col">
        {error ? <ErrorState message={error} />
          : step === "done" && result ? (
            <ResultView
              result={result}
              versions={versions}
              activeVersionIndex={activeVersionIndex}
              onSelectVersion={onSelectVersion}
              onRefined={onRefined}
            />
          )
          : isLoading ? <LoadingState step={step} />
          : hasPreviews ? <InputPreview previews={previews} />
          : <EmptyState />}
      </div>
    </div>
  );
}
