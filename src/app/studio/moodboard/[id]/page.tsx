import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { getSignedUrl } from "@/lib/storage";
import { redirect, notFound } from "next/navigation";
import { MoodboardEditor } from "@/components/studio/MoodboardEditor";
import type { Moodboard, MoodboardItem } from "@/types";

export default async function MoodboardEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getServerUser();
  if (!user) redirect("/login");

  const workspace = await getEffectiveWorkspace();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("moodboards")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (!data) notFound();

  // Enrich items with fresh signed URLs
  const rawItems: MoodboardItem[] = (data.items as MoodboardItem[]) ?? [];
  const enrichedItems = await Promise.all(
    rawItems.map(async (item) => ({
      ...item,
      signedUrl: await getSignedUrl(item.bucket, item.imagePath, 3600),
    }))
  );

  const moodboard: Moodboard = { ...(data as Moodboard), items: enrichedItems };

  return <MoodboardEditor moodboard={moodboard} />;
}
