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
    <div className="flex min-h-screen bg-gray-50">
      <StudioSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
