import { NextRequest, NextResponse } from "next/server";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getOrCreateWorkspace();
  return NextResponse.json({
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    hasCustomApiKey: !!workspace.gemini_api_key,
    modules: workspace.modules ?? ["fashion"],
    email: user.email,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json();
  const admin = createSupabaseAdminClient();
  const workspace = await getOrCreateWorkspace();

  const updates: Record<string, string | null> = {};
  if ("workspaceName" in body) updates.name = body.workspaceName as string;
  if ("geminiApiKey" in body) {
    const key = (body.geminiApiKey as string) || null;
    if (key !== null && !/^AIza[0-9A-Za-z\-_]{35}$/.test(key)) {
      return NextResponse.json({ error: "Invalid Gemini API key format" }, { status: 400 });
    }
    updates.gemini_api_key = key;
  }

  const { error } = await admin.from("workspaces").update(updates).eq("id", workspace.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
