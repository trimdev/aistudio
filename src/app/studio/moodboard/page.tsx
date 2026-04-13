import { getServerUser } from "@/lib/supabase/server";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, Clock } from "lucide-react";
import { NewMoodboardButton } from "./_components/NewMoodboardButton";

// Format date as "YYYY.MM.DD."
function formatDate(d: string) {
  const date = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}.`;
}

export default async function MoodboardListPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const workspace = await getEffectiveWorkspace();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("moodboards")
    .select("id, name, created_at, updated_at, items")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  const moodboards = (data ?? []) as {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    items: unknown[];
  }[];

  return (
    <div className="flex flex-col h-full overflow-auto bg-gray-50">
      <div className="flex-1 px-8 py-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-1">
              Moodboard
            </p>
            <h1 className="text-2xl font-bold text-gray-950">Mood Boardok</h1>
          </div>
          <NewMoodboardButton />
        </div>

        {moodboards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-pink-50 flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-7 h-7 text-pink-400" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">Még nincs moodboard</p>
            <p className="text-sm text-gray-500 mb-6">
              Hozz létre egy új moodboardot a model fotóidból.
            </p>
            <NewMoodboardButton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {moodboards.map((mb) => (
              <Link key={mb.id} href={`/studio/moodboard/${mb.id}`}>
                <div className="group border border-gray-100 rounded-xl shadow-none hover:border-pink-200 hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer bg-white">
                  <div className="aspect-video bg-gradient-to-br from-pink-50 via-violet-50 to-amber-50 flex items-center justify-center">
                    <LayoutGrid className="w-10 h-10 text-pink-200 group-hover:text-pink-300 transition-colors" />
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-900 truncate">{mb.name}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {formatDate(mb.updated_at)}
                      <span className="text-gray-300">·</span>
                      <span>{mb.items?.length ?? 0} kép</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
