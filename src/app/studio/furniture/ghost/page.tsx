import { FurnitureGhostTool } from "@/components/furniture/FurnitureGhostTool";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";

export default async function FurnitureGhostPage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const workspace = await getEffectiveWorkspace();
  if (!workspace.modules?.includes("furniture")) redirect("/studio/new");

  const { collectionId } = await searchParams;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0">
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase">Furniture Studio</p>
        <h1 className="text-lg font-bold text-gray-950 mt-0.5">Termékkép</h1>
        <p className="text-xs text-gray-400 mt-0.5">Fehér hátteres, professzionális termékkép a bútorodról</p>
      </div>
      <div className="flex-1 min-h-0">
        <FurnitureGhostTool collectionId={collectionId ?? null} />
      </div>
    </div>
  );
}
