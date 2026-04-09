"use client";

import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { GhostMannequinResult } from "@/lib/ai/gemini";

interface GeneratorResultProps {
  result: GhostMannequinResult;
  projectId: string;
}

export function GeneratorResult({ result, projectId }: GeneratorResultProps) {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Success banner */}
      <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-800">Analysis complete!</p>
          <p className="text-xs text-green-600 mt-0.5">
            Your ghost mannequin composite prompt is ready.
          </p>
        </div>
      </div>

      {/* Garment description */}
      <Card className="border-gray-100 shadow-none p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Garment detected
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed">{result.garment_description}</p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {result.detected_angles.map((angle) => (
            <Badge key={angle} variant="secondary" className="text-xs capitalize">
              {angle}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Composite prompt */}
      <Card className="border-gray-100 shadow-none p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Image generation prompt
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-gray-500 gap-1"
            onClick={() => copy(result.composite_prompt)}
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed font-mono bg-gray-50 rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">
          {result.composite_prompt}
        </p>
      </Card>

      {/* Quality notes */}
      {result.quality_notes && (
        <Card className="border-gray-100 shadow-none p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Quality notes
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">{result.quality_notes}</p>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => copy(result.composite_prompt)}
        >
          <Copy className="w-4 h-4" /> Copy prompt
        </Button>
        <a href={`/studio/projects`} className="flex-1">
          <Button className="w-full bg-gray-900 text-white hover:bg-gray-700 gap-2">
            <ExternalLink className="w-4 h-4" /> View in projects
          </Button>
        </a>
      </div>
    </div>
  );
}
