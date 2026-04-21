"use client";

import { useState, useRef, useCallback, useEffect, memo } from "react";
import Link from "next/link";
import type { Moodboard, MoodboardItem, ProjectWithUrls } from "@/types";
import {
  ArrowLeft, Save, Download, Loader2, Plus, Trash2,
  RotateCcw, Palette, X, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  moodboard: Moodboard;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function extractColors(url: string, count = 6): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 50;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve([]); return; }
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const colors: [number, number, number][] = [];
      for (let i = 0; i < data.length; i += 16) {
        colors.push([data[i], data[i + 1], data[i + 2]]);
      }
      const toHex = (r: number, g: number, b: number) =>
        "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const [r, g, b] of colors) {
        const key = toHex(Math.round(r / 32) * 32, Math.round(g / 32) * 32, Math.round(b / 32) * 32);
        if (!seen.has(key)) { seen.add(key); unique.push(toHex(r, g, b)); }
        if (unique.length >= count) break;
      }
      resolve(unique.slice(0, count));
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}

const GalleryPanel = memo(function GalleryPanel({
  gallery,
  loading,
  open,
  onToggle,
  onAdd,
}: {
  gallery: ProjectWithUrls[];
  loading: boolean;
  open: boolean;
  onToggle: () => void;
  onAdd: (p: ProjectWithUrls) => void;
}) {
  return (
    <div className={cn(
      "bg-white border-r border-gray-100 flex flex-col shrink-0",
      open ? "w-52" : "w-10"
    )}>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-3 text-xs font-bold text-gray-500 hover:text-gray-800 border-b border-gray-100 transition-colors w-full"
      >
        <GripVertical className="w-3.5 h-3.5 shrink-0" />
        {open && <span>Fotók</span>}
      </button>
      {open && (
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : gallery.length === 0 ? (
            <p className="text-xs text-gray-400 text-center px-3 py-6 leading-relaxed">
              Még nincsenek kész fotók. Előbb generálj model fotókat.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {gallery.map((project) => (
                <button
                  key={project.id}
                  onClick={() => onAdd(project)}
                  className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-gray-100 hover:border-pink-300 hover:shadow-md transition-all"
                  title="Kattints a hozzáadáshoz"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={project.output_image_url!}
                    alt={project.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Plus className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const CanvasItem = memo(function CanvasItem({
  item,
  isSelected,
  onMouseDown,
  onResizeMouseDown,
  onRemove,
  setRef,
}: {
  item: MoodboardItem;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onResizeMouseDown: (e: React.MouseEvent, id: string, corner: string) => void;
  onRemove: (id: string) => void;
  setRef: (id: string, el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={(el) => setRef(item.id, el)}
      className={cn("absolute select-none", isSelected ? "ring-2 ring-pink-400 ring-offset-0" : "")}
      style={{
        left: item.x,
        top: item.y,
        width: item.width,
        height: item.height,
        zIndex: item.zIndex,
        transform: `rotate(${item.rotation}deg)`,
        cursor: "grab",
        willChange: "transform",
      }}
      onMouseDown={(e) => onMouseDown(e, item.id)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.signedUrl}
        alt=""
        className="w-full h-full object-cover block pointer-events-none"
        draggable={false}
      />
      {isSelected && (
        <>
          <button
            className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <div
              key={corner}
              data-resize="true"
              className="absolute w-3 h-3 bg-white border-2 border-pink-400 rounded-sm hover:bg-pink-100 z-10"
              style={{
                top: corner.startsWith("n") ? -6 : undefined,
                bottom: corner.startsWith("s") ? -6 : undefined,
                left: corner.endsWith("w") ? -6 : undefined,
                right: corner.endsWith("e") ? -6 : undefined,
                cursor: corner === "nw" || corner === "se" ? "nw-resize" : "ne-resize",
              }}
              onMouseDown={(e) => onResizeMouseDown(e, item.id, corner)}
            />
          ))}
        </>
      )}
    </div>
  );
});

export function MoodboardEditor({ moodboard: initial }: Props) {
  const [name, setName] = useState(initial.name);
  const [items, setItems] = useState<MoodboardItem[]>(initial.items);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [palette, setPalette] = useState<string[]>([]);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [gallery, setGallery] = useState<ProjectWithUrls[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Refs that mirror state so callbacks have stable [] deps and no stale closures
  const itemsRef = useRef<MoodboardItem[]>(initial.items);
  const nameRef = useRef(initial.name);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { nameRef.current = name; }, [name]);

  const dragRef = useRef<{
    itemId: string; startX: number; startY: number; origX: number; origY: number;
  } | null>(null);
  const resizeRef = useRef<{
    itemId: string; corner: string;
    startX: number; startY: number;
    origW: number; origH: number; origX: number; origY: number;
  } | null>(null);

  // Load gallery once
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: ProjectWithUrls[]) => {
        setGallery(data.filter((p) => p.status === "completed" && p.output_image_url));
      })
      .catch(() => {})
      .finally(() => setGalleryLoading(false));
  }, []);

  // Window-level drag/resize — zero React re-renders during movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const { itemId, startX, startY } = dragRef.current;
        const el = itemRefs.current.get(itemId);
        if (el) el.style.translate = `${e.clientX - startX}px ${e.clientY - startY}px`;
      }
      if (resizeRef.current) {
        const { itemId, corner, startX, startY, origW, origH, origX, origY } = resizeRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let w = origW, h = origH, x = origX, y = origY;
        if (corner.includes("e")) w = Math.max(80, origW + dx);
        if (corner.includes("s")) h = Math.max(80, origH + dy);
        if (corner.includes("w")) { w = Math.max(80, origW - dx); x = origX + origW - w; }
        if (corner.includes("n")) { h = Math.max(80, origH - dy); y = origY + origH - h; }
        const el = itemRefs.current.get(itemId);
        if (el) {
          el.style.left = `${x}px`; el.style.top = `${y}px`;
          el.style.width = `${w}px`; el.style.height = `${h}px`;
        }
      }
    };
    const handleMouseUp = () => {
      if (dragRef.current) {
        const { itemId, origX, origY } = dragRef.current;
        const el = itemRefs.current.get(itemId);
        if (el) {
          const parts = el.style.translate.split(" ");
          const dx = parseFloat(parts[0]) || 0;
          const dy = parseFloat(parts[1]) || 0;
          el.style.translate = "";
          const x = origX + dx, y = origY + dy;
          el.style.left = `${x}px`; el.style.top = `${y}px`;
          setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, x, y } : i));
        }
        dragRef.current = null;
      }
      if (resizeRef.current) {
        const { itemId } = resizeRef.current;
        const el = itemRefs.current.get(itemId);
        if (el) {
          const x = parseFloat(el.style.left), y = parseFloat(el.style.top);
          const w = parseFloat(el.style.width), h = parseFloat(el.style.height);
          setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, x, y, width: w, height: h } : i));
        }
        resizeRef.current = null;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Stable ref setter for CanvasItem
  const setItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  // All handlers have [] deps — fully stable references, no unnecessary re-renders
  const onItemMouseDown = useCallback((e: React.MouseEvent, itemId: string) => {
    if ((e.target as HTMLElement).closest("[data-resize]")) return;
    e.preventDefault();
    e.stopPropagation();
    const item = itemsRef.current.find((i) => i.id === itemId);
    if (!item) return;
    dragRef.current = { itemId, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y };
    setSelectedId(itemId);
  }, []);

  const onResizeMouseDown = useCallback((e: React.MouseEvent, itemId: string, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    const item = itemsRef.current.find((i) => i.id === itemId);
    if (!item) return;
    resizeRef.current = {
      itemId, corner,
      startX: e.clientX, startY: e.clientY,
      origW: item.width, origH: item.height, origX: item.x, origY: item.y,
    };
  }, []);

  // Uses functional setState so no items/selectedId deps needed
  const addPhoto = useCallback((project: ProjectWithUrls) => {
    if (!project.output_image || !project.output_image_url) return;
    setItems((prev) => {
      const maxZ = prev.reduce((m, i) => Math.max(m, i.zIndex), 0);
      return [...prev, {
        id: uid(), projectId: project.id,
        imagePath: project.output_image!, bucket: "ghost-outputs",
        x: 40 + (prev.length % 5) * 20, y: 40 + (prev.length % 5) * 20,
        width: 220, height: 280, rotation: 0, zIndex: maxZ + 1,
        signedUrl: project.output_image_url!,
      }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedId((prev) => prev === id ? null : prev);
  }, []);

  const deselect = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) setSelectedId(null);
  }, []);

  const toggleGallery = useCallback(() => setGalleryOpen((o) => !o), []);

  // Uses refs so no state deps needed
  const refreshPalette = useCallback(async () => {
    const current = itemsRef.current;
    if (current.length === 0) { setPalette([]); return; }
    setPaletteLoading(true);
    const allColors: string[] = [];
    for (const item of current.slice(0, 4)) {
      if (item.signedUrl) allColors.push(...await extractColors(item.signedUrl, 4));
    }
    setPalette([...new Set(allColors)].slice(0, 8));
    setPaletteLoading(false);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/moodboards/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameRef.current, items: itemsRef.current }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [initial.id]);

  const exportImage = useCallback(async () => {
    const current = itemsRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1200, 800);
    const sorted = [...current].sort((a, b) => a.zIndex - b.zIndex);
    await Promise.all(sorted.map((item) =>
      new Promise<void>((resolve) => {
        if (!item.signedUrl) { resolve(); return; }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          ctx.save();
          ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
          ctx.rotate((item.rotation * Math.PI) / 180);
          ctx.drawImage(img, -item.width / 2, -item.height / 2, item.width, item.height);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = item.signedUrl;
      })
    ));
    const link = document.createElement("a");
    link.download = `${nameRef.current}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  const selected = items.find((i) => i.id === selectedId);
  const sortedItems = [...items].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-100 shrink-0">
        <Link href="/studio/moodboard"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 max-w-xs text-sm font-semibold text-gray-900 bg-transparent border-0 outline-none focus:ring-0 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
          placeholder="Moodboard neve..."
        />
        <div className="flex items-center gap-2 ml-auto">
          {palette.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl">
              <Palette className="w-3.5 h-3.5 text-gray-400" />
              {palette.map((color) => (
                <div key={color} className="w-4 h-4 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: color }} title={color} />
              ))}
              {paletteLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => { void refreshPalette(); }}
            className="h-8 text-xs gap-1.5 border-gray-200" disabled={paletteLoading || items.length === 0}>
            <Palette className="w-3.5 h-3.5" />Paletta
          </Button>
          <Button variant="outline" size="sm" onClick={exportImage}
            className="h-8 text-xs gap-1.5 border-gray-200">
            <Download className="w-3.5 h-3.5" />Export
          </Button>
          <Button size="sm" onClick={() => { void save(); }} disabled={saving}
            className={cn("h-8 text-xs gap-1.5 transition-colors",
              saved ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-900 hover:bg-gray-700 text-white")}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "Mentve!" : "Mentés"}
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Gallery — memoized, never re-renders from canvas state */}
        <GalleryPanel
          gallery={gallery}
          loading={galleryLoading}
          open={galleryOpen}
          onToggle={toggleGallery}
          onAdd={addPhoto}
        />

        {/* Canvas */}
        <div className="flex-1 overflow-auto relative">
          <div
            ref={canvasRef}
            className="relative bg-white"
            style={{ width: 1200, height: 800, minWidth: "100%", minHeight: "100%" }}
            onClick={deselect}
          >
            {items.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-2xl bg-pink-50 flex items-center justify-center mb-3">
                  <Plus className="w-7 h-7 text-pink-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">Kattints egy fotóra a hozzáadáshoz</p>
              </div>
            )}
            {sortedItems.map((item) => (
              <CanvasItem
                key={item.id}
                item={item}
                isSelected={item.id === selectedId}
                onMouseDown={onItemMouseDown}
                onResizeMouseDown={onResizeMouseDown}
                onRemove={removeItem}
                setRef={setItemRef}
              />
            ))}
          </div>
        </div>

        {/* Right panel — always present to avoid layout shifts when selecting */}
        <div className="w-44 bg-white border-l border-gray-100 shrink-0 p-4 flex flex-col gap-4">
          {selected ? (
            <>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Beállítások</p>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Méret</label>
                <div className="flex gap-2">
                  {(["width", "height"] as const).map((dim) => (
                    <div key={dim} className="flex-1">
                      <p className="text-[10px] text-gray-400 mb-0.5">{dim === "width" ? "W" : "H"}</p>
                      <input type="number" value={Math.round(selected[dim])}
                        onChange={(e) => {
                          const v = Math.max(80, Number(e.target.value));
                          setItems((prev) => prev.map((i) => i.id === selected.id ? { ...i, [dim]: v } : i));
                        }}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-pink-400"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Forgatás</label>
                <input type="range" min={-45} max={45} value={selected.rotation}
                  onChange={(e) => {
                    const rot = Number(e.target.value);
                    setItems((prev) => prev.map((i) => i.id === selected.id ? { ...i, rotation: rot } : i));
                  }}
                  className="w-full accent-pink-500"
                />
                <p className="text-[10px] text-gray-400 text-center mt-0.5">{selected.rotation}°</p>
              </div>
              <button
                onClick={() => setItems((prev) => prev.map((i) => i.id === selected.id ? { ...i, rotation: 0 } : i))}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />Reset forgatás
              </button>
              <button onClick={() => removeItem(selected.id)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors mt-auto">
                <Trash2 className="w-3.5 h-3.5" />Törlés
              </button>
            </>
          ) : (
            <p className="text-xs text-gray-300 text-center mt-4">Válassz egy képet</p>
          )}
        </div>
      </div>
    </div>
  );
}
