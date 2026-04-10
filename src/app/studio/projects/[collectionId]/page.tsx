import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ghost, User, Clock, Download, ImageIcon, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCollection } from "@/lib/collections";
import { listProjectsByCollection } from "@/lib/projects";

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

function formatHuDate(d: string) {
  const date = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}. ${pad(date.getMonth() + 1)}. ${pad(date.getDate())}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId } = await params;
  const [collection, photos] = await Promise.all([
    getCollection(collectionId),
    listProjectsByCollection(collectionId),
  ]);

  if (!collection) notFound();

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
        {/* Ghost Mannequin */}
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

        {/* Model Photos */}
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
      </div>

      {/* Photos grid */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
            <ImageIcon className="w-7 h-7 text-gray-300" />
          </div>
          <p className="font-medium text-gray-500 mb-1">Még nincs fotó ebben a projektben</p>
          <p className="text-sm text-gray-400">Kattints az egyik kártya fölé, hogy generálj!</p>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Generált fotók</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {photos.map((photo) => (
              <Card key={photo.id} className="group border-gray-100 shadow-none hover:border-gray-200 hover:shadow-md transition-all overflow-hidden">
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden relative">
                  {photo.output_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.output_image_url}
                      alt={photo.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-200" />
                  )}
                  {/* Download overlay */}
                  {photo.output_image_full_url && (
                    <a
                      href={photo.output_image_full_url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Download className="w-4 h-4 text-white" />
                      </div>
                    </a>
                  )}
                </div>
                {/* Info */}
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-700 truncate mb-1.5">{photo.name}</p>
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={`text-[10px] font-semibold px-1.5 py-0 rounded-full border-0 ${statusColor[photo.status]}`}>
                      {statusLabel[photo.status]}
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Clock className="w-2.5 h-2.5" />
                      {formatHuDate(photo.created_at).slice(0, 12)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
