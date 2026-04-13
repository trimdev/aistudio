import { NextRequest, NextResponse } from "next/server";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getEffectiveWorkspace } from "@/lib/workspace";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getEffectiveWorkspace();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("moodboards")
    .select("id, workspace_id, name, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ moodboards: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getEffectiveWorkspace();
  const body = await req.json() as { name?: string };
  const name = body.name?.trim() || "Moodboard";

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("moodboards")
    .insert({ workspace_id: workspace.id, name, items: [] })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ moodboard: data });
}
