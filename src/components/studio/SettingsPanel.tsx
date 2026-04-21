"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Wand2, RotateCcw, ChevronDown, Loader2, Cpu, ExternalLink, Sparkles, Brain, X, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { GenerationResult, GenerationStep, UploadedImages } from "@/types";

interface SettingsPanelProps {
  images: UploadedImages;
  step: GenerationStep;
  result: GenerationResult | null;
  projectName: string;
  refinePrompt: string;
  collectionId?: string | null;
  onProjectNameChange: (v: string) => void;
  onRefinePromptChange: (v: string) => void;
  onGenerate: () => void;
  onRegenerate: () => void;
}

export function SettingsPanel({
  images, step, result, projectName, refinePrompt, collectionId,
  onProjectNameChange, onRefinePromptChange, onGenerate, onRegenerate,
}: SettingsPanelProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [showRefine, setShowRefine] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [memories, setMemories] = useState<{ id: string; note: string }[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  useEffect(() => {
    fetch("/api/workspace-memory")
      .then((r) => r.json())
      .then((d) => { if (d.memories) setMemories(d.memories); })
      .catch(() => {});
  }, []);

  const addMemory = async () => {
    const note = newMemory.trim();
    if (!note || isSavingMemory) return;
    setIsSavingMemory(true);
    try {
      const res = await fetch("/api/workspace-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (res.ok && data.memory) {
        setMemories((prev) => [data.memory, ...prev]);
        setNewMemory("");
      }
    } catch { /* non-critical */ } finally {
      setIsSavingMemory(false);
    }
  };

  const removeMemory = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await fetch("/api/workspace-memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  };

  const handleProceedToModel = () => {
    const params = collectionId ? `?collectionId=${collectionId}` : "";
    router.push(`/studio/new/design-model${params}`);
  };

  const isLoading = step !== "idle" && step !== "done" && step !== "error";
  const isDone = step === "done" && result !== null;
  const canGenerate = !!images.front && !!images.back && !isLoading;

  return (
    <div className="w-72 shrink-0 bg-white flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">{t("set_title")}</h2>
        <p className="text-sm text-gray-400 mt-0.5">{t("set_subtitle")}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Project name */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-gray-700">{t("set_project")}</Label>
          <Input value={projectName} onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder={t("set_project_ph")} disabled={isLoading}
            className="text-sm border-gray-200 focus:border-gray-400 h-10" />
        </div>

        {/* Model info */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="text-sm font-semibold text-gray-700">{t("set_model")}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">Ghost Mannequin AI</p>
          <p className="text-xs text-gray-500 leading-relaxed">{t("set_model_desc")}</p>
        </div>

        {/* Refine prompt */}
        <div>
          <button type="button" onClick={() => setShowRefine(!showRefine)}
            className="flex items-center justify-between w-full">
            <span className="text-sm font-semibold text-gray-700">{t("set_refine")}</span>
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", showRefine && "rotate-180")} />
          </button>
          {showRefine && (
            <div className="mt-2.5 space-y-1.5">
              <Textarea value={refinePrompt} onChange={(e) => onRefinePromptChange(e.target.value)}
                placeholder={t("set_refine_ph")} disabled={isLoading}
                className="text-sm border-gray-200 resize-none h-20 leading-relaxed" />
              <p className="text-xs text-gray-400">{t("set_refine_note")}</p>
            </div>
          )}
        </div>

        {/* Workspace Memory */}
        <div>
          <button type="button" onClick={() => setShowMemory(!showMemory)}
            className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">{t("wsmem_title")}</span>
              {memories.length > 0 && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5">
                  {memories.length}
                </span>
              )}
            </div>
            <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", showMemory && "rotate-180")} />
          </button>
          {showMemory && (
            <div className="mt-2.5 space-y-2">
              <p className="text-[11px] text-gray-400 leading-relaxed">{t("wsmem_subtitle")}</p>
              {memories.length === 0 && (
                <p className="text-xs text-gray-400 italic">{t("wsmem_empty")}</p>
              )}
              {memories.map((m) => (
                <div key={m.id} className="group flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <p className="flex-1 text-xs text-blue-800 leading-relaxed">{m.note}</p>
                  <button
                    onClick={() => removeMemory(m.id)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-blue-300 hover:text-red-400 transition-all mt-0.5"
                    aria-label="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  placeholder={t("wsmem_add_ph")}
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  onKeyDown={(e) => { if (e.key === "Enter") addMemory(); }}
                />
                <button
                  onClick={addMemory}
                  disabled={!newMemory.trim() || isSavingMemory}
                  className="shrink-0 p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Checklist */}
        <div className="space-y-2.5">
          <span className="text-sm font-semibold text-gray-700 block">{t("set_checklist")}</span>
          {([
            { key: "front" as const, label: t("set_front"), required: true },
            { key: "back" as const, label: t("set_back"), required: true },
            { key: "side" as const, label: t("set_side"), required: false },
          ]).map(({ key, label, required }) => (
            <div key={key} className="flex items-center gap-3">
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                images[key] ? "border-gray-900 bg-gray-900" : required ? "border-gray-300" : "border-gray-200"
              )}>
                {images[key] && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 10 10" fill="none">
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
        {isDone && result && (
          <a
            href={collectionId ? `/studio/projects/${collectionId}` : `/studio/projects`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t("set_view_projects")}
          </a>
        )}

        {isDone && result && (
          <Button onClick={handleProceedToModel}
            className="w-full gap-2 h-10 text-sm bg-violet-600 hover:bg-violet-700 text-white font-semibold">
            <Sparkles className="w-4 h-4" />
            {t("mod_proceed")}
          </Button>
        )}

        {isDone && (
          <Button variant="outline" className="w-full gap-2 h-10 text-sm border-gray-200 text-gray-700"
            onClick={onRegenerate}>
            <RotateCcw className="w-4 h-4" />
            {t("set_regenerate")}
          </Button>
        )}

        <Separator className="bg-gray-100" />

        <Button onClick={onGenerate} disabled={!canGenerate}
          className={cn(
            "w-full h-12 gap-2 font-bold text-sm transition-all duration-200",
            canGenerate && !isLoading ? "bg-gray-900 text-white hover:bg-gray-700 shadow-sm"
              : isLoading ? "bg-gray-900 text-white opacity-80"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}>
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{t("set_generating")}</>
          ) : (
            <><Wand2 className="w-4 h-4" />{t("set_generate")}</>
          )}
        </Button>

        {!canGenerate && !isLoading && (
          <p className="text-xs text-center text-gray-400">{t("set_need_photos")}</p>
        )}
      </div>
    </div>
  );
}
