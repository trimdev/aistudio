import { getEffectiveWorkspace } from "@/lib/workspace";
import Link from "next/link";
import { Ghost, User, ArrowRight, Check, Sofa, Home, Palette, Film } from "lucide-react";
import type { WorkspaceModule } from "@/types";

const GHOST_FEATURES = [
  "Invisible mannequin effect",
  "Front + back composite",
  "White studio background",
  "Preserves all garment details",
];
const MODEL_FEATURES = [
  "4–8 individual photos per variant",
  "Blonde or brunette — your choice",
  "Photoshoot & lifestyle scenes",
  "Per-photo download",
];

export default async function NewGenerationPage() {
  let enabledModules: WorkspaceModule[] = [];
  try {
    const workspace = await getEffectiveWorkspace();
    enabledModules = (workspace.modules ?? []) as WorkspaceModule[];
  } catch {
    // unauthenticated — middleware handles redirect, show nothing
    enabledModules = [];
  }

  const hasFashion     = enabledModules.includes("fashion");
  const hasGhost       = enabledModules.includes("ghost");
  const hasModel       = enabledModules.includes("model");
  const hasFurniture   = enabledModules.includes("furniture");
  const hasDesignModel = enabledModules.includes("design-model");
  const hasVideo       = enabledModules.includes("video");
  const hasAny         = hasFashion || hasFurniture;

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Új generálás</p>
          <h1 className="text-3xl font-bold text-gray-950 tracking-tight">Válassz generálás típust</h1>
        </div>

        {!hasAny && (
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <p className="font-semibold text-gray-700 mb-1">Nincs elérhető eszköz</p>
            <p className="text-sm text-gray-500">Kérjük lépj kapcsolatba az adminisztrátorral a hozzáféréshez.</p>
          </div>
        )}

        {hasAny && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
            {/* Ghost card */}
            {hasFashion && hasGhost && (
              <Link href="/studio/new/ghost" className="group">
                <div className="relative h-full flex flex-col bg-white rounded-2xl border border-gray-200 p-7 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-gray-700 via-gray-500 to-gray-400" />
                  <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mb-5">
                    <Ghost className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-950 mb-2">Ghost Mannequin</h2>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6">
                    Remove the mannequin and create invisible mannequin product shots from 2–3 garment photos.
                  </p>
                  <ul className="space-y-2 mb-8 flex-1">
                    {GHOST_FEATURES.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                        <span className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-gray-600" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-900 group-hover:gap-3 transition-all">
                    Kezdés
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )}

            {/* Model card */}
            {hasFashion && hasModel && (
              <Link href="/studio/new/model" className="group">
                <div className="relative h-full flex flex-col bg-white rounded-2xl border border-violet-200 p-7 shadow-sm hover:shadow-lg hover:border-violet-300 transition-all duration-200">
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-violet-500 via-pink-400 to-amber-300" />
                  <div className="absolute top-5 right-5 flex gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Blonde</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">Brunette</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center mb-5">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-950 mb-2">Model Photos</h2>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6">
                    Generate individual fashion photos with a consistent model in your chosen poses and scenes.
                  </p>
                  <ul className="space-y-2 mb-8 flex-1">
                    {MODEL_FEATURES.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                        <span className="w-4 h-4 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-violet-600" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 text-sm font-bold text-violet-700 group-hover:gap-3 transition-all">
                    Kezdés
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )}

            {/* Design Model card */}
            {hasFashion && hasDesignModel && (
              <Link href="/studio/new/design-model" className="group">
                <div className="relative h-full flex flex-col bg-white rounded-2xl border border-rose-200 p-7 shadow-sm hover:shadow-lg hover:border-rose-300 transition-all duration-200">
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-rose-500 via-pink-400 to-fuchsia-300" />
                  <div className="w-12 h-12 rounded-xl bg-rose-500 flex items-center justify-center mb-5">
                    <Palette className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-950 mb-2">Design Modell Fotó</h2>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6">
                    Generate editorial fashion photos with Slavic and French AI models — choose your model, background, and pose.
                  </p>
                  <ul className="space-y-2 mb-8 flex-1">
                    {[
                      "10 distinct Slavic & French AI models",
                      "Variable backgrounds & poses",
                      "Mix models in one generation",
                      "Full editorial quality output",
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                        <span className="w-4 h-4 rounded-full bg-pink-50 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-pink-500" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 text-sm font-bold text-rose-700 group-hover:gap-3 transition-all">
                    Kezdés
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )}

            {/* Video Generation card */}
            {hasFashion && hasVideo && (
              <Link href="/studio/new/video" className="group">
                <div className="relative h-full flex flex-col bg-white rounded-2xl border border-indigo-200 p-7 shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all duration-200">
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400" />
                  <div className="absolute top-5 right-5 flex gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">NEW</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-5">
                    <Film className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-950 mb-2">Fashion Videó</h2>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6">
                    Generate AI-powered fashion videos with motion styles, camera angles, music, and branding overlays.
                  </p>
                  <ul className="space-y-2 mb-8 flex-1">
                    {[
                      "10 motion styles + 6 quick templates",
                      "8 camera angles & custom timing",
                      "AI model & background selection",
                      "Music mood & branding overlay",
                      "All social media formats (9:16, 16:9, 1:1, 4:5)",
                    ].map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                        <span className="w-4 h-4 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-indigo-600" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 text-sm font-bold text-indigo-700 group-hover:gap-3 transition-all">
                    Kezdés
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )}

            {/* Furniture Ghost card */}
            {hasFurniture && (
              <Link href="/studio/furniture/ghost" className="group">
                <div className="relative h-full flex flex-col bg-white rounded-2xl border border-amber-200 p-7 shadow-sm hover:shadow-lg hover:border-amber-300 transition-all duration-200">
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300" />
                  <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center mb-5">
                    <Sofa className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-950 mb-2">Bútor Termékkép</h2>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6">
                    Generate a clean white-background studio product shot of any furniture piece.
                  </p>
                  <ul className="space-y-2 mb-8 flex-1">
                    {["Pure white studio background", "Exact colour & material fidelity", "3/4 front angle", "E-commerce ready"].map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                        <span className="w-4 h-4 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-amber-600" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-700 group-hover:gap-3 transition-all">
                    Kezdés
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )}

            {/* Furniture Lifestyle card */}
            {hasFurniture && (
              <Link href="/studio/furniture/lifestyle" className="group">
                <div className="relative h-full flex flex-col bg-white rounded-2xl border border-orange-200 p-7 shadow-sm hover:shadow-lg hover:border-orange-300 transition-all duration-200">
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300" />
                  <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center mb-5">
                    <Home className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-950 mb-2">Bútor Életkép</h2>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6">
                    Place furniture in photorealistic lifestyle settings — living rooms, terraces, cafés and more.
                  </p>
                  <ul className="space-y-2 mb-8 flex-1">
                    {["12 scene types", "Indoor & outdoor", "With or without people", "Photorealistic CGI quality"].map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                        <span className="w-4 h-4 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-orange-500" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 text-sm font-bold text-orange-700 group-hover:gap-3 transition-all">
                    Kezdés
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
