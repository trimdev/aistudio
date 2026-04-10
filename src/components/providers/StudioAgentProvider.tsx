"use client";

import { usePathname } from "next/navigation";
import { OrchestratorAgent } from "@/components/studio/OrchestratorAgent";

export function StudioAgentProvider() {
  const pathname = usePathname();
  // On /studio/new, the GhostStudioTool renders its own agent with project context
  if (pathname.startsWith("/studio/new")) return null;
  return <OrchestratorAgent />;
}
