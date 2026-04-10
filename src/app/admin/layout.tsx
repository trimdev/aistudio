import { StudioSidebar } from "@/components/layout/StudioSidebar";
import { getOrCreateWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getOrCreateWorkspace();

  if (!workspace || workspace.role !== "admin") {
    redirect("/studio");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <StudioSidebar />
      <main className="flex-1 overflow-auto min-h-0">{children}</main>
    </div>
  );
}
