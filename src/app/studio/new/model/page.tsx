"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModelStudioTool } from "@/components/studio/ModelStudioTool";
import { useSearchParams } from "next/navigation";

function ModelPage() {
  const searchParams = useSearchParams();
  const collectionId = searchParams.get("collectionId");
  const backHref = collectionId ? `/studio/projects/${collectionId}` : "/studio/new";

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="shrink-0 border-b border-gray-100 bg-white px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={backHref}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors mr-1">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold select-none">👗</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 leading-none">Model Photo Studio</h1>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-none">AI fashion lifestyle image generator</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          Blonde + Brunette
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ModelStudioTool collectionId={collectionId} />
      </div>
    </div>
  );
}

export default function ModelGenerationPage() {
  return (
    <Suspense>
      <ModelPage />
    </Suspense>
  );
}
