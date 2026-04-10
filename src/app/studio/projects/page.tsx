"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Clock, ImageIcon, Ghost, Sofa, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProjectCollectionWithMeta } from "@/types";

function formatHuDate(d: string) {
  const date = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}. ${pad(date.getMonth() + 1)}. ${pad(date.getDate())}.`;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<ProjectCollectionWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => setCollections(d.collections ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.ok && data.collection) {
        router.push(`/studio/projects/${data.collection.id}`);
      }
    } catch { /* silent */ } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projektek</h1>
          <p className="text-sm text-gray-500 mt-1">Az összes generált fotód projektek szerint csoportosítva.</p>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="bg-gray-900 text-white hover:bg-gray-700 gap-2"
        >
          <Plus className="w-4 h-4" /> Új projekt
        </Button>
      </div>

      {/* New project inline form */}
      {showNew && (
        <div className="mb-6 p-5 rounded-2xl border border-gray-200 bg-white flex items-center gap-3">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Projekt neve…"
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-300"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setShowNew(false); setNewName(""); }
            }}
          />
          <Button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="bg-gray-900 text-white hover:bg-gray-700 gap-2 shrink-0"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Létrehozás"}
          </Button>
          <button
            onClick={() => { setShowNew(false); setNewName(""); }}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && collections.length === 0 && (
        <Card className="border-gray-100 shadow-none">
          <div className="p-16 text-center">
            <FolderOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">Még nincs projekt</h3>
            <p className="text-sm text-gray-500 mb-6">
              Hozz létre egy projektet, és kezdd el a fotók generálását.
            </p>
            <Button onClick={() => setShowNew(true)} className="bg-gray-900 text-white hover:bg-gray-700 gap-2">
              <Plus className="w-4 h-4" /> Első projekt létrehozása
            </Button>
          </div>
        </Card>
      )}

      {/* Collection grid */}
      {!loading && collections.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {collections.map((col) => (
            <Link key={col.id} href={`/studio/projects/${col.id}`}>
              <Card className="group border-gray-100 shadow-none hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer">
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-50 border-b border-gray-100 flex items-center justify-center overflow-hidden relative">
                  {col.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={col.thumbnailUrl}
                      alt={col.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-200">
                      <ImageIcon className="w-10 h-10" />
                      <span className="text-xs font-medium">Nincs fotó</span>
                    </div>
                  )}
                  {/* Photo count badge */}
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {col.completedCount} fotó
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="font-semibold text-sm text-gray-900 truncate mb-1">{col.name}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatHuDate(col.lastActivity)}
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {/* New project card */}
          <button onClick={() => setShowNew(true)} className="text-left">
            <Card className="border-2 border-dashed border-gray-200 shadow-none hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 overflow-hidden cursor-pointer h-full min-h-[220px] flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Plus className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-400">Új projekt</p>
            </Card>
          </button>
        </div>
      )}
    </div>
  );
}
