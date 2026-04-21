"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Upload, X, ImageIcon, Loader2, Download, RotateCcw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image-utils";

type SlotKey = "front" | "angle" | "detail";
type Step = "idle" | "uploading" | "analyzing" | "removing" | "compositing" | "finalizing" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle:        "",
  uploading:   "Képek feltöltése...",
  analyzing:   "Bútor elemzése...",
  removing:    "Háttér eltávolítása...",
  compositing: "Termékkép elkészítése...",
  finalizing:  "Véglegesítés...",
  done:        "Kész!",
  error:       "Hiba",
};

const STEP_SCHEDULE: Array<[Step, number]> = [
  ["uploading",   0],
  ["analyzing",   2_500],
  ["removing",    7_000],
  ["compositing", 16_000],
  ["finalizing",  26_000],
];

interface SlotProps {
  label: string;
  sublabel: string;
  required?: boolean;
  file: File | null;
  preview: string | null;
  disabled: boolean;
  onChange: (f: File | null) => void;
}

function UploadSlot({ label, sublabel, required, file, preview, disabled, onChange }: SlotProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        {required && <span className="text-[10px] text-red-400 font-bold">*</span>}
      </div>
      <p className="text-[11px] text-gray-400 -mt-1">{sublabel}</p>
      <div
        onClick={() => !disabled && ref.current?.click()}
        className={`relative aspect-square rounded-xl border-2 overflow-hidden cursor-pointer transition-all
          ${file ? "border-amber-300 bg-amber-50" : "border-dashed border-gray-200 bg-gray-50 hover:border-amber-300 hover:bg-amber-50/30"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={label} className="w-full h-full object-contain" />
            {!disabled && (
              <button
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
              >
                <X className="w-3 h-3 text-gray-600" />
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Upload className="w-5 h-5 text-gray-300" />
            <span className="text-[10px] text-gray-300 font-medium">Feltöltés</span>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; onChange(f ?? null); e.target.value = ""; }}
      />
    </div>
  );
}

export function FurnitureGhostTool({ collectionId }: { collectionId?: string | null }) {
  const [files, setFiles]     = useState<Record<SlotKey, File | null>>({ front: null, angle: null, detail: null });
  const [previews, setPreviews] = useState<Record<SlotKey, string | null>>({ front: null, angle: null, detail: null });
  const [projectName, setProjectName] = useState("");
  const [step, setStep]       = useState<Step>("idle");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const handleFile = useCallback((key: SlotKey, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
    setPreviews((prev) => {
      if (prev[key]) URL.revokeObjectURL(prev[key]!);
      return { ...prev, [key]: file ? URL.createObjectURL(file) : null };
    });
  }, []);

  useEffect(() => () => {
    Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u));
    timers.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = step !== "idle" && step !== "done" && step !== "error";

  const handleGenerate = useCallback(async () => {
    if (!files.front) { toast.error("Az elölnézeti fotó feltöltése kötelező."); return; }
    setError(null); setOutputUrl(null);
    timers.current.forEach(clearTimeout); timers.current = [];
    STEP_SCHEDULE.forEach(([s, delay]) => { const id = setTimeout(() => setStep(s), delay); timers.current.push(id); });

    const name = projectName.trim() || `Bútor fotó ${new Date().toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}`;

    const [cFront, cAngle, cDetail] = await Promise.all([
      compressImage(files.front),
      files.angle  ? compressImage(files.angle)  : Promise.resolve(null),
      files.detail ? compressImage(files.detail) : Promise.resolve(null),
    ]);

    const fd = new FormData();
    fd.append("front", cFront, "front.jpg");
    if (cAngle)  fd.append("angle",  cAngle,  "angle.jpg");
    if (cDetail) fd.append("detail", cDetail, "detail.jpg");
    fd.append("projectName", name);
    if (collectionId) fd.append("collectionId", collectionId);

    try {
      const res  = await fetch("/api/furniture-ghost", { method: "POST", body: fd });
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { throw new Error(`Server error ${res.status}: response was not JSON`); }
      if (!res.ok) throw new Error((data.error as string) || `Server error ${res.status}`);

      timers.current.forEach(clearTimeout);
      setStep("done");
      setOutputUrl(data.outputUrl as string);
      setProjectId(data.projectId as string);
      toast.success("Termékkép elkészült!");
    } catch (err: unknown) {
      timers.current.forEach(clearTimeout);
      setStep("error");
      const msg = err instanceof Error ? err.message : "Generálás sikertelen";
      setError(msg); toast.error(msg);
    }
  }, [files, projectName, collectionId]);

  return (
    <div className="flex h-full min-h-0">
      {/* ── Upload panel ── */}
      <div className="w-64 shrink-0 border-r border-gray-100 bg-white flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fotók feltöltése</p>
          <p className="text-[11px] text-gray-400 mt-1">JPG · PNG · WebP · max 10 MB</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <UploadSlot key="front" label="Elölnézet" sublabel="Kötelező — fő terméknézet" required
            file={files.front} preview={previews.front} disabled={isLoading} onChange={(f) => handleFile("front", f)} />
          <UploadSlot key="angle" label="Szögnézet" sublabel="Ajánlott — 3/4-es perspektíva"
            file={files.angle} preview={previews.angle} disabled={isLoading} onChange={(f) => handleFile("angle", f)} />
          <UploadSlot key="detail" label="Részlet" sublabel="Opcionális — anyag, varrás"
            file={files.detail} preview={previews.detail} disabled={isLoading} onChange={(f) => handleFile("detail", f)} />
        </div>
      </div>

      {/* ── Preview panel ── */}
      <div className="flex-1 min-w-0 bg-gray-50 flex flex-col items-center justify-center p-8">
        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-sm font-semibold text-gray-700">{STEP_LABELS[step]}</p>
            <p className="text-xs text-gray-400">A Studio AI dolgozik...</p>
          </div>
        )}
        {step === "done" && outputUrl && (
          <div className="flex flex-col items-center gap-4 w-full max-w-lg">
            <div className="w-full rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={outputUrl} alt="Generált termékkép" className="w-full object-contain max-h-[60vh]" />
            </div>
            <div className="flex gap-2">
              <a href={outputUrl} download={`furniture-ghost-${projectId}.jpg`} target="_blank" rel="noreferrer">
                <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white gap-2 h-8 px-4 text-xs font-semibold">
                  <Download className="w-3.5 h-3.5" /> Letöltés
                </Button>
              </a>
              <Button size="sm" variant="outline" className="gap-2 h-8 px-4 text-xs font-semibold"
                onClick={() => { setStep("idle"); setOutputUrl(null); setError(null); }}>
                <RotateCcw className="w-3.5 h-3.5" /> Új generálás
              </Button>
            </div>
          </div>
        )}
        {step === "idle" && !outputUrl && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-amber-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">Töltsd fel a fotókat, majd generálj</p>
            <p className="text-xs text-gray-400 max-w-xs">A bal oldali panelben töltsd fel a bútor fotóit, majd kattints a Generálás gombra.</p>
          </div>
        )}
        {step === "error" && error && (
          <div className="max-w-sm text-center">
            <p className="text-sm font-semibold text-red-600 mb-1">Hiba történt</p>
            <p className="text-xs text-gray-500">{error}</p>
          </div>
        )}
      </div>

      {/* ── Settings panel ── */}
      <div className="w-64 shrink-0 border-l border-gray-100 bg-white flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Beállítások</p>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Projekt neve</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isLoading}
              placeholder="pl. VIP Kanapé szürke"
              className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
            />
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 mb-3">
              Az AI eltávolítja a hátteret és professzionális fehér alapon jeleníti meg a bútort.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !files.front}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2 disabled:opacity-50"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generálás...</>
                : <><Wand2 className="w-4 h-4" /> Termékkép generálása</>
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
