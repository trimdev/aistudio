import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ghost, User, Plus, Sofa, Home, Palette, Film } from "lucide-react";
import { getCollection } from "@/lib/collections";
import { listProjectsByCollection } from "@/lib/projects";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { PhotoGrid } from "./PhotoGrid";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const [collection, photos, workspace] = await Promise.all([
    getCollection(collectionId),
    listProjectsByCollection(collectionId),
    getEffectiveWorkspace(),
  ]);

  if (!collection) notFound();

  const modules: string[] = workspace.modules ?? ["fashion"];
  const hasFashion     = modules.includes("fashion");
  const hasGhost       = modules.includes("ghost");
  const hasModel       = modules.includes("model");
  const hasFurniture   = modules.includes("furniture");
  const hasDesignModel = modules.includes("design-model");
  const hasVideo       = modules.includes("video");

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/studio/projects"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">{collection.name}</h1>
        <span className="text-sm text-gray-400 ml-1">{photos.length} fotó</span>
      </div>
      <p className="text-sm text-gray-400 ml-10 mb-8">
        Adj hozzá új fotókat, vagy tekintsd meg a korábban generált képeket.
      </p>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {hasFashion && hasGhost && (
          <div className="relative h-full flex bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gray-700 via-gray-500 to-gray-400" />
            {/* Left half — Új Ghost fotó */}
            <Link href={`/studio/new/ghost?collectionId=${collectionId}`} className="flex-1 group">
              <div className="flex flex-col p-6 h-full hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center mb-4">
                  <Ghost className="w-5 h-5 text-white" />
                </div>
                <p className="font-bold text-gray-900 mb-1">Új Ghost fotó</p>
                <p className="text-sm text-gray-500">Egyedi szellemfigura kompozit generálása.</p>
                <div className="flex items-center gap-1.5 mt-4 text-sm font-bold text-gray-900 group-hover:gap-2.5 transition-all">
                  <Plus className="w-4 h-4" /> Generálás
                </div>
              </div>
            </Link>
            {/* Divider */}
            <div className="w-px bg-gray-200 self-stretch my-4" />
            {/* Right half — Tömeges Ghost fotó */}
            <Link href={`/studio/new/batch-ghost?collectionId=${collectionId}`} className="flex-1 group">
              <div className="flex flex-col p-6 h-full hover:bg-gray-50 transition-colors">
                <div className="relative w-12 h-10 mb-4">
                  <div className="absolute w-8 h-8 rounded-lg bg-gray-300 border border-gray-200 flex items-center justify-center" style={{ top: 0, left: 12 }}>
                    <Ghost className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="absolute w-9 h-9 rounded-lg bg-gray-500 border border-gray-400 flex items-center justify-center" style={{ top: 1, left: 5 }}>
                    <Ghost className="w-4 h-4 text-gray-300" />
                  </div>
                  <div className="absolute w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center" style={{ top: 0, left: 0 }}>
                    <Ghost className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="font-bold text-gray-900 mb-1">Tömeges Ghost fotó</p>
                <p className="text-sm text-gray-500">Mappa alapú köteges feldolgozás.</p>
                <div className="flex items-center gap-1.5 mt-4 text-sm font-bold text-gray-700 group-hover:gap-2.5 transition-all">
                  <Plus className="w-4 h-4" /> Köteges
                </div>
              </div>
            </Link>
          </div>
        )}

        {hasFashion && hasModel && (
          <Link href={`/studio/new/model?collectionId=${collectionId}`}>
            <div className="group relative h-full flex flex-col bg-white rounded-2xl border border-violet-200 p-6 shadow-sm hover:shadow-lg hover:border-violet-300 transition-all duration-200 cursor-pointer">
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-violet-500 via-pink-400 to-amber-300" />
              <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center mb-4">
                <User className="w-5 h-5 text-white" />
              </div>
              <p className="font-bold text-gray-900 mb-1">Új Modell fotó</p>
              <p className="text-sm text-gray-500">Szőke vagy barna modell fotók generálása ebbe a projektbe.</p>
              <div className="flex items-center gap-1.5 mt-4 text-sm font-bold text-violet-700 group-hover:gap-2.5 transition-all">
                <Plus className="w-4 h-4" /> Generálás
              </div>
            </div>
          </Link>
        )}

        {hasFashion && hasDesignModel && (
          <Link href={`/studio/new/design-model?collectionId=${collectionId}`}>
            <div className="group relative h-full flex flex-col bg-white rounded-2xl border border-rose-200 p-6 shadow-sm hover:shadow-lg hover:border-rose-300 transition-all duration-200 cursor-pointer">
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-rose-500 via-pink-400 to-fuchsia-300" />
              <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center mb-4">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <p className="font-bold text-gray-900 mb-1">Új Design Modell fotó</p>
              <p className="text-sm text-gray-500">Szláv és francia AI modellek szerkesztői minőségű fotókhoz.</p>
              <div className="flex items-center gap-1.5 mt-4 text-sm font-bold text-rose-700 group-hover:gap-2.5 transition-all">
                <Plus className="w-4 h-4" /> Generálás
              </div>
            </div>
          </Link>
        )}

        {hasFashion && hasVideo && (
          <Link href={`/studio/new/video?collectionId=${collectionId}`}>
            <div className="group relative h-full flex flex-col bg-white rounded-2xl border border-indigo-200 p-6 shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all duration-200 cursor-pointer">
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400" />
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4">
                <Film className="w-5 h-5 text-white" />
              </div>
              <p className="font-bold text-gray-900 mb-1">Fashion Videó</p>
              <p className="text-sm text-gray-500">AI videó generálás a projekt meglévő fotóiból — mozgás, zene, branding.</p>
              <div className="flex items-center gap-1.5 mt-4 text-sm font-bold text-indigo-700 group-hover:gap-2.5 transition-all">
                <Plus className="w-4 h-4" /> Generálás
              </div>
            </div>
          </Link>
        )}

        {hasFurniture && (
          <Link href={`/studio/furniture/ghost?collectionId=${collectionId}`}>
            <div className="group relative h-full flex flex-col bg-white rounded-2xl border border-amber-200 p-6 shadow-sm hover:shadow-lg hover:border-amber-300 transition-all duration-200 cursor-pointer">
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300" />
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center mb-4">
                <Sofa className="w-5 h-5 text-white" />
              </div>
              <p className="font-bold text-gray-900 mb-1">Új Termékkép</p>
              <p className="text-sm text-gray-500">Fehér hátteres bútor termékkép generálása ebbe a projektbe.</p>
              <div className="flex items-center gap-1.5 mt-4 text-sm font-bold text-amber-700 group-hover:gap-2.5 transition-all">
                <Plus className="w-4 h-4" /> Generálás
              </div>
            </div>
          </Link>
        )}

        {hasFurniture && (
          <Link href={`/studio/furniture/lifestyle?collectionId=${collectionId}`}>
            <div className="group relative h-full flex flex-col bg-white rounded-2xl border border-orange-200 p-6 shadow-sm hover:shadow-lg hover:border-orange-300 transition-all duration-200 cursor-pointer">
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300" />
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center mb-4">
                <Home className="w-5 h-5 text-white" />
              </div>
              <p className="font-bold text-gray-900 mb-1">Új Életkép</p>
              <p className="text-sm text-gray-500">Bútor elhelyezése fotórealisztikus életkép környezetben.</p>
              <div className="flex items-center gap-1.5 mt-4 text-sm font-bold text-orange-700 group-hover:gap-2.5 transition-all">
                <Plus className="w-4 h-4" /> Generálás
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Photos grid — client component handles delete */}
      <PhotoGrid initialPhotos={photos} />
    </div>
  );
}
