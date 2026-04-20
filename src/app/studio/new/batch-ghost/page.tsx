"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BatchGhostStudioTool } from "@/components/studio/BatchGhostStudioTool";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BatchGhostPage() {
  const searchParams = useSearchParams();
  const collectionId = searchParams.get("collectionId");
  const backHref = collectionId ? `/studio/projects/${collectionId}` : "/studio/projects";

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="shrink-0 border-b border-gray-100 bg-white px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={backHref}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors mr-1">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="relative w-10 h-9">
            <div className="absolute w-7 h-7 rounded-lg bg-gray-300 flex items-center justify-center" style={{ top: -2, left: 10 }}>
              <span className="text-[9px] select-none opacity-60">👻</span>
            </div>
            <div className="absolute w-7 h-7 rounded-lg bg-gray-500 flex items-center justify-center" style={{ top: 1, left: 5 }}>
              <span className="text-[9px] select-none opacity-80">👻</span>
            </div>
            <div className="absolute w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center" style={{ top: 4, left: 0 }}>
              <span className="text-white text-xs font-bold select-none">👻</span>
            </div>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 leading-none">Tömeges Ghost Mannequin</h1>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-none">Mappa alapú köteges feldolgozás</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          AI Studio
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">
        <BatchGhostStudioTool collectionId={collectionId} />
      </div>
    </div>
  );
}

export default function BatchGhostGenerationPage() {
  return (
    <Suspense>
      <BatchGhostPage />
    </Suspense>
  );
}
