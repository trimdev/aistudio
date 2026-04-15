"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Upload, X, ImageIcon, Loader2, Download, RotateCcw, Wand2, Users, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FURNITURE_SCENES, type FurnitureScene } from "@/lib/furniture-scenes";

type Step = "idle" | "uploading" | "compositing" | "rendering" | "finalizing" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle:        "",
  uploading:   "Képek feltöltése...",
  compositing: "Bútor elhelyezése...",
  rendering:   "Életkép renderelése...",
  finalizing:  "Véglegesítés...",
  done:        "Kész!",
  error:       "Hiba",
};

const STEP_SCHEDULE: Array<[Step, number]> = [
  ["uploading",   0],
  ["compositing", 3_000],
  ["rendering",   12_000],
  ["finalizing",  26_000],
];

interface Props {
  collectionId?: string | null;
  ghostProjectId?: string | null;
}

function SceneCard({ scene, selected, onClick }: { scene: FurnitureScene; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all text-xs font-semibold leading-tight
        ${selected
          ? "border-amber-400 bg-amber-50 text-amber-800"
          : "border-gray-100 bg-white text-gray-600 hover:border-amber-200 hover:bg-amber-50/40"
        }`}
    >
      {scene.label}
    </button>
  );
}

async function compressImage(file: File, maxMB = 1.5, maxPx = 1920): Promise<File> {
  return new Promise((resolve) => {
    if (file.size <= maxMB * 1024 * 1024) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxPx || h > maxPx) { const r = Math.min(maxPx / w, maxPx / h); w = Math.round(w * r); h = Math.round(h * r); }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      let quality = 0.85;
      const attempt = () => canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        if (blob.size > maxMB * 1024 * 1024 && quality > 0.45) { quality = Math.round((quality - 0.1) * 10) / 10; attempt(); }
        else resolve(new File([blob], file.name, { type: "image/jpeg" }));
      }, "image/jpeg", quality);
      attempt();
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

export function FurnitureLifestyleTool({ collectionId, ghostProjectId }: Props) {
  const [selectedScene, setSelectedScene] = useState<string>("living_modern");
  const [withPeople, setWithPeople]       = useState(false);
  const [projectName, setProjectName]     = useState("");
  const [step, setStep]                   = useState<Step>("idle");
  const [outputUrl, setOutputUrl]         = useState<string | null>(null);
  const [projectId, setProjectId]         = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  // Fresh upload fallback (when no ghostProjectId)
  const [frontFile, setFrontFile]         = useState<File | null>(null);
  const [frontPreview, setFrontPreview]   = useState<string | null>(null);
  const frontRef = useRef<HTMLInputElement>(null);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    timers.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFrontFile = useCallback((file: File | null) => {
    setFrontFile(file);
    setFrontPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return file ? URL.createObjectURL(file) : null; });
  }, []);

  const isLoading = step !== "idle" && step !== "done" && step !== "error";

  const handleGenerate = useCallback(async () => {
    if (!ghostProjectId && !frontFile) {
      toast.error("Töltsd fel a bútor fotóját, vagy válassz egy meglévő projektet.");
      return;
    }
    setError(null); setOutputUrl(null);
    timers.current.forEach(clearTimeout); timers.current = [];
    STEP_SCHEDULE.forEach(([s, delay]) => { const id = setTimeout(() => setStep(s), delay); timers.current.push(id); });

    const scene    = FURNITURE_SCENES.find((s) => s.key === selectedScene) ?? FURNITURE_SCENES[0];
    const name     = projectName.trim() || `${scene.label} életkép ${new Date().toLocaleDateString("hu-HU", { month: "long", day: "numeric" })}`;

    const fd = new FormData();
    fd.append("sceneKey", selectedScene);
    fd.append("withPeople", String(withPeople));
    fd.append("projectName", name);
    if (collectionId) fd.append("collectionId", collectionId);

    if (ghostProjectId) {
      fd.append("ghostProjectId", ghostProjectId);
    } else {
      const compressed = await compressImage(frontFile!);
      fd.append("front", compressed, "front.jpg");
    }

    try {
      const res  = await fetch("/api/furniture-lifestyle", { method: "POST", body: fd });
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { throw new Error(`Server error ${res.status}: response was not JSON`); }
      if (!res.ok) throw new Error((data.error as string) || `Server error ${res.status}`);

      timers.current.forEach(clearTimeout);
      setStep("done");
      setOutputUrl(data.outputUrl as string);
      setProjectId(data.projectId as string);
      toast.success("Életkép elkészült!");
    } catch (err: unknown) {
      timers.current.forEach(clearTimeout);
      setStep("error");
      const msg = err instanceof Error ? err.message : "Generálás sikertelen";
      setError(msg); toast.error(msg);
    }
  }, [ghostProjectId, frontFile, selectedScene, withPeople, projectName, collectionId]);

  return (
    <div className="flex h-full min-h-0">
      {/* ── Scene selector panel ── */}
      <div className="w-52 shrink-0 border-r border-gray-100 bg-white flex flex-col">
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Helyszín</p>
          <p className="text-[11px] text-gray-400 mt-1">Válassz környezetet</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {FURNITURE_SCENES.map((scene) => (
            <SceneCard
              key={scene.key}
              scene={scene}
              selected={selectedScene === scene.key}
              onClick={() => setSelectedScene(scene.key)}
            />
          ))}
        </div>
      </div>

      {/* ── Preview panel ── */}
      <div className="flex-1 min-w-0 bg-gray-50 flex flex-col items-center justify-center p-8">
        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-sm font-semibold text-gray-700">{STEP_LABELS[step]}</p>
            <p className="text-xs text-gray-400">Gemini 2.5 Flash dolgozik...</p>
          </div>
        )}
        {step === "done" && outputUrl && (
          <div className="flex flex-col items-center gap-4 w-full max-w-lg">
            <div className="w-full rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={outputUrl} alt="Generált életkép" className="w-full object-contain max-h-[60vh]" />
            </div>
            <div className="flex gap-2">
              <a href={outputUrl} download={`furniture-lifestyle-${projectId}.jpg`} target="_blank" rel="noreferrer">
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
            <p className="text-sm font-semibold text-gray-500">Válassz helyszínt és generálj</p>
            <p className="text-xs text-gray-400 max-w-xs">Válaszd ki a kívánt helyszínt a bal oldalon, majd kattints a Generálás gombra.</p>
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
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">

          {/* Reference image — only shown when no ghost project linked */}
          {!ghostProjectId && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Bútor fotója <span className="text-[10px] text-red-400 font-bold">*</span>
              </label>
              <div
                onClick={() => !isLoading && frontRef.current?.click()}
                className={`relative aspect-video rounded-xl border-2 overflow-hidden cursor-pointer transition-all
                  ${frontFile ? "border-amber-300 bg-amber-50" : "border-dashed border-gray-200 bg-gray-50 hover:border-amber-300 hover:bg-amber-50/30"}
                  ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {frontPreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={frontPreview} alt="Bútor" className="w-full h-full object-contain" />
                    {!isLoading && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFrontFile(null); }}
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
                ref={frontRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                disabled={isLoading}
                onChange={(e) => { const f = e.target.files?.[0]; handleFrontFile(f ?? null); e.target.value = ""; }}
              />
            </div>
          )}

          {ghostProjectId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-800 mb-0.5">Forrás projekt</p>
              <p className="text-[11px] text-amber-600 font-mono truncate">{ghostProjectId.slice(0, 16)}…</p>
            </div>
          )}

          {/* People toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Emberek</label>
            <div className="flex gap-2">
              <button
                onClick={() => setWithPeople(false)}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold border-2 transition-all
                  ${!withPeople ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
              >
                <UserX className="w-3.5 h-3.5" /> Nélkül
              </button>
              <button
                onClick={() => setWithPeople(true)}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold border-2 transition-all
                  ${withPeople ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
              >
                <Users className="w-3.5 h-3.5" /> Emberekkel
              </button>
            </div>
          </div>

          {/* Project name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Projekt neve</label>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isLoading}
              placeholder="pl. VIP Kanapé — modern nappali"
              className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
            />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 mb-3">
              Az AI a bútort fotórealisztikusan a kiválasztott helyszínen jeleníti meg.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isLoading || (!ghostProjectId && !frontFile)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2 disabled:opacity-50"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generálás...</>
                : <><Wand2 className="w-4 h-4" /> Életkép generálása</>
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
