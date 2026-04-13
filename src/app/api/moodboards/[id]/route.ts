import { NextRequest, NextResponse } from "next/server";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { getSignedUrl } from "@/lib/storage";
import type { MoodboardItem } from "@/types";

const ALLOWED_BUCKETS = ["ghost-inputs", "ghost-outputs"] as const;
const MAX_ITEMS = 500;

/** Returns true only if the item's bucket and path are owned by this workspace's user. */
function isItemAllowed(item: MoodboardItem, ownerUserId: string): boolean {
  return (
    (ALLOWED_BUCKETS as readonly string[]).includes(item.bucket) &&
    typeof item.imagePath === "string" &&
    item.imagePath.startsWith(`${ownerUserId}/`)
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getEffectiveWorkspace();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("moodboards")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only generate signed URLs for items that belong to this workspace's owner
  const items: MoodboardItem[] = data.items ?? [];
  const safeItems = items.filter((item: MoodboardItem) => isItemAllowed(item, workspace.user_id));
  const enriched = await Promise.all(
    safeItems.map(async (item: MoodboardItem) => ({
      ...item,
      signedUrl: await getSignedUrl(item.bucket, item.imagePath, 3600),
    }))
  );

  return NextResponse.json({ moodboard: { ...data, items: enriched } });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getEffectiveWorkspace();
  const body = await req.json() as { name?: string; items?: MoodboardItem[] };

  // Strip signedUrl, cap array size, and reject items pointing outside this workspace
  const items = (body.items ?? [])
    .slice(0, MAX_ITEMS)
    .filter((item: MoodboardItem) => isItemAllowed(item, workspace.user_id))
    .map(({ signedUrl: _, ...item }) => item);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("moodboards")
    .update({ ...(body.name !== undefined ? { name: body.name } : {}), items })
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getEffectiveWorkspace();
  const supabase = createSupabaseAdminClient();

  await supabase
    .from("moodboards")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);

  return NextResponse.json({ ok: true });
}
