import { NextRequest, NextResponse } from "next/server";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";

const BUCKET = "ghost-inputs";
const refPath = (workspaceId: string, variant: string) =>
  `${workspaceId}/model-refs/${variant}`;

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getOrCreateWorkspace();
  const storage = createSupabaseAdminClient().storage;

  async function getUrl(variant: string): Promise<string | null> {
    const { data, error } = await storage
      .from(BUCKET)
      .createSignedUrl(refPath(workspace.id, variant), 3600);
    if (error || !data) return null;
    return data.signedUrl;
  }

  const [blonde, brunette] = await Promise.all([
    getUrl("blonde"),
    getUrl("brunette"),
  ]);

  return NextResponse.json({ blonde, brunette });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getOrCreateWorkspace();
  const formData = await req.formData();
  const variant = formData.get("variant") as string | null;
  const file = formData.get("file") as File | null;

  if (!variant || !["blonde", "brunette"].includes(variant)) {
    return NextResponse.json({ error: "variant must be blonde or brunette" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  const storage = createSupabaseAdminClient().storage;

  const { error } = await storage
    .from(BUCKET)
    .upload(refPath(workspace.id, variant), buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: signedData } = await storage
    .from(BUCKET)
    .createSignedUrl(refPath(workspace.id, variant), 3600);

  return NextResponse.json({ url: signedData?.signedUrl ?? null });
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getOrCreateWorkspace();
  const { searchParams } = new URL(req.url);
  const variant = searchParams.get("variant");

  if (!variant || !["blonde", "brunette"].includes(variant)) {
    return NextResponse.json({ error: "variant must be blonde or brunette" }, { status: 400 });
  }

  const { error } = await createSupabaseAdminClient().storage
    .from(BUCKET)
    .remove([refPath(workspace.id, variant)]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
