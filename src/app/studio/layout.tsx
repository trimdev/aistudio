import { StudioSidebar } from "@/components/layout/StudioSidebar";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { getImpersonatedWorkspace } from "@/lib/workspace";
import { exitWorkspace } from "@/app/admin/actions";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure the current user's own workspace exists
  await getOrCreateWorkspace();

  // Check if admin is viewing another workspace
  const impersonated = await getImpersonatedWorkspace();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 flex-col">
      {/* Impersonation banner */}
      {impersonated && (
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-2.5 bg-amber-50 border-b border-amber-200 z-50">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Admin nézet — megtekintés: <span className="text-amber-950">{impersonated.name}</span></span>
            <span className="text-amber-500 font-normal text-xs">({impersonated.id.slice(0, 8)}…)</span>
          </div>
          <form action={exitWorkspace}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Vissza az adminhoz
            </button>
          </form>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <StudioSidebar />
        <main className="flex-1 overflow-auto min-h-0">{children}</main>
      </div>
    </div>
  );
}
