import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { listProjects } from "@/lib/projects";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const projects = await listProjects();
  return NextResponse.json(projects);
}
