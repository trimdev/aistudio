import { NextRequest, NextResponse } from "next/server";
import { listVersions } from "@/lib/versions";
import { getServerUser } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  try {
    const versions = await listVersions(projectId);
    return NextResponse.json({ versions });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load versions" },
      { status: 500 }
    );
  }
}
