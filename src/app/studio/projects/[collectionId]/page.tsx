import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ghost, User, Plus, Sofa, Home } from "lucide-react";
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
  const hasFashion   = modules.includes("fashion");
  const hasFurniture = modules.includes("furniture");

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
        {hasFashion && (
          <Link href={`/studio/new/ghost?collectionId=${collectionId}`}>
            <div className="group relative h-full flex flex-col bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer">
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-gray-700 via-gray-500 to-gray-400" />
              <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center mb-4">
                <Ghost className="w-5 h-5 text-white" />
              </div>
              <p className="font-bold text-gray-900 mb-1">Új Ghost fotó</p>
              <p className="text-sm text-gray-500">Szellemfigura kompozit generálása ebbe a projektbe.</p>
              <div className="flex items-center gap-1.5 mt-4 text-sm font-bold text-gray-900 group-hover:gap-2.5 transition-all">
                <Plus className="w-4 h-4" /> Generálás
              </div>
            </div>
          </Link>
        )}

        {hasFashion && (
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
