"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, ImageIcon, Loader2, Trash2, X, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ProjectWithUrls } from "@/types";

const statusLabel: Record<string, string> = {
  completed:  "Kész",
  processing: "Folyamatban",
  failed:     "Sikertelen",
  pending:    "Várakozik",
};
const statusColor: Record<string, string> = {
  completed:  "bg-green-100 text-green-700",
  processing: "bg-yellow-100 text-yellow-700",
  failed:     "bg-red-100 text-red-700",
  pending:    "bg-gray-100 text-gray-500",
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────

interface LightboxProps {
  photos: ProjectWithUrls[];
  index: number;
  onClose: () => void;
  onNav: (index: number) => void;
}

function Lightbox({ photos, index, onClose, onNav }: LightboxProps) {
  const photo = photos[index];

  const prev = useCallback(() => onNav(index > 0 ? index - 1 : photos.length - 1), [index, photos.length, onNav]);
  const next = useCallback(() => onNav(index < photos.length - 1 ? index + 1 : 0), [index, photos.length, onNav]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Prev */}
      {photos.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <div className="max-w-4xl max-h-[90vh] mx-16 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {photo.output_image_full_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.output_image_full_url}
            alt={photo.name}
            className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl"
          />
        ) : (
          <div className="w-64 h-64 rounded-xl bg-white/5 flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-white/30" />
          </div>
        )}

        {/* Caption row */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/80 font-medium">{photo.name}</span>
          <span className="text-xs text-white/40">{index + 1} / {photos.length}</span>
          {photo.output_image_full_url && (
            <a
              href={photo.output_image_full_url}
              download
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
            >
              <Download className="w-3 h-3" /> Letöltés
            </a>
          )}
        </div>
      </div>

      {/* Next */}
      {photos.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

export function PhotoGrid({ initialPhotos }: { initialPhotos: ProjectWithUrls[] }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      toast.success("Fotó törölve.");
    } catch {
      toast.error("Törlés sikertelen.");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const filteredPhotos = searchQuery.trim()
    ? photos.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : photos;

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
          <ImageIcon className="w-7 h-7 text-gray-300" />
        </div>
        <p className="font-medium text-gray-500 mb-1">Még nincs fotó ebben a projektben</p>
        <p className="text-sm text-gray-400">Kattints az egyik kártya fölé, hogy generálj!</p>
      </div>
    );
  }

  // Only completed photos with images are lightbox-navigable
  const lightboxPhotos = filteredPhotos.filter((p) => p.output_image_full_url);

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNav={setLightboxIndex}
        />
      )}

      <div>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider shrink-0">
            Generált fotók
          </h2>
          <div className="flex-1 relative">
            <div className="relative flex items-center bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 focus-within:border-gray-400 focus-within:shadow-md transition-all">
              <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Keresés fotók között..."
                className="w-full text-sm bg-transparent rounded-xl pl-10 pr-9 py-2 focus:outline-none placeholder:text-gray-400"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="absolute right-3 text-[11px] text-gray-300 font-medium select-none">
                  {photos.length} fotó
                </span>
              )}
            </div>
          </div>
          {searchQuery && (
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full shrink-0">
              {filteredPhotos.length} találat
            </span>
          )}
        </div>
        {searchQuery && filteredPhotos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="w-8 h-8 text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">Nincs találat: &quot;{searchQuery}&quot;</p>
          </div>
        )}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3">
          {filteredPhotos.map((photo) => {
            const lbIndex = lightboxPhotos.findIndex((p) => p.id === photo.id);
            return (
              <div key={photo.id} className="relative group">
                <div
                  className="rounded-lg overflow-hidden border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all bg-gray-50 cursor-pointer"
                  onClick={() => lbIndex >= 0 && setLightboxIndex(lbIndex)}
                >
                  <div className="aspect-square overflow-hidden relative">
                    {photo.output_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.output_image_url}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-gray-200" />
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors opacity-0 group-hover:opacity-100 flex flex-col justify-end p-1.5">
                      <div className="flex items-end justify-between gap-1">
                        <p className="text-[11px] font-semibold text-white truncate leading-tight">{photo.name}</p>
                        {photo.output_image_full_url && (
                          <a
                            href={photo.output_image_full_url}
                            download
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded-md bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors shrink-0"
                          >
                            <Download className="w-3 h-3 text-white" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Status badge — non-completed only */}
                    {photo.status !== "completed" && (
                      <div className="absolute top-1 right-1">
                        <Badge className={`text-[8px] font-bold px-1 py-0 rounded border-0 ${statusColor[photo.status]}`}>
                          {statusLabel[photo.status]}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete confirm overlay */}
                {confirmDeleteId === photo.id ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-white/95 rounded-lg border border-red-200 p-2">
                    <p className="text-[10px] font-semibold text-gray-800 text-center">Törlöd?</p>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-200 text-gray-600 text-[10px] h-6 px-2"
                        disabled={deleting}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Nem
                      </Button>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white text-[10px] h-6 px-2 gap-1"
                        disabled={deleting}
                        onClick={() => handleDelete(photo.id)}
                      >
                        {deleting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                        Igen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(photo.id); }}
                    className="absolute top-1 left-1 z-10 p-1 rounded-md bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    title="Fotó törlése"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
