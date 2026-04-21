import type React from "react";
import { createSupabaseAdminClient, getServerUser } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Zap, TrendingUp, Image, ArrowRight,
  FolderOpen, Clock, Activity, LogIn, Ghost, Sofa, DollarSign, LayoutGrid,
} from "lucide-react";
import { enterWorkspace } from "./actions";
import { MiniTrendChart } from "./_components/MiniTrendChart";
import { CreateWorkspaceForm } from "./_components/CreateWorkspaceForm";
import { DeleteWorkspaceButton } from "./_components/DeleteWorkspaceButton";

interface WorkspaceRow {
  id: string;
  name: string;
  user_id: string;
  role: string;
  modules: string[] | null;
  gemini_api_key?: string | null;
  created_at: string;
  updated_at: string;
}


function formatHuDate(d: string) {
  const date = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}.`;
}

function formatHuDateTime(d: string) {
  const date = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getInitials(email: string): string {
  const parts = email.split("@")[0].split(/[._\-+]/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const MODULE_META: Record<string, { label: string; style: string; icon: React.ReactNode }> = {
  fashion:   { label: "Fashion Studio",   style: "bg-violet-100 text-violet-700", icon: <Ghost className="w-3 h-3" /> },
  furniture: { label: "Furniture Studio", style: "bg-amber-100 text-amber-700",   icon: <Sofa  className="w-3 h-3" /> },
  moodboard: { label: "Moodboard",        style: "bg-pink-100 text-pink-700",     icon: <LayoutGrid className="w-3 h-3" /> },
};

function ModuleBadges({ modules }: { modules: string[] | null }) {
  const active = (modules ?? ["fashion"]).filter((m) => m in MODULE_META);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {active.map((m) => (
        <span key={m} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${MODULE_META[m].style}`}>
          {MODULE_META[m].icon}
          {MODULE_META[m].label}
        </span>
      ))}
    </div>
  );
}

function avatarColor(email: string): string {
  const colors = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500",
    "bg-rose-500", "bg-amber-500", "bg-cyan-500", "bg-indigo-500",
  ];
  let hash = 0;
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function formatCostGlobal(usd: number): string {
  if (usd < 0.01) return "< $0.01";
  return `$${usd.toFixed(2)}`;
}

function formatCostWorkspace(usd: number): string {
  if (usd < 0.001) return "< $0.001";
  return `$${usd.toFixed(3)}`;
}

export default async function AdminPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspace();
  if (!workspace || workspace.role !== "admin") redirect("/studio");

  const supabase = createSupabaseAdminClient();

  const [workspacesRes, projectsRes, collectionsRes, usersRes] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, user_id, role, modules, gemini_api_key, created_at, updated_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, workspace_id, status, updated_at, output_image, prompt_used")
      .order("updated_at", { ascending: false }),
    supabase
      .from("project_collections")
      .select("id, workspace_id"),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const allWorkspaces  = (workspacesRes.data   ?? []) as WorkspaceRow[];
  const allProjects    = (projectsRes.data      ?? []) as {
    id: string;
    workspace_id: string;
    status: string;
    updated_at: string;
    output_image: string | null;
    prompt_used: string | null;
  }[];
  const allCollections = (collectionsRes.data   ?? []) as { id: string; workspace_id: string }[];
  const authUsers      = usersRes.data?.users   ?? [];
  const userMap        = new Map(authUsers.map((u) => [u.id, u.email ?? "—"]));

  // Build lastLoginMap from auth users
  const lastLoginMap = new Map<string, string | null>(
    authUsers.map((u) => [u.id, u.last_sign_in_at ?? null])
  );

  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const completed = allProjects.filter((p) => p.status === "completed");
  const stats = {
    workspaces:       allWorkspaces.filter((ws) => ws.role !== "admin").length,
    totalGenerations: completed.length,
    todayGenerations: completed.filter((p) => p.updated_at >= todayStart).length,
    monthGenerations: completed.filter((p) => p.updated_at >= monthStart).length,
  };

  // 7-day trend data
  const trendDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const count = completed.filter((p) => p.updated_at.slice(0, 10) === iso).length;
    return { label, count };
  });

  const clients = allWorkspaces.filter((ws) => ws.role !== "admin").map((ws) => {
    const wsCollections = allCollections.filter((c) => c.workspace_id === ws.id);
    const wsCompleted   = allProjects.filter((p) => p.workspace_id === ws.id && p.status === "completed");
    const wsToday       = wsCompleted.filter((p) => p.updated_at >= todayStart).length;
    const wsMonth       = wsCompleted.filter((p) => p.updated_at >= monthStart).length;
    const lastProject   = allProjects.filter((p) => p.workspace_id === ws.id)[0];
    const lastActivity  = lastProject?.updated_at ?? ws.updated_at;
    const recentOutput  = wsCompleted[0]?.output_image ?? null;

    // Per-workspace computed fields
    const wsFailed = allProjects.filter((p) => p.workspace_id === ws.id && p.status === "failed").length;
    const errorDenom = wsFailed + wsCompleted.length;
    const errorRate = errorDenom > 0 ? Math.round((wsFailed / errorDenom) * 100) : 0;

    const rawCost = wsCompleted.reduce((sum, p) => {
      return sum + (p.prompt_used?.startsWith("model-") ? 0.0012 : 0.00135);
    }, 0);
    const costUsd = formatCostWorkspace(rawCost);

    const ghostCount = wsCompleted.filter((p) => p.prompt_used !== null && !p.prompt_used.startsWith("model-")).length;
    const modelCount = wsCompleted.filter((p) => p.prompt_used !== null && p.prompt_used.startsWith("model-")).length;

    const hasOwnKey = !!(ws as WorkspaceRow).gemini_api_key;
    const lastLogin = lastLoginMap.get(ws.user_id) ?? null;
    const activeToday = wsToday > 0;

    return {
      ...ws,
      email:          userMap.get(ws.user_id) ?? "—",
      projectCount:   wsCollections.length,
      completedCount: wsCompleted.length,
      todayCount:     wsToday,
      monthCount:     wsMonth,
      lastActivity,
      recentOutput,
      errorRate,
      costUsd,
      ghostCount,
      modelCount,
      hasOwnKey,
      lastLogin,
      activeToday,
    };
  });

  // Total API cost across all workspaces
  const totalCostRaw = allProjects
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => {
      return sum + (p.prompt_used?.startsWith("model-") ? 0.0012 : 0.00135);
    }, 0);
  const totalCostFormatted = formatCostGlobal(totalCostRaw);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
              <Activity className="w-4.5 h-4.5 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">Admin irányítópult</h1>
          </div>
          <p className="text-gray-500 text-sm ml-12">Az összes ügyfél munkaterülete és felhasználói adatok</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {[
          { icon: Users,       label: "Ügyfelek",         value: stats.workspaces,        accent: "bg-blue-50 text-blue-600" },
          { icon: Image,       label: "Összes generálás",  value: stats.totalGenerations,  accent: "bg-emerald-50 text-emerald-600" },
          { icon: TrendingUp,  label: "Ma",               value: stats.todayGenerations,  accent: "bg-violet-50 text-violet-600" },
          { icon: Zap,         label: "Ezen a hónapon",   value: stats.monthGenerations,  accent: "bg-amber-50 text-amber-600" },
        ].map(({ icon: Icon, label, value, accent }) => (
          <Card key={label} className="p-5 border-gray-100 shadow-none">
            <div className={`w-9 h-9 rounded-xl ${accent} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Card>
        ))}
        {/* 5th card: total API cost */}
        <Card className="p-5 border-gray-100 shadow-none">
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalCostFormatted}</p>
          <p className="text-xs text-gray-500 mt-0.5">API költség</p>
        </Card>
      </div>

      <div className="mb-10">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">7 napos generálási trend</h2>
        <MiniTrendChart days={trendDays} />
      </div>

      <CreateWorkspaceForm />

      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-gray-900">Ügyfelek munkaterületei</h2>
        <span className="text-xs text-gray-400">{clients.length} munkaterület</span>
      </div>

      {clients.length === 0 ? (
        <Card className="border-gray-100 shadow-none">
          <div className="p-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Még nincsenek ügyfelek.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Card key={client.id} className="border-gray-100 shadow-none hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden">
              {/* Top accent */}
              <div className="h-1 w-full bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300 opacity-60" />

              <div className="p-5">
                {/* Avatar + identity */}
                <div className="flex items-start gap-3 mb-4">
                  {/* Avatar with active-today green dot */}
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-xl ${avatarColor(client.email)} flex items-center justify-center text-white text-sm font-bold`}>
                      {getInitials(client.email)}
                    </div>
                    {client.activeToday && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{client.email}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{client.name}</p>
                  </div>
                  <Badge className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border-0 shrink-0 ${client.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"}`}>
                    {client.role}
                  </Badge>
                  {client.hasOwnKey && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                      own key
                    </span>
                  )}
                </div>

                {/* Active modules */}
                <ModuleBadges modules={client.modules} />

                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: "Projektek", value: client.projectCount },
                    { label: "Elkészült", value: client.completedCount },
                    { label: "Ma", value: client.todayCount },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <p className="text-lg font-bold text-gray-900">{value}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Ghost/Model split + cost + error rate */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                    {client.ghostCount} ghost · {client.modelCount} modell
                  </span>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    {client.costUsd}
                  </span>
                  {client.errorRate > 0 && (
                    <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      {client.errorRate}% hiba
                    </span>
                  )}
                </div>

                {/* Last generation + last login */}
                <div className="flex flex-col gap-1 mb-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>Generálás: {formatHuDateTime(client.lastActivity)}</span>
                  </div>
                  {client.lastLogin && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <LogIn className="w-3 h-3" />
                      <span>Login: {formatHuDateTime(client.lastLogin)}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/workspace/${client.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs font-semibold gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5" />
                        Részletek
                        <ArrowRight className="w-3 h-3 ml-auto" />
                      </Button>
                    </Link>
                    <form action={enterWorkspace.bind(null, client.id)} className="flex-1">
                      <Button type="submit" size="sm" className="w-full h-8 text-xs font-semibold gap-1.5 bg-gray-900 hover:bg-gray-700 text-white">
                        <LogIn className="w-3.5 h-3.5" />
                        Belépés
                      </Button>
                    </form>
                  </div>
                  <DeleteWorkspaceButton workspaceId={client.id} workspaceName={client.name} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
