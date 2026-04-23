"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  FolderOpen, Wand2, Loader2, Download, CheckCircle2,
  XCircle, Clock, AlertCircle, Trash2, ImageIcon,
  ArrowLeft, Send, Pencil, RotateCcw, Save, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { compressImage, downloadFile } from "@/lib/image-utils";
import JSZip from "jszip";

// Types

interface QaRegion {
  bbox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  label: string;
}

interface QaResult {
  pass: boolean;
  issues: string[];
  regions?: QaRegion[];
  severity: "ok" | "warning" | "critical";
  summary: string;
}

interface BatchProduct {
  id: string;
  folderName: string;
  /** Relative path from root folder (e.g. "ProductA" or "Season/ProductA") */
  relativePath: string;
  front: File;
  back: File;
  side: File | null;
  status: "pending" | "processing" | "fixing" | "completed" | "failed" | "skipped";
  error?: string;
  projectId?: string;
  outputUrl?: string;
  outputBlob?: Blob;
  qa?: QaResult;
  saved?: boolean;
}

type BatchStatus = "idle" | "processing" | "done";

function classifyFile(name: string): "front" | "back" | "side" | null {
  const n = name.toLowerCase().replace(/[^a-z0-9áéíóöőúüű]/g, "");
  if (/front|elol|elől|eleje|elülső|elulso/.test(n)) return "front";
  if (/back|hatul|hátul|hátsó|hatso|hatulso/.test(n)) return "back";
  if (/side|oldal|oldalsó|oldso/.test(n)) return "side";
  return null;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function isImageFile(file: File): boolean {
  return IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function parseProducts(files: File[]): BatchProduct[] {
  const groups = new Map<string, { relativePath: string; files: File[] }>();

  for (const file of files) {
    if (!isImageFile(file)) continue;
    const parts = file.webkitRelativePath.split("/");
    if (parts.length < 3) continue;
    const subParts = parts.slice(1, -1);
    const relativePath = subParts.join("/");

    let group = groups.get(relativePath);
    if (!group) {
      group = { relativePath, files: [] };
      groups.set(relativePath, group);
    }
    group.files.push(file);
  }

  const products: BatchProduct[] = [];

  for (const [, group] of groups) {
    const imgs = group.files.filter(isImageFile);
    if (imgs.length < 2) continue;

    let front: File | null = null;
    let back: File | null = null;
    let side: File | null = null;

    for (const img of imgs) {
      const role = classifyFile(img.name);
      if (role === "front" && !front) front = img;
      else if (role === "back" && !back) back = img;
      else if (role === "side" && !side) side = img;
    }

    if (!front || !back) {
      const unassigned = imgs.filter((f) => f !== front && f !== back && f !== side);
      unassigned.sort((a, b) => a.name.localeCompare(b.name));
      if (!front && unassigned.length > 0) front = unassigned.shift()!;
      if (!back && unassigned.length > 0) back = unassigned.shift()!;
      if (!side && unassigned.length > 0) side = unassigned.shift()!;
    }

    if (!front || !back) continue;

    const folderName = group.relativePath.split("/").pop() || group.relativePath;

    products.push({
      id: crypto.randomUUID(),
      folderName,
      relativePath: group.relativePath,
      front,
      back,
      side,
      status: "pending",
    });
  }

  products.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return products;
}

// QA check with retry

const QA_MAX_RETRIES = 3;
const QA_BASE_DELAY_MS = 4_000; // 4s, 8s, 12s backoff

async function runQaWithRetry(blob: Blob): Promise<QaResult | undefined> {
  for (let attempt = 1; attempt <= QA_MAX_RETRIES; attempt++) {
    try {
      const qaForm = new FormData();
      qaForm.append("image", blob, "check.png");
      const qaRes = await fetch("/api/qa-check", { method: "POST", body: qaForm });

      if (qaRes.ok) {
        return (await qaRes.json()) as QaResult;
      }

      // Rate-limited or server error — wait and retry
      if (qaRes.status === 429 || qaRes.status >= 500) {
        if (attempt < QA_MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, QA_BASE_DELAY_MS * attempt));
          continue;
        }
      }

      // Non-retryable client error (4xx other than 429) — give up
      return undefined;
    } catch {
      // Network error — wait and retry
      if (attempt < QA_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, QA_BASE_DELAY_MS * attempt));
        continue;
      }
    }
  }
  return undefined;
}

async function generateAnnotationFromRegions(
  imageBlob: Blob,
  regions: QaRegion[]
): Promise<Blob> {
  const img = await createImageBitmap(imageBlob);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
  ctx.lineWidth = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) / 120));

  for (const region of regions) {
    const [ymin, xmin, ymax, xmax] = region.bbox;
    const x1 = (xmin / 1000) * canvas.width;
    const y1 = (ymin / 1000) * canvas.height;
    const x2 = (xmax / 1000) * canvas.width;
    const y2 = (ymax / 1000) * canvas.height;

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.max(((x2 - x1) / 2) * 1.25, 20);
    const ry = Math.max(((y2 - y1) / 2) * 1.25, 20);

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

async function attemptAutoFix(
  projectId: string,
  imageBlob: Blob,
  qa: QaResult
): Promise<{ outputUrl: string; outputBlob: Blob; qa?: QaResult } | null> {
  try {
    // Generate annotation overlay from QA bounding box regions
    let annotationBlob: Blob | null = null;
    if (qa.regions?.length) {
      annotationBlob = await generateAnnotationFromRegions(imageBlob, qa.regions);
    }

    // Build feedback from QA issues
    const feedback = `Automatikus QA javítás. Észlelt problémák:\n${qa.issues.map((i) => `- ${i}`).join("\n")}`;

    const refineForm = new FormData();
    refineForm.append("projectId", projectId);
    refineForm.append("feedback", feedback);
    if (annotationBlob) refineForm.append("annotation", annotationBlob, "annotation.png");

    const refineRes = await fetch("/api/refine", { method: "POST", body: refineForm });
    if (!refineRes.ok) return null;

    const refineData = await refineRes.json();
    const newOutputUrl = refineData.outputUrl as string;
    const newBlob = await fetch(newOutputUrl).then((r) => r.blob());

    // Re-run QA on the refined result (with retry)
    const newQa = await runQaWithRetry(newBlob);

    return { outputUrl: newOutputUrl, outputBlob: newBlob, qa: newQa };
  } catch {
    return null;
  }
}

function ProductCard({
  product, index, isSelected, onClick,
}: {
  product: BatchProduct; index: number; isSelected: boolean; onClick: () => void;
}) {
  const statusConfig = {
    pending:    { icon: Clock,        color: "text-gray-400",  bg: "bg-gray-50",  label: "Várakozik"    },
    processing: { icon: Loader2,      color: "text-amber-500", bg: "bg-amber-50", label: "Feldolgozás"  },
    fixing:     { icon: Loader2,      color: "text-orange-500", bg: "bg-orange-50", label: "Javítás"    },
    completed:  { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Kész"         },
    failed:     { icon: XCircle,      color: "text-red-500",   bg: "bg-red-50",   label: "Hiba"         },
    skipped:    { icon: AlertCircle,  color: "text-gray-400",  bg: "bg-gray-50",  label: "Kihagyva"     },
  };

  const cfg = statusConfig[product.status];
  const StatusIcon = cfg.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left",
        isSelected ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900" :
        product.status === "processing" ? "border-amber-200 bg-amber-50/50" :
        product.status === "fixing" ? "border-orange-200 bg-orange-50/50" :
        product.status === "completed" ? "border-green-200 bg-green-50/30 hover:border-green-300" :
        product.status === "failed" ? "border-red-200 bg-red-50/30 hover:border-red-300" :
        "border-gray-100 bg-white hover:border-gray-200"
      )}
    >
      <div className="flex items-center justify-center w-6 h-6 shrink-0">
        <span className="text-xs font-bold text-gray-300">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{product.folderName}</p>
        <p className="text-[11px] text-gray-400 truncate">
          {product.front.name} + {product.back.name}
          {product.side ? ` + ${product.side.name}` : ""}
        </p>
        {product.error && (
          <p className="text-[11px] text-red-500 mt-0.5 truncate">{product.error}</p>
        )}
        {product.qa && (
          <div className={cn("flex items-center gap-1 mt-0.5",
            product.qa.severity === "critical" ? "text-red-500" :
            product.qa.severity === "warning" ? "text-amber-500" : "text-green-500"
          )}>
            {product.qa.severity === "ok" ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
            <span className="text-[11px] truncate">{product.qa.summary}</span>
          </div>
        )}
        {!product.qa && product.status === "completed" && (
          <div className="flex items-center gap-1 mt-0.5 text-gray-400">
            <AlertCircle className="w-3 h-3" />
            <span className="text-[11px]">QA nem futott</span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold", cfg.bg, cfg.color)}>
          <StatusIcon className={cn("w-3.5 h-3.5", (product.status === "processing" || product.status === "fixing") && "animate-spin")} />
          {cfg.label}
        </div>
        {product.saved && (
          <span className="text-[10px] font-semibold text-green-600 flex items-center gap-0.5">
            <Save className="w-3 h-3" /> Mentve
          </span>
        )}
      </div>
    </button>
  );
}

function ProductDetailView({
  product,
  onBack,
  onProductUpdated,
}: {
  product: BatchProduct;
  onBack: () => void;
  onProductUpdated: (id: string, updates: Partial<BatchProduct>) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [annotationBlob, setAnnotationBlob] = useState<Blob | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

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
    setDrawingMode(false);
    setFeedback("");

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
  }, [product.outputUrl]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    isDrawingRef.current = true;
    lastPosRef.current = pos;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingMode || !isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
    setHasDrawing(true);
  };

  const stopDraw = () => { isDrawingRef.current = false; };

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

  const runQaCheck = useCallback((blob: Blob) => runQaWithRetry(blob), []);

  const handleRefine = async () => {
    if (!feedback.trim() || isRefining || !product.projectId) return;
    setIsRefining(true);
    try {
      const formData = new FormData();
      formData.append("projectId", product.projectId);
      formData.append("feedback", feedback.trim());
      if (annotationBlob) formData.append("annotation", annotationBlob, "annotation.png");

      const res = await fetch("/api/refine", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Finomítás sikertelen");

      const newOutputUrl = data.outputUrl as string;
      const blob = await fetch(newOutputUrl).then((r) => r.blob());

      // Run QA on refined result
      const qa = await runQaCheck(blob);

      onProductUpdated(product.id, { outputUrl: newOutputUrl, outputBlob: blob, qa, saved: false });
      setFeedback("");
      clearAnnotation();
      toast.success("Finomítás kész!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Finomítás sikertelen");
    } finally {
      setIsRefining(false);
    }
  };

  const handleRegenerate = async () => {
    onProductUpdated(product.id, { status: "processing", error: undefined, qa: undefined, saved: false });
    try {
      const [cFront, cBack, cSide] = await Promise.all([
        compressImage(product.front),
        compressImage(product.back),
        product.side ? compressImage(product.side) : Promise.resolve(null),
      ]);
      const formData = new FormData();
      formData.append("front", cFront, "front.jpg");
      formData.append("back", cBack, "back.jpg");
      if (cSide) formData.append("side", cSide, "side.jpg");
      formData.append("projectName", product.folderName);

      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error((data.error as string) || `Server error ${res.status}`);

      const outputUrl = data.outputUrl as string;
      const blob = await fetch(outputUrl).then((r) => r.blob());

      // Run QA on regenerated result
      const qa = await runQaCheck(blob);

      const projectId = data.projectId as string;

      const qaFailed = !qa || !qa.pass || qa.severity === "critical";

      // Auto-fix if QA detected issues
      if (qaFailed && projectId) {
        const qaForStatus = qa ?? {
          pass: false,
          issues: ["QA ellenőrzés sikertelen — nem futott le"],
          severity: "critical" as const,
          summary: "QA nem futott le, manuális ellenőrzés szükséges.",
        };
        onProductUpdated(product.id, { status: "fixing", qa: qaForStatus });

        const fixed = await attemptAutoFix(projectId, blob, qaForStatus);
        if (fixed) {
          const fixedQaOk = fixed.qa && fixed.qa.pass && fixed.qa.severity !== "critical";
          onProductUpdated(product.id, {
            status: fixedQaOk ? "completed" : "failed",
            projectId,
            outputUrl: fixed.outputUrl,
            outputBlob: fixed.outputBlob,
            error: fixedQaOk ? undefined : "Automatikus javítás után is maradtak kritikus QA hibák",
            qa: fixed.qa,
            saved: false,
          });
          toast[fixedQaOk ? "success" : "error"](
            fixedQaOk
              ? `${product.folderName} újragenerálva és automatikusan javítva!`
              : `${product.folderName} javítás sikertelen — manuális ellenőrzés szükséges`
          );
          return;
        }
        // Auto-fix failed entirely
        onProductUpdated(product.id, {
          status: "failed",
          projectId,
          outputUrl,
          outputBlob: blob,
          error: "QA hibát talált és az automatikus javítás sikertelen",
          qa: qaForStatus,
          saved: false,
        });
        toast.error(`${product.folderName} — QA hiba, javítás sikertelen`);
        return;
      }

      onProductUpdated(product.id, {
        status: "completed",
        projectId,
        outputUrl,
        outputBlob: blob,
        error: undefined,
        qa,
        saved: false,
      });
      toast.success(`${product.folderName} újragenerálva!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ismeretlen hiba";
      onProductUpdated(product.id, { status: "failed", error: msg });
      toast.error(msg);
    }
  };

  const handleSave = () => {
    onProductUpdated(product.id, { saved: true });
    toast.success(`${product.folderName} mentve!`);
  };

  if (product.status === "pending") {
    return (
      <div className="flex flex-col h-full">
        <DetailHeader product={product} onBack={onBack} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Clock className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm font-semibold text-gray-500">Várakozik a feldolgozásra</p>
          </div>
        </div>
      </div>
    );
  }

  if (product.status === "processing") {
    return (
      <div className="flex flex-col h-full">
        <DetailHeader product={product} onBack={onBack} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center animate-pulse mx-auto">
              <span className="text-3xl select-none">👻</span>
            </div>
            <p className="text-sm font-semibold text-gray-700">Feldolgozás alatt...</p>
            <p className="text-xs text-gray-400">Ez akár 30-60 másodpercig is tarthat</p>
          </div>
        </div>
      </div>
    );
  }

  if (product.status === "fixing") {
    return (
      <div className="flex flex-col h-full">
        <DetailHeader product={product} onBack={onBack} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center animate-pulse mx-auto">
              <ShieldAlert className="w-8 h-8 text-orange-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Automatikus javítás...</p>
            <p className="text-xs text-gray-400 max-w-[260px] leading-relaxed mx-auto">
              A QA hibát talált, annotáció készül és a kép automatikusan javításra kerül.
            </p>
            {product.qa && product.qa.issues.length > 0 && (
              <div className="mt-2 p-3 rounded-xl bg-orange-50 border border-orange-100 max-w-xs mx-auto text-left">
                <p className="text-[11px] font-semibold text-orange-700 mb-1">Észlelt problémák:</p>
                <ul className="space-y-0.5">
                  {product.qa.issues.map((issue, i) => (
                    <li key={i} className="text-[11px] text-orange-600">• {issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (product.status === "failed") {
    return (
      <div className="flex flex-col h-full">
        <DetailHeader product={product} onBack={onBack} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
              <XCircle className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Generálás sikertelen</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[260px] leading-relaxed">{product.error}</p>
            </div>
            <Button onClick={handleRegenerate} className="gap-2 bg-gray-900 text-white hover:bg-gray-700">
              <RotateCcw className="w-4 h-4" />
              Újragenerálás
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DetailHeader product={product} onBack={onBack} />

      {/* Result image with annotation canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-6 bg-gray-50/50">
        <div className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-lg bg-white max-w-full max-h-full flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={product.outputUrl}
            alt={`${product.folderName} eredmény`}
            className="object-contain max-h-[calc(100vh-480px)] max-w-full block mx-auto"
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
            <span className="text-xs font-semibold text-gray-700">Elkészült</span>
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

      {/* QA banner */}
      {product.qa && (
        <div className={cn(
          "shrink-0 border-t px-5 py-2.5",
          product.qa.severity === "critical" ? "border-red-200 bg-red-50" :
          product.qa.severity === "warning" ? "border-amber-200 bg-amber-50" :
          "border-green-200 bg-green-50"
        )}>
          <div className="flex items-start gap-2">
            {product.qa.severity === "ok"
              ? <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              : <ShieldAlert className={cn("w-4 h-4 shrink-0 mt-0.5", product.qa.severity === "critical" ? "text-red-500" : "text-amber-500")} />
            }
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-semibold",
                product.qa.severity === "critical" ? "text-red-700" :
                product.qa.severity === "warning" ? "text-amber-700" : "text-green-700"
              )}>
                QA: {product.qa.summary}
              </p>
              {product.qa.issues.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {product.qa.issues.map((issue, i) => (
                    <li key={i} className={cn("text-[11px]",
                      product.qa!.severity === "critical" ? "text-red-600" : "text-amber-600"
                    )}>• {issue}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      {!product.qa && (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-xs font-semibold text-gray-500">
              QA ellenőrzés nem futott le — ellenőrizd manuálisan, vagy generáld újra.
            </p>
          </div>
        </div>
      )}

      {/* Actions bar: download + regenerate + mentés */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3">
        <div className="flex gap-2">
          <Button
            onClick={() => downloadFile(product.outputUrl!, `ghost-${product.folderName}.png`)}
            variant="outline"
            className="flex-1 border-gray-200 gap-2 h-9 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            Letöltés
          </Button>
          <Button
            variant="outline"
            onClick={handleRegenerate}
            className="flex-1 border-gray-200 gap-2 h-9 text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Újragenerálás
          </Button>
          <Button
            onClick={handleSave}
            disabled={product.saved}
            className={cn(
              "flex-1 gap-2 h-9 text-xs font-semibold",
              product.saved
                ? "bg-green-100 text-green-700 cursor-default"
                : "bg-green-600 hover:bg-green-700 text-white"
            )}
          >
            <Save className="w-3.5 h-3.5" />
            {product.saved ? "Mentve" : "Mentés"}
          </Button>
        </div>
      </div>

      {/* Refinement panel */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4">
        {annotationBlob && (
          <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-red-50 border border-red-100">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700">Jelölt terület csatolva</p>
              <p className="text-[11px] text-red-500">Az AI a piros területre fókuszál</p>
            </div>
            <button onClick={clearAnnotation} className="text-red-300 hover:text-red-600 transition-colors shrink-0">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <p className="text-xs font-semibold text-gray-700 mb-1">Finomítás</p>
        <p className="text-xs text-gray-400 mb-3">Írd le mit változtassunk, vagy jelölj ki területet a képen.</p>
        <div className="flex gap-2">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Pl. A gallér szélén látszik a mannequin..."
            disabled={isRefining}
            rows={2}
            maxLength={2000}
            className="text-sm border-gray-200 resize-none leading-relaxed flex-1"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRefine(); }}
          />
          <Button
            onClick={handleRefine}
            disabled={!feedback.trim() || isRefining || !product.projectId}
            className="self-end h-9 px-3 bg-gray-900 text-white hover:bg-gray-700 shrink-0"
          >
            {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailHeader({ product, onBack }: { product: BatchProduct; onBack: () => void }) {
  return (
    <div className="px-5 pt-4 pb-3 border-b border-gray-100 bg-white shrink-0 flex items-center gap-3">
      <button onClick={onBack} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
        <ArrowLeft className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-bold text-gray-900 truncate">{product.folderName}</h2>
        <p className="text-[11px] text-gray-400 truncate">{product.relativePath}</p>
      </div>
    </div>
  );
}

export function BatchGhostStudioTool({ collectionId }: { collectionId?: string | null }) {
  const [products, setProducts] = useState<BatchProduct[]>([]);
  const [batchStatus, setBatchStatus] = useState<BatchStatus>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const abortRef = useRef(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const batchCollectionIdRef = useRef<string | null>(collectionId ?? null);

  if (!collectionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
            <FolderOpen className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Projekt mappa szükséges</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            A tömeges generáláshoz először hozz létre vagy válassz ki egy projekt mappát.
            Navigálj a <strong>Projektek</strong> oldalra, és onnan indítsd a tömeges generálást.
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

  const selectedProduct = selectedProductId ? products.find((p) => p.id === selectedProductId) ?? null : null;

  const updateProduct = useCallback((id: string, updates: Partial<BatchProduct>) => {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const parsed = parseProducts(files);
    if (parsed.length === 0) {
      toast.error("Nem található feldolgozható almappa. Minden almappában kell lennie legalább 2 képnek (front + back).");
      return;
    }
    setProducts(parsed);
    setBatchStatus("idle");
    setCurrentIndex(0);
    setSelectedProductId(null);
    batchCollectionIdRef.current = collectionId ?? null;
    toast.success(`${parsed.length} termék található`);
    e.target.value = "";
  }, [collectionId]);

  const processProduct = useCallback(async (
    product: BatchProduct,
    onStatusUpdate?: (updates: Partial<BatchProduct>) => void
  ): Promise<Partial<BatchProduct> & { _autoFixed?: boolean }> => {
    const [cFront, cBack, cSide] = await Promise.all([
      compressImage(product.front),
      compressImage(product.back),
      product.side ? compressImage(product.side) : Promise.resolve(null),
    ]);

    const formData = new FormData();
    formData.append("front", cFront, "front.jpg");
    formData.append("back", cBack, "back.jpg");
    if (cSide) formData.append("side", cSide, "side.jpg");
    formData.append("projectName", product.folderName);
    // Use shared collection — first response sets it, subsequent reuse it
    if (batchCollectionIdRef.current) {
      formData.append("collectionId", batchCollectionIdRef.current);
    }

    const res = await fetch("/api/generate", { method: "POST", body: formData });
    let data: Record<string, unknown> = {};
    try { data = await res.json(); } catch {
      throw new Error(`Server error ${res.status}`);
    }
    if (!res.ok) throw new Error((data.error as string) || `Server error ${res.status}`);

    // Capture the collection from the first generation so all items share it
    if (!batchCollectionIdRef.current && data.collectionId) {
      batchCollectionIdRef.current = data.collectionId as string;
    }

    const outputUrl = data.outputUrl as string;
    const blob = await fetch(outputUrl).then((r) => r.blob());

    // Run QA check on generated image (with retry + backoff)
    const qa = await runQaWithRetry(blob);

    const projectId = data.projectId as string;

    // Determine if QA indicates a problem:
    // - qa is undefined (QA failed to run) → treat as failed
    // - qa.pass is false → explicit fail
    // - qa.severity is "critical" → fail even if pass is somehow true
    const qaFailed = !qa || !qa.pass || qa.severity === "critical";

    if (qaFailed && projectId) {
      const qaForStatus = qa ?? {
        pass: false,
        issues: ["QA ellenőrzés sikertelen — nem futott le"],
        severity: "critical" as const,
        summary: "QA nem futott le, manuális ellenőrzés szükséges.",
      };
      onStatusUpdate?.({ status: "fixing" as const, qa: qaForStatus });

      const fixed = await attemptAutoFix(projectId, blob, qaForStatus);
      if (fixed) {
        // Check if the fix actually resolved the issues
        const fixedQaOk = fixed.qa && fixed.qa.pass && fixed.qa.severity !== "critical";
        return {
          status: fixedQaOk ? "completed" : "failed",
          projectId,
          outputUrl: fixed.outputUrl,
          outputBlob: fixed.outputBlob,
          error: fixedQaOk ? undefined : "Automatikus javítás után is maradtak kritikus QA hibák",
          qa: fixed.qa,
          saved: false,
          _autoFixed: true,
        };
      }
      // Auto-fix failed entirely — mark as failed
      return {
        status: "failed",
        projectId,
        outputUrl,
        outputBlob: blob,
        error: "QA hibát talált és az automatikus javítás sikertelen",
        qa: qaForStatus,
        saved: false,
        _autoFixed: true,
      };
    }

    return {
      status: "completed",
      projectId,
      outputUrl,
      outputBlob: blob,
      qa,
      saved: false,
    };
  }, []);

  const handleBatchGenerate = useCallback(async () => {
    if (products.length === 0) return;
    abortRef.current = false;
    setBatchStatus("processing");
    setSelectedProductId(null);

    setProducts((prev) => prev.map((p) => ({
      ...p, status: "pending" as const, error: undefined,
      outputUrl: undefined, outputBlob: undefined, projectId: undefined,
    })));

    for (let i = 0; i < products.length; i++) {
      if (abortRef.current) break;
      setCurrentIndex(i);

      setProducts((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "processing" as const } : p));

      let didAutoFix = false;
      try {
        const updates = await processProduct(products[i], (statusUpdates) => {
          setProducts((prev) => prev.map((p, idx) => idx === i ? { ...p, ...statusUpdates } : p));
        });
        didAutoFix = !!(updates as Record<string, unknown>)._autoFixed;
        setProducts((prev) => prev.map((p, idx) => idx === i ? { ...p, ...updates } : p));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ismeretlen hiba";
        setProducts((prev) => prev.map((p, idx) => idx === i ? { ...p, status: "failed" as const, error: msg } : p));
      }

      // Adaptive cooldown: longer pause after auto-fix (consumed extra API calls)
      if (i < products.length - 1 && !abortRef.current) {
        const cooldown = didAutoFix ? 6_000 : 2_000;
        await new Promise((r) => setTimeout(r, cooldown));
      }
    }

    setBatchStatus("done");
    toast.success("Köteges feldolgozás befejeződött!");
  }, [products, processProduct]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
    toast("Feldolgozás leállítva. A folyamatban lévő kép még befejezződik.");
  }, []);

  const handleDownloadZip = useCallback(async () => {
    const completed = products.filter((p) => p.status === "completed" && p.outputBlob);
    if (completed.length === 0) {
      toast.error("Nincs letölthető eredmény.");
      return;
    }
    toast("ZIP létrehozása...");
    const zip = new JSZip();
    for (const product of completed) {
      const ext = product.outputBlob!.type.includes("png") ? "png" : "jpg";
      zip.file(`${product.relativePath}/${product.folderName}.${ext}`, product.outputBlob!);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ghost_batch_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [products]);

  const handleClear = useCallback(() => {
    setProducts([]);
    setBatchStatus("idle");
    setCurrentIndex(0);
    setSelectedProductId(null);
  }, []);

  const completedCount = products.filter((p) => p.status === "completed").length;
  const failedCount = products.filter((p) => p.status === "failed").length;
  const pendingCount = products.filter((p) => p.status === "pending").length;
  const isProcessing = batchStatus === "processing";

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Left: Folder upload + product list ───────────────────────────────── */}
      <div className="w-72 shrink-0 border-r border-gray-100 bg-white flex flex-col h-full">
        <div className="px-4 pt-5 pb-3 border-b border-gray-50">
          <h2 className="text-base font-bold text-gray-900">Mappa feltöltés</h2>
          <p className="text-sm text-gray-400 mt-1 leading-relaxed">
            Válassz egy mappát, amiben az almappák tartalmazzák a képeket.
          </p>
        </div>

        <div className="px-4 py-3">
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={isProcessing}
            className={cn(
              "w-full rounded-xl border-2 border-dashed p-4 flex items-center gap-3 transition-all",
              isProcessing
                ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                : "border-gray-200 hover:border-gray-400 hover:bg-gray-50 cursor-pointer"
            )}
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5 text-gray-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-600">
                {products.length > 0 ? "Másik mappa" : "Mappa kiválasztása"}
              </p>
              <p className="text-[11px] text-gray-400">Almappák = termékek</p>
            </div>
          </button>
          <input
            ref={folderInputRef}
            type="file"
            /* @ts-expect-error webkitdirectory is non-standard */
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFolderSelect}
            disabled={isProcessing}
          />
        </div>

        {/* Product list */}
        {products.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-1.5">
            {products.map((product, idx) => (
              <ProductCard
                key={product.id}
                product={product}
                index={idx}
                isSelected={selectedProductId === product.id}
                onClick={() => setSelectedProductId(product.id)}
              />
            ))}
          </div>
        )}

        {/* Folder structure hint (only when empty) */}
        {products.length === 0 && (
          <div className="px-4 pb-4">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Elvárt mappastruktúra:</p>
              <pre className="text-[11px] text-gray-500 leading-relaxed font-mono">
{`Főmappa/
  Termék1/
    front.jpg
    back.jpg
    side.jpg (opcionális)
  Termék2/
    elol.png
    hatul.png
  ...`}
              </pre>
              <p className="text-[11px] text-gray-400">
                Fájlnév alapján azonosítjuk: front/elöl, back/hátul, side/oldal. Ha nem felismerhető, ABC sorrend: 1.=front, 2.=back, 3.=side.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        {products.length > 0 && (
          <div className="px-4 pb-3 border-t border-gray-50 pt-3 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-50 p-2 text-center">
                <p className="text-lg font-bold text-gray-900">{products.length}</p>
                <p className="text-[11px] text-gray-400">Összes</p>
              </div>
              <div className="rounded-lg bg-green-50 p-2 text-center">
                <p className="text-lg font-bold text-green-600">{completedCount}</p>
                <p className="text-[11px] text-gray-400">Kész</p>
              </div>
              {failedCount > 0 && (
                <div className="rounded-lg bg-red-50 p-2 text-center">
                  <p className="text-lg font-bold text-red-500">{failedCount}</p>
                  <p className="text-[11px] text-gray-400">Hiba</p>
                </div>
              )}
              {isProcessing && (
                <div className="rounded-lg bg-amber-50 p-2 text-center">
                  <p className="text-lg font-bold text-amber-500">{pendingCount}</p>
                  <p className="text-[11px] text-gray-400">Hátralévő</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Center: Detail view or overview ──────────────────────────────────── */}
      <div className="flex-1 min-w-0 bg-gray-50/50 flex flex-col h-full overflow-hidden">
        {selectedProduct ? (
          <ProductDetailView
            product={selectedProduct}
            onBack={() => setSelectedProductId(null)}
            onProductUpdated={updateProduct}
          />
        ) : (
          <>
            <div className="px-5 pt-5 pb-3 border-b border-gray-100 bg-white shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Előnézet</h2>
                {products.length > 0 && (
                  <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {products.length} db
                  </span>
                )}
                {isProcessing && (
                  <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full animate-pulse">
                    {currentIndex + 1} / {products.length}
                  </span>
                )}
                {batchStatus === "done" && (
                  <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Befejezve
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-500">Nincs feltöltött mappa</p>
                    <p className="text-sm text-gray-400 mt-1 max-w-[260px] leading-relaxed">
                      Válassz ki egy mappát a bal oldali panelből a köteges feldolgozás indításához.
                    </p>
                  </div>
                </div>
              ) : completedCount > 0 ? (
                /* Thumbnail grid of completed results */
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {products.filter((p) => p.status === "completed" && p.outputUrl).map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedProductId(product.id)}
                      className="group rounded-xl overflow-hidden border border-gray-200 bg-white hover:border-gray-400 hover:shadow-md transition-all text-left"
                    >
                      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.outputUrl} alt={product.folderName}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200" />
                      </div>
                      <div className="px-3 py-2 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 truncate">{product.folderName}</p>
                        <p className="text-[11px] text-green-600 font-medium">Kész — kattints a részletekért</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Wand2 className="w-8 h-8 text-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-500">
                      {isProcessing ? "Feldolgozás folyamatban..." : "Indítsd el a generálást"}
                    </p>
                    <p className="text-sm text-gray-400 mt-1 max-w-[260px] leading-relaxed">
                      {isProcessing
                        ? "Kattints egy termékre a bal oldali listában a részletek megtekintéséhez."
                        : 'Kattints az "Összes generálás" gombra a jobb oldalon.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {products.length > 0 && (isProcessing || batchStatus === "done") && (
              <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3">
                <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      failedCount > 0 && completedCount === 0 ? "bg-red-400" :
                      batchStatus === "done" ? "bg-green-500" : "bg-gray-900"
                    )}
                    style={{ width: `${((completedCount + failedCount) / products.length) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5 text-center">
                  {completedCount + failedCount} / {products.length} feldolgozva
                  {failedCount > 0 && ` (${failedCount} hiba)`}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right: Actions panel ─────────────────────────────────────────────── */}
      <div className="w-64 shrink-0 bg-white flex flex-col h-full">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Műveletek</h2>
          <p className="text-sm text-gray-400 mt-0.5">Köteges feldolgozás vezérlés</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Hogyan működik?</p>
            <ol className="text-[11px] text-gray-500 leading-relaxed space-y-1.5 list-decimal list-inside">
              <li>Válassz ki egy mappát almappákkal</li>
              <li>Minden almappa = 1 termék (front + back kép)</li>
              <li>Kattints az &quot;Összes generálás&quot; gombra</li>
              <li>Az AI egyenként feldolgozza őket</li>
              <li>Kattints egy termékre az eredmény megtekintéséhez</li>
              <li>Finomíts: jelölj területet, adj megjegyzést</li>
              <li>Töltsd le az eredményeket ZIP-ben</li>
            </ol>
          </div>

          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3.5 space-y-1.5">
            <p className="text-xs font-semibold text-blue-700">Fájlelnevezési tippek</p>
            <p className="text-[11px] text-blue-600 leading-relaxed">
              Használd a következő neveket: <strong>front</strong>, <strong>back</strong>, <strong>side</strong> (vagy magyarul: <strong>elöl</strong>, <strong>hátul</strong>, <strong>oldal</strong>).
            </p>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-3 shrink-0">
          {batchStatus === "done" && completedCount > 0 && (
            <Button
              onClick={handleDownloadZip}
              className="w-full gap-2 h-10 text-sm bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              <Download className="w-4 h-4" />
              ZIP letöltés ({completedCount} kép)
            </Button>
          )}

          {isProcessing && (
            <Button
              onClick={handleStop}
              variant="outline"
              className="w-full gap-2 h-10 text-sm border-red-200 text-red-600 hover:bg-red-50 font-semibold"
            >
              <XCircle className="w-4 h-4" />
              Leállítás
            </Button>
          )}

          {products.length > 0 && !isProcessing && (
            <Button
              onClick={handleClear}
              variant="outline"
              className="w-full gap-2 h-10 text-sm border-gray-200 text-gray-700 font-semibold"
            >
              <Trash2 className="w-4 h-4" />
              Lista törlése
            </Button>
          )}

          <Button
            onClick={handleBatchGenerate}
            disabled={products.length === 0 || isProcessing}
            className={cn(
              "w-full h-12 gap-2 font-bold text-sm transition-all duration-200",
              products.length > 0 && !isProcessing
                ? "bg-gray-900 text-white hover:bg-gray-700 shadow-sm"
                : isProcessing
                ? "bg-gray-900 text-white opacity-80"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {isProcessing ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Feldolgozás...</>
            ) : (
              <><Wand2 className="w-4 h-4" />Összes generálás</>
            )}
          </Button>

          {products.length === 0 && (
            <p className="text-xs text-center text-gray-400">Először tölts fel egy mappát</p>
          )}
        </div>
      </div>
    </div>
  );
}
