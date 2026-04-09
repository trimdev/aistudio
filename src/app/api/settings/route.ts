import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getOrCreateWorkspace();
  return NextResponse.json({
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    hasCustomApiKey: !!workspace.gemini_api_key,
  });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json();
  const admin = createSupabaseAdminClient();
  const workspace = await getOrCreateWorkspace();

  const updates: Record<string, string | null> = {};
  if ("workspaceName" in body) updates.name = body.workspaceName as string;
  if ("geminiApiKey" in body) {
    // Allow clearing by passing empty string
    updates.gemini_api_key = body.geminiApiKey || null;
  }

  const { error } = await admin
    .from("workspaces")
    .update(updates)
    .eq("id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
