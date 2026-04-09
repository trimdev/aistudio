"use client";

import { GhostStudioTool } from "@/components/studio/GhostStudioTool";

export default function NewGenerationPage() {
  return (
    /**
     * Intentionally full-bleed — no padding wrapper.
     * The parent layout gives us a flex-1 <main> that fills the remaining
     * viewport beside the sidebar. We own the full height here.
     */
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 border-b border-gray-100 bg-white px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold select-none">👻</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 leading-none">
              Ghost Mannequin Studio
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-none">
              AI-powered invisible mannequin compositor
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Gemini 2.0 Flash
          </div>
        </div>
      </header>

      {/* 3-panel tool — fills remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <GhostStudioTool />
      </div>
    </div>
  );
}
