import Link from "next/link";
import { ArrowRight, Wand2, FolderOpen, ImageIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerUser } from "@/lib/supabase/server";
import { listCollections } from "@/lib/collections";

export default async function StudioDashboard() {
  const user = await getServerUser();
  const collections = await listCollections();
  const recent = collections.slice(0, 3);

  const totalCompleted = collections.reduce((sum, c) => sum + c.completedCount, 0);
  const thisMonth = collections.filter((c) => {
    const d = new Date(c.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Üdv vissza, {displayName} 👋</h1>
        <p className="text-gray-500 mt-1 text-sm">Az AI szellemfigura stúdiód — alkossunk valami nagyszerűt.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Összes projekt", value: collections.length },
          { label: "Elkészült képek", value: totalCompleted },
          { label: "Ezen a hónapon", value: thisMonth },
        ].map(({ label, value }) => (
          <Card key={label} className="p-5 border-gray-100 shadow-none">
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      <Card className="border-dashed border-gray-200 shadow-none mb-8 bg-white">
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center shrink-0">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Új kép generálása</h3>
              <p className="text-sm text-gray-500 mt-0.5">Válassz egy projektet, majd generálj Ghost vagy Modell fotót.</p>
            </div>
          </div>
          <Link href="/studio/projects">
            <Button className="bg-gray-900 text-white hover:bg-gray-700 gap-2 shrink-0">
              Kezdés <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Legutóbbi projektek</h2>
        <Link href="/studio/projects">
          <Button variant="ghost" size="sm" className="text-gray-500 gap-1.5">
            Összes megtekintése <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {recent.length === 0 ? (
        <Card className="border-gray-100 shadow-none">
          <div className="p-12 text-center">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Még nincsenek projektek.</p>
            <Link href="/studio/projects">
              <Button variant="outline" size="sm" className="mt-4">Első projekt létrehozása</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {recent.map((col) => (
            <Link key={col.id} href={`/studio/projects/${col.id}`}>
              <Card className="border-gray-100 shadow-none hover:border-gray-200 transition-colors">
                <div className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                    {col.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={col.thumbnailUrl} alt={col.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{col.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(col.lastActivity).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-700">{col.completedCount}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                      <Clock className="w-2.5 h-2.5" /> fotó
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
