import { VideoGenerationTool } from "@/components/studio/VideoGenerationTool";
import { getEffectiveWorkspace } from "@/lib/workspace";
import { redirect } from "next/navigation";

export default async function VideoGenerationPage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const workspace = await getEffectiveWorkspace();
  if (!workspace.modules?.includes("video" as never)) redirect("/studio/new");

  const { collectionId } = await searchParams;

  // Video requires a project folder — redirect to projects if no collectionId
  if (!collectionId) redirect("/studio/projects");

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh" }}>
      <VideoGenerationTool collectionId={collectionId} />
    </div>
  );
}
