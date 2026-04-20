"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Check, ChevronRight, Upload, Sparkles, X,
  RotateCcw, Zap, ArrowLeft,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Model {
  id: string;
  name: string;
  tag: string;
  bodyType: string;
  skin: string;
  gradient: string;
  highlight: string;
  letter: string;
}

interface Background {
  id: string;
  label: string;
  sub: string;
  gradient: string;
  dot: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const MODELS: Model[] = [
  { id: "m1", name: "Aria",    tag: "Editorial",  bodyType: "Slim",     skin: "Fair",   gradient: "from-rose-900/60 via-stone-800 to-stone-900",   highlight: "border-rose-400",    letter: "A" },
  { id: "m2", name: "Zola",    tag: "Athletic",   bodyType: "Athletic", skin: "Deep",   gradient: "from-amber-900/60 via-stone-800 to-stone-900",   highlight: "border-amber-400",   letter: "Z" },
  { id: "m3", name: "Camille", tag: "Classic",    bodyType: "Curvy",    skin: "Medium", gradient: "from-emerald-900/60 via-stone-800 to-stone-900", highlight: "border-emerald-400", letter: "C" },
  { id: "m4", name: "Soleil",  tag: "Lifestyle",  bodyType: "Petite",   skin: "Warm",   gradient: "from-violet-900/60 via-stone-800 to-stone-900",  highlight: "border-violet-400",  letter: "S" },
  { id: "m5", name: "Nadia",   tag: "Street",     bodyType: "Tall",     skin: "Fair",   gradient: "from-sky-900/60 via-stone-800 to-stone-900",     highlight: "border-sky-400",     letter: "N" },
  { id: "m6", name: "Olamide", tag: "Power",      bodyType: "Plus",     skin: "Deep",   gradient: "from-pink-900/60 via-stone-800 to-stone-900",    highlight: "border-pink-400",    letter: "O" },
  { id: "m7", name: "Mei",     tag: "Minimal",    bodyType: "Slim",     skin: "Light",  gradient: "from-teal-900/60 via-stone-800 to-stone-900",    highlight: "border-teal-400",    letter: "M" },
  { id: "m8", name: "Bianca",  tag: "Editorial",  bodyType: "Athletic", skin: "Medium", gradient: "from-orange-900/60 via-stone-800 to-stone-900",  highlight: "border-orange-400",  letter: "B" },
];

const FILTER_TABS = ["All", "Slim", "Athletic", "Curvy", "Petite", "Plus", "Tall"] as const;
type FilterTab = typeof FILTER_TABS[number];

const ACCESSORIES = [
  "Handbag", "Sunglasses", "Scarf", "Jewelry", "Hat",
  "Shoes", "Belt", "Watch",
];

const BACKGROUNDS: Background[] = [
  { id: "studio",     label: "Studio White",    sub: "Clean & sharp",       gradient: "from-gray-100 to-white",              dot: "bg-gray-300"    },
  { id: "minimal",    label: "Minimal Grey",    sub: "Soft & neutral",      gradient: "from-zinc-300 to-zinc-200",            dot: "bg-zinc-400"    },
  { id: "park",       label: "Park",            sub: "Natural daylight",    gradient: "from-emerald-800 to-green-900",        dot: "bg-emerald-400" },
  { id: "street",     label: "Street",          sub: "Urban edge",          gradient: "from-slate-700 to-slate-900",          dot: "bg-slate-400"   },
  { id: "cafe",       label: "Café",            sub: "Warm & intimate",     gradient: "from-amber-800 to-stone-900",          dot: "bg-amber-400"   },
  { id: "golden",     label: "Golden Hour",     sub: "Magic light",         gradient: "from-orange-600 to-amber-900",         dot: "bg-orange-400"  },
  { id: "beach",      label: "Beach",           sub: "Coastal & fresh",     gradient: "from-cyan-600 to-blue-900",            dot: "bg-cyan-400"    },
  { id: "rooftop",    label: "Rooftop",         sub: "City skyline",        gradient: "from-indigo-700 to-slate-900",         dot: "bg-indigo-400"  },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Select Model", "Add Garment", "Background", "Generate"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className={cn("flex items-center gap-2 px-1")}>
              <motion.div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border transition-colors",
                  done   && "bg-[#c9956a] border-[#c9956a] text-white",
                  active && "bg-transparent border-[#c9956a] text-[#c9956a]",
                  !done && !active && "bg-transparent border-stone-700 text-stone-600"
                )}
                layout
              >
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </motion.div>
              <span className={cn(
                "text-xs font-semibold tracking-wide hidden sm:block",
                active ? "text-[#e8d5c3]" : done ? "text-[#c9956a]" : "text-stone-600"
              )}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "h-px w-8 mx-1 transition-colors",
                i < current ? "bg-[#c9956a]" : "bg-stone-800"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — Model selection ────────────────────────────────────────────────

function StepModel({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<FilterTab>("All");

  const visible = filter === "All"
    ? MODELS
    : MODELS.filter(m => m.bodyType === filter);

  return (
    <div className="flex flex-col gap-6">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
              filter === f
                ? "bg-[#c9956a] border-[#c9956a] text-stone-950"
                : "border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-300"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      <motion.div layout className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AnimatePresence mode="popLayout">
          {visible.map(model => {
            const isSelected = selected === model.id;
            return (
              <motion.button
                key={model.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                onClick={() => onSelect(model.id)}
                className={cn(
                  "relative group rounded-2xl border-2 overflow-hidden text-left transition-all duration-200",
                  isSelected
                    ? `${model.highlight} shadow-lg shadow-black/40`
                    : "border-stone-800 hover:border-stone-600"
                )}
              >
                {/* Avatar area */}
                <div className={cn("relative h-36 bg-gradient-to-b", model.gradient, "flex items-end justify-center pb-3")}>
                  {/* Silhouette circle */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-stone-700/80 flex items-center justify-center">
                    <span className="text-xl font-bold text-stone-300" style={{ fontFamily: "var(--font-playfair), serif" }}>
                      {model.letter}
                    </span>
                  </div>
                  {/* Body silhouette */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-16 rounded-t-full bg-stone-700/60" />

                  {/* Selected badge */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#c9956a] flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-white" />
                    </motion.div>
                  )}

                  {/* Tag */}
                  <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-black/50 text-stone-300 backdrop-blur-sm">
                    {model.tag}
                  </span>
                </div>

                {/* Info */}
                <div className="px-3 py-2.5 bg-stone-900">
                  <p className="text-sm font-bold text-stone-100" style={{ fontFamily: "var(--font-playfair), serif" }}>
                    {model.name}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {model.bodyType} · {model.skin}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Step 2 — Garment upload ──────────────────────────────────────────────────

function StepGarment({
  file, onFile, accessories, onToggleAccessory
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accessories: string[];
  onToggleAccessory: (a: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : null;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) onFile(f);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Upload zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative h-56 rounded-2xl border-2 border-dashed cursor-pointer transition-all group flex items-center justify-center overflow-hidden",
          file ? "border-[#c9956a]/60" : "border-stone-700 hover:border-stone-500"
        )}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="garment" className="h-full w-full object-contain" />
            <button
              onClick={e => { e.stopPropagation(); onFile(null); }}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-stone-900/80 border border-stone-700 flex items-center justify-center hover:bg-red-900/60 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-stone-300" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-stone-800 flex items-center justify-center group-hover:bg-stone-700 transition-colors">
              <Upload className="w-5 h-5 text-[#c9956a]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-300">Drop your garment photo here</p>
              <p className="text-xs text-stone-600 mt-1">Flat lay, ghost mannequin, or existing on-model — PNG, JPG, WebP</p>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => onFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Accessories */}
      <div>
        <p className="text-xs font-bold tracking-widest text-stone-500 uppercase mb-3">
          Accessories <span className="text-stone-700 font-normal normal-case">(optional)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {ACCESSORIES.map(acc => {
            const on = accessories.includes(acc);
            return (
              <button
                key={acc}
                onClick={() => onToggleAccessory(acc)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                  on
                    ? "bg-[#c9956a]/20 border-[#c9956a]/60 text-[#e8c9ab]"
                    : "border-stone-700 text-stone-500 hover:border-stone-600 hover:text-stone-400"
                )}
              >
                {on && <span className="mr-1">✓</span>}{acc}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 — Background ──────────────────────────────────────────────────────

function StepBackground({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {BACKGROUNDS.map(bg => {
        const isSelected = selected === bg.id;
        return (
          <button
            key={bg.id}
            onClick={() => onSelect(bg.id)}
            className={cn(
              "relative group rounded-2xl border-2 overflow-hidden text-left transition-all duration-200",
              isSelected ? "border-[#c9956a] shadow-lg shadow-black/40" : "border-stone-800 hover:border-stone-600"
            )}
          >
            {/* Background swatch */}
            <div className={cn("h-24 bg-gradient-to-b", bg.gradient, "relative flex items-center justify-center")}>
              {/* Dot indicator */}
              <div className={cn("w-8 h-8 rounded-full opacity-60", bg.dot)} />
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#c9956a] flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-white" />
                </motion.div>
              )}
            </div>
            <div className="px-3 py-2 bg-stone-900">
              <p className="text-xs font-bold text-stone-200">{bg.label}</p>
              <p className="text-[10px] text-stone-600 mt-0.5">{bg.sub}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Step 4 — Generate ────────────────────────────────────────────────────────

function StepGenerate({
  model, garment, background, accessories, onReset
}: {
  model: Model | undefined;
  garment: File | null;
  background: Background | undefined;
  accessories: string[];
  onReset: () => void;
}) {
  const [state, setState] = useState<"idle" | "generating" | "done">("idle");
  const [progress, setProgress] = useState(0);

  function handleGenerate() {
    setState("generating");
    setProgress(0);
    const steps = [12, 28, 47, 63, 79, 91, 100];
    let i = 0;
    const tick = () => {
      if (i >= steps.length) { setState("done"); return; }
      setProgress(steps[i++]);
      setTimeout(tick, 600 + Math.random() * 400);
    };
    setTimeout(tick, 300);
  }

  const garmentPreview = garment ? URL.createObjectURL(garment) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Model summary */}
        <div className={cn("rounded-xl border border-stone-800 overflow-hidden")}>
          <div className={cn("h-20 bg-gradient-to-b", model?.gradient ?? "from-stone-800 to-stone-900", "flex items-center justify-center")}>
            <div className="w-10 h-10 rounded-full bg-stone-700/80 flex items-center justify-center">
              <span className="text-lg font-bold text-stone-300" style={{ fontFamily: "var(--font-playfair), serif" }}>
                {model?.letter}
              </span>
            </div>
          </div>
          <div className="p-2.5 bg-stone-900">
            <p className="text-[10px] text-stone-600 uppercase tracking-wider font-bold">Model</p>
            <p className="text-xs font-semibold text-stone-200 mt-0.5">{model?.name}</p>
            <p className="text-[10px] text-stone-500">{model?.bodyType}</p>
          </div>
        </div>

        {/* Garment summary */}
        <div className="rounded-xl border border-stone-800 overflow-hidden">
          <div className="h-20 bg-stone-800 flex items-center justify-center overflow-hidden">
            {garmentPreview
              ? <img src={garmentPreview} alt="garment" className="h-full w-full object-contain" />  // eslint-disable-line @next/next/no-img-element
              : <Upload className="w-6 h-6 text-stone-600" />
            }
          </div>
          <div className="p-2.5 bg-stone-900">
            <p className="text-[10px] text-stone-600 uppercase tracking-wider font-bold">Garment</p>
            <p className="text-xs font-semibold text-stone-200 mt-0.5 truncate">{garment?.name ?? "—"}</p>
            {accessories.length > 0 && (
              <p className="text-[10px] text-stone-500">+{accessories.length} accessories</p>
            )}
          </div>
        </div>

        {/* Background summary */}
        <div className="rounded-xl border border-stone-800 overflow-hidden">
          <div className={cn("h-20 bg-gradient-to-b", background?.gradient ?? "from-stone-800 to-stone-900")} />
          <div className="p-2.5 bg-stone-900">
            <p className="text-[10px] text-stone-600 uppercase tracking-wider font-bold">Background</p>
            <p className="text-xs font-semibold text-stone-200 mt-0.5">{background?.label}</p>
            <p className="text-[10px] text-stone-500">{background?.sub}</p>
          </div>
        </div>
      </div>

      {/* Credit cost note */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-800/60 border border-stone-700/60">
        <Zap className="w-3.5 h-3.5 text-[#c9956a] shrink-0" />
        <p className="text-xs text-stone-400">
          This generation uses <span className="text-[#c9956a] font-semibold">1 credit</span>.
          Your balance: <span className="text-stone-300 font-semibold">47 credits</span>
        </p>
      </div>

      {/* Generate button / progress / result */}
      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.button
            key="btn"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={handleGenerate}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#c9956a] to-[#e8b48a] text-stone-950 font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-[#c9956a]/20"
          >
            <Sparkles className="w-4 h-4" />
            Generate Photo
          </motion.button>
        )}

        {state === "generating" && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-3"
          >
            <div className="h-2 w-full bg-stone-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#c9956a] to-[#e8b48a] rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <p className="text-center text-xs text-stone-500">
              {progress < 30 && "Analyzing garment…"}
              {progress >= 30 && progress < 60 && "Fitting to model…"}
              {progress >= 60 && progress < 90 && "Compositing scene…"}
              {progress >= 90 && progress < 100 && "Finalizing…"}
              {progress === 100 && "Done!"}
              <span className="ml-2 text-stone-600">{progress}%</span>
            </p>
          </motion.div>
        )}

        {state === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-6"
          >
            <div className="w-14 h-14 rounded-full bg-[#c9956a]/20 border border-[#c9956a]/40 flex items-center justify-center">
              <Check className="w-7 h-7 text-[#c9956a]" />
            </div>
            <div className="text-center">
              <p className="font-bold text-stone-100" style={{ fontFamily: "var(--font-playfair), serif" }}>
                Your photo is ready
              </p>
              <p className="text-xs text-stone-500 mt-1">
                This is a concept UI — no real generation occurred
              </p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 rounded-xl bg-[#c9956a] text-stone-950 text-xs font-bold hover:brightness-110 transition-all">
                Download
              </button>
              <button
                onClick={onReset}
                className="px-4 py-2 rounded-xl border border-stone-700 text-stone-400 text-xs font-semibold hover:border-stone-500 hover:text-stone-300 transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" /> New generation
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BotikaModelBuilder() {
  const [step, setStep]             = useState(0);
  const [selectedModel, setModel]   = useState<string | null>(null);
  const [garment, setGarment]       = useState<File | null>(null);
  const [accessories, setAccessories] = useState<string[]>([]);
  const [background, setBackground] = useState<string | null>(null);

  function toggleAccessory(a: string) {
    setAccessories(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  function reset() {
    setStep(0); setModel(null); setGarment(null); setAccessories([]); setBackground(null);
  }

  const canProceed = [
    !!selectedModel,
    true,            // garment optional for demo
    !!background,
  ][step] ?? true;

  const model = MODELS.find(m => m.id === selectedModel);
  const bg    = BACKGROUNDS.find(b => b.id === background);

  const stepContent = [
    <StepModel    key="model"  selected={selectedModel} onSelect={setModel} />,
    <StepGarment  key="garment" file={garment} onFile={setGarment} accessories={accessories} onToggleAccessory={toggleAccessory} />,
    <StepBackground key="bg"  selected={background} onSelect={setBackground} />,
    <StepGenerate key="gen"   model={model} garment={garment} background={bg} accessories={accessories} onReset={reset} />,
  ];

  return (
    <div
      className="min-h-full flex flex-col"
      style={{ background: "linear-gradient(160deg, #0e0c0b 0%, #111010 50%, #0c0e0d 100%)" }}
    >
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-stone-800/80 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-stone-600 uppercase">Concept Draft</p>
          <h1
            className="text-lg font-bold mt-0.5"
            style={{ fontFamily: "var(--font-playfair), serif", color: "#e8d5c3" }}
          >
            Model Photo Builder
          </h1>
        </div>
        <StepBar current={step} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {/* Step label */}
          <div>
            <motion.h2
              key={step}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-base font-semibold"
              style={{ fontFamily: "var(--font-playfair), serif", color: "#e8c9ab" }}
            >
              {["Choose your AI model", "Upload your garment", "Pick a background", "Review & generate"][step]}
            </motion.h2>
            <p className="text-xs text-stone-600 mt-1">
              {[
                "Select from our diverse roster of AI-generated fashion models.",
                "Upload the product you want to put on the model. Add optional accessories.",
                "Choose the environment your model will be photographed in.",
                "Everything looks good? Hit generate to create your photo.",
              ][step]}
            </p>
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
            >
              {stepContent[step]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer nav */}
      {step < 3 && (
        <div className="shrink-0 px-6 py-4 border-t border-stone-800/60 flex items-center justify-between gap-3">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
              canProceed
                ? "bg-[#c9956a] text-stone-950 hover:brightness-110 shadow-md shadow-[#c9956a]/20"
                : "bg-stone-800 text-stone-600 cursor-not-allowed"
            )}
          >
            {step === 2 ? "Review" : "Continue"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
