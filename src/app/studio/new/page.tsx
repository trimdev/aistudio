"use client";

import { useState } from "react";
import { GeneratorForm } from "@/components/studio/GeneratorForm";
import { GeneratorResult } from "@/components/studio/GeneratorResult";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { GhostMannequinResult } from "@/lib/ai/gemini";

export default function NewGenerationPage() {
  const [result, setResult] = useState<{ data: GhostMannequinResult; projectId: string } | null>(null);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">New generation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload 2-3 garment photos to create a ghost mannequin composite.
          </p>
        </div>
        {result && (
          <Button
            variant="outline"
            onClick={() => setResult(null)}
            className="gap-2 text-gray-600"
          >
            <RotateCcw className="w-4 h-4" /> New shot
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* Left: form (always visible so user can start a new one) */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-none">
          <h2 className="text-sm font-semibold text-gray-700 mb-5">1 — Upload & configure</h2>
          <GeneratorForm
            onResult={(data, projectId) => setResult({ data, projectId })}
          />
        </div>

        {/* Right: result */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-none min-h-64">
          <h2 className="text-sm font-semibold text-gray-700 mb-5">2 — Result</h2>
          {result ? (
            <GeneratorResult result={result.data} projectId={result.projectId} />
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-3">
                <span className="text-2xl">✨</span>
              </div>
              <p className="text-sm font-medium text-gray-500">Your result will appear here</p>
              <p className="text-xs text-gray-400 mt-1 max-w-52">
                Upload your garment photos and click Generate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
