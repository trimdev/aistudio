import { StudioSidebar } from "@/components/layout/StudioSidebar";
import { getOrCreateWorkspace } from "@/lib/workspace";

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure workspace exists on every studio visit
  await getOrCreateWorkspace();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <StudioSidebar />
      <main className="flex-1 overflow-auto min-h-0">{children}</main>
    </div>
  );
}
