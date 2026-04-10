import { NextResponse } from "next/server";
import { getServerUser, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const workspace = await getWorkspace();
  if (!workspace || workspace.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  // All workspaces with user emails
  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, user_id, role, created_at, updated_at")
    .order("created_at", { ascending: false });

  // All projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id, workspace_id, name, status, created_at")
    .order("created_at", { ascending: false });

  // Get auth users for emails
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();

  const userMap = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));

  // Enrich workspaces
  const enriched = (workspaces ?? []).map((ws) => {
    const wsProjects = (projects ?? []).filter((p) => p.workspace_id === ws.id);
    const lastProject = wsProjects[0];
    return {
      ...ws,
      email: userMap.get(ws.user_id) ?? "",
      projectCount: wsProjects.length,
      completedCount: wsProjects.filter((p) => p.status === "completed").length,
      lastActivity: lastProject?.created_at ?? ws.updated_at,
    };
  });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const allProjects = projects ?? [];
  const stats = {
    totalWorkspaces: enriched.length,
    totalUsers: enriched.length,
    totalGenerations: allProjects.filter((p) => p.status === "completed").length,
    todayGenerations: allProjects.filter(
      (p) => p.status === "completed" && p.created_at >= todayStart
    ).length,
    monthGenerations: allProjects.filter(
      (p) => p.status === "completed" && p.created_at >= monthStart
    ).length,
  };

  return NextResponse.json({ workspaces: enriched, stats });
}
