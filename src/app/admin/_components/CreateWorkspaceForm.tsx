"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserPlus, ChevronDown, ChevronUp, Ghost, Sofa, LayoutGrid, Loader2, Check, User, Layers, Palette, Film } from "lucide-react";
import { createWorkspace } from "../actions";

const MODULES = [
  { id: "fashion",      label: "Fashion Studio",      desc: "Parent module — required for all fashion tools", icon: Ghost,      accent: "border-violet-200 bg-violet-50 text-violet-700" },
  { id: "ghost",        label: "Ghost Fotó",          desc: "Single & bulk invisible mannequin",              icon: Layers,     accent: "border-gray-200 bg-gray-50 text-gray-700" },
  { id: "model",        label: "Modell Fotó",         desc: "Single model photo generation",                  icon: User,       accent: "border-violet-100 bg-violet-50 text-violet-600" },
  { id: "moodboard",    label: "Moodboard",           desc: "Visual mood boards",                             icon: LayoutGrid, accent: "border-pink-200 bg-pink-50 text-pink-700" },
  { id: "design-model", label: "Design Modell Fotó", desc: "Slavic & French AI models",                      icon: Palette,    accent: "border-rose-200 bg-rose-50 text-rose-700" },
  { id: "video",        label: "Fashion Videó",       desc: "AI video generation with motion & music",        icon: Film,       accent: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  { id: "furniture",    label: "Furniture Studio",    desc: "Product shots + lifestyle placement",            icon: Sofa,       accent: "border-amber-200 bg-amber-50 text-amber-700" },
] as const;

export function CreateWorkspaceForm() {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [modules, setModules] = useState<string[]>([]);

  function toggleModule(id: string) {
    setModules((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    modules.forEach((m) => fd.append("modules", m));

    const result = await createWorkspace(fd);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(`"${result.name}" munkaterület létrehozva.`);
      (e.target as HTMLFormElement).reset();
      setModules([]);
      setTimeout(() => setOpen(false), 1800);
    }
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => { setOpen((v) => !v); setError(null); setSuccess(null); }}
        className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Új munkaterület létrehozása
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
      </button>

      {open && (
        <Card className="border-gray-100 shadow-none mt-3 p-6 max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Workspace name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Munkaterület neve</label>
              <input
                name="name"
                required
                placeholder="pl. VIP Kanapé"
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">E-mail cím</label>
              <input
                name="email"
                type="email"
                required
                placeholder="ugyfel@example.com"
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Jelszó</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="min. 8 karakter"
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>

            {/* Modules */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Modulok</label>
              <div className="flex flex-col gap-2">
                {MODULES.map(({ id, label, desc, icon: Icon, accent }) => {
                  const active = modules.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleModule(id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${active ? accent + " border-opacity-100" : "border-gray-100 bg-gray-50 opacity-50"}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-white/60" : "bg-gray-100"}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{label}</p>
                        <p className="text-[11px] opacity-70">{desc}</p>
                      </div>
                      {active && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {error   && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">{success}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {loading ? "Létrehozás..." : "Munkaterület létrehozása"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
