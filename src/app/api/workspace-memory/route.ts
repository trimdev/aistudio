import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace";
import {
  listWorkspaceMemories,
  addWorkspaceMemory,
  deleteWorkspaceMemory,
} from "@/lib/workspace-memory";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getOrCreateWorkspace();
  const memories = await listWorkspaceMemories(workspace.id);
  return NextResponse.json({ memories });
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json();
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) return NextResponse.json({ error: "note is required" }, { status: 400 });

  const workspace = await getOrCreateWorkspace();
  const memory = await addWorkspaceMemory(workspace.id, note);
  return NextResponse.json({ memory });
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const workspace = await getOrCreateWorkspace();
  await deleteWorkspaceMemory(id, workspace.id);
  return NextResponse.json({ ok: true });
}
