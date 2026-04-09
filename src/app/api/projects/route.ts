import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listProjects } from "@/lib/projects";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const projects = await listProjects();
  return NextResponse.json(projects);
}
