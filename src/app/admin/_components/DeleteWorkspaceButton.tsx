"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteWorkspace } from "../actions";
import { toast } from "sonner";

interface Props {
  workspaceId: string;
  workspaceName: string;
}

export function DeleteWorkspaceButton({ workspaceId, workspaceName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped]           = useState("");
  const [pending, startTransition]  = useTransition();

  const match = typed.trim() === workspaceName.trim();

  function reset() {
    setConfirming(false);
    setTyped("");
  }

  if (confirming) {
    return (
      <div className="mt-1 p-3 rounded-xl border border-red-200 bg-red-50 space-y-2">
        <p className="text-[11px] text-red-700 font-semibold flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          A megerősítéshez írd be: <span className="font-mono bg-red-100 px-1 rounded">{workspaceName}</span>
        </p>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") reset(); }}
          placeholder={workspaceName}
          className="w-full h-8 px-2.5 text-xs border border-red-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-400 font-mono"
          disabled={pending}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white gap-1 disabled:opacity-40"
            disabled={!match || pending}
            onClick={() => {
              startTransition(async () => {
                const result = await deleteWorkspace(workspaceId);
                if (result.error) {
                  toast.error(result.error);
                  reset();
                } else {
                  toast.success(`„${workspaceName}" törölve.`);
                }
              });
            }}
          >
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Végleges törlés
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs font-semibold"
            disabled={pending}
            onClick={reset}
          >
            Mégse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 px-3 text-xs font-semibold text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-600 gap-1.5 w-full"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="w-3.5 h-3.5" />
      Munkaterület törlése
    </Button>
  );
}
