import { FurnitureLifestyleTool } from "@/components/furniture/FurnitureLifestyleTool";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";

export default async function FurnitureLifestylePage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string; ghostProjectId?: string }>;
}) {
  const workspace = await getEffectiveWorkspace();
  if (!workspace.modules?.includes("furniture")) redirect("/studio/new");

  const { collectionId, ghostProjectId } = await searchParams;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0">
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Furniture Studio</p>
        <h1 className="text-lg font-bold text-gray-950 mt-0.5">Életkép</h1>
        <p className="text-xs text-gray-400 mt-0.5">Bútor elhelyezése fotórealisztikus szobai és szabadtéri környezetben</p>
      </div>
      <div className="flex-1 min-h-0">
        <FurnitureLifestyleTool
          collectionId={collectionId ?? null}
          ghostProjectId={ghostProjectId ?? null}
        />
      </div>
    </div>
  );
}
