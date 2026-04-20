import { DesignModelTool } from "@/components/studio/DesignModelTool";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";

export default async function DesignModelPage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const workspace = await getEffectiveWorkspace();
  if (!workspace.modules?.includes("design-model")) redirect("/studio/new");

  const { collectionId } = await searchParams;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      <DesignModelTool collectionId={collectionId ?? null} />
    </div>
  );
}
