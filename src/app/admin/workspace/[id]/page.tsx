import { createSupabaseAdminClient, getServerUser } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, FolderOpen, Clock, Image as ImageIcon,
  Zap, TrendingUp, CheckCircle2, XCircle, Loader2, Package,
} from "lucide-react";
import { setWorkspaceModules } from "@/app/admin/actions";

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  created_at: string;
  output_image: string | null;
  input_images: string[];
  model_used: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
  user_id: string;
  role: string;
  created_at: string;
  modules: string[] | null;
}

const statusMeta: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  completed: { label: "Elkészült",    cls: "bg-green-100 text-green-700",  Icon: CheckCircle2 },
  processing: { label: "Folyamatban", cls: "bg-yellow-100 text-yellow-700", Icon: Loader2 },
  failed:     { label: "Sikertelen",  cls: "bg-red-100 text-red-700",      Icon: XCircle },
  pending:    { label: "Függőben",    cls: "bg-gray-100 text-gray-500",    Icon: Clock },
};

function formatHuDateTime(d: string) {
  const date = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function getSignedThumb(supabase: ReturnType<typeof createSupabaseAdminClient>, path: string | null, bucket: string): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600, {
    transform: {
      width: 320,
      height: 240,
      resize: "contain",
      quality: 72,
    },
  });
  return data?.signedUrl ?? null;
}

export default async function AdminWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getServerUser();
  if (!user) redirect("/login");

  const myWorkspace = await getWorkspace();
  if (!myWorkspace || myWorkspace.role !== "admin") redirect("/studio");

  const supabase = createSupabaseAdminClient();

  // Fetch the target workspace
  const { data: wsData } = await supabase
    .from("workspaces")
    .select("id, name, user_id, role, created_at, modules")
    .eq("id", id)
    .single();

  if (!wsData) notFound();
  const ws = wsData as WorkspaceRow;

  // Get user email
  const { data: { user: wsUser } } = await supabase.auth.admin.getUserById(ws.user_id);
  const email = wsUser?.email ?? "—";
  const createdAt = wsUser?.created_at ?? ws.created_at;

  // Projects
  const { data: projectsData } = await supabase
    .from("projects")
    .select("id, workspace_id, name, status, created_at, output_image, input_images, model_used")
    .eq("workspace_id", id)
    .order("created_at", { ascending: false });

  const projects = (projectsData ?? []) as ProjectRow[];
  const completed = projects.filter((p) => p.status === "completed");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const stats = {
    total: projects.length,
    completed: completed.length,
    today: completed.filter((p) => p.created_at >= todayStart).length,
    month: completed.filter((p) => p.created_at >= monthStart).length,
  };

  // Get signed thumbnail URLs for the first few completed projects
  const projectsWithUrls = await Promise.all(
    projects.map(async (p) => ({
      ...p,
      outputUrl: await getSignedThumb(supabase, p.output_image, "ghost-outputs"),
    }))
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Admin irányítópult
      </Link>

      {/* ── Workspace header card ─────────────────────────────────────── */}
      <Card className="border-gray-100 shadow-none mb-8 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300" />
        <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center shrink-0">
            <span className="text-white text-xl font-bold">
              {email[0]?.toUpperCase() ?? "?"}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900">{email}</h1>
              <Badge className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border-0 ${ws.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"}`}>
                {ws.role}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{ws.name}</p>
            <p className="text-xs text-gray-400 mt-1 font-mono">{ws.id}</p>
          </div>

          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">Regisztrált</p>
            <p className="text-sm font-medium text-gray-700 mt-0.5">{formatHuDateTime(createdAt)}</p>
          </div>
        </div>
      </Card>

      {/* ── Usage stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: FolderOpen, label: "Összes projekt",  value: stats.total,    accent: "bg-blue-50 text-blue-600" },
          { icon: ImageIcon,  label: "Elkészült képek", value: stats.completed, accent: "bg-green-50 text-green-600" },
          { icon: TrendingUp, label: "Ma",              value: stats.today,    accent: "bg-violet-50 text-violet-600" },
          { icon: Zap,        label: "Ezen a hónapon",  value: stats.month,    accent: "bg-amber-50 text-amber-600" },
        ].map(({ icon: Icon, label, value, accent }) => (
          <Card key={label} className="p-5 border-gray-100 shadow-none">
            <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* ── Modules card ─────────────────────────────────────────────────── */}
      <Card className="border-gray-100 shadow-none mb-8 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-gray-900">Elérhető modulok</h2>
          </div>

          <form
            action={async (formData: FormData) => {
              "use server";
              const selected = formData.getAll("modules") as string[];
              await setWorkspaceModules(ws.id, selected);
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {([
                {
                  id: "fashion",
                  label: "Fashion Studio",
                  desc: "Ghost Mannequin + Model Photos",
                  emoji: "👗",
                  accent: "border-violet-200 bg-violet-50",
                  check: "accent-violet-600",
                },
                {
                  id: "furniture",
                  label: "Furniture Studio",
                  desc: "Lifestyle placement photos",
                  emoji: "🛋️",
                  accent: "border-amber-200 bg-amber-50",
                  check: "accent-amber-600",
                },
              ] as const).map(({ id, label, desc, emoji, accent, check }) => {
                const enabled = (ws.modules ?? ["fashion"]).includes(id);
                return (
                  <label
                    key={id}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                      enabled ? accent : "border-gray-100 bg-gray-50 opacity-60"
                    )}
                  >
                    <input
                      type="checkbox"
                      name="modules"
                      value={id}
                      defaultChecked={enabled}
                      className={cn("h-4 w-4 rounded", check)}
                    />
                    <span className="text-xl leading-none">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            <Button type="submit" size="sm" className="bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold h-8 px-4">
              Modulok mentése
            </Button>
          </form>
        </div>
      </Card>

      {/* ── Projects list ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Projektek</h2>
        <span className="text-xs text-gray-400">{projects.length} db · olvasható nézet</span>
      </div>

      {projectsWithUrls.length === 0 ? (
        <Card className="border-gray-100 shadow-none">
          <div className="p-16 text-center">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Ennek a felhasználónak még nincsenek projektjei.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projectsWithUrls.map((project) => {
            const meta = statusMeta[project.status] ?? statusMeta.pending;
            return (
              <Card key={project.id} className="border-gray-100 shadow-none overflow-hidden">
                {/* Output image thumbnail */}
                <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
                  {project.outputUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.outputUrl}
                      alt={project.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-gray-200" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <Badge className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border-0 ${meta.cls}`}>
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2 text-[11px] text-gray-500 bg-white/90 rounded-full px-2 py-0.5 font-mono">
                    final only
                  </div>
                </div>

                <div className="p-4">
                  <p className="font-semibold text-sm text-gray-900 truncate">{project.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">{formatHuDateTime(project.created_at)}</p>
                    <p className="text-[11px] text-gray-400 font-mono truncate ml-2">{project.model_used}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
