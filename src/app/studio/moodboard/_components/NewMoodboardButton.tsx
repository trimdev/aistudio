"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

export function NewMoodboardButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/moodboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Új Moodboard" }),
      });
      const data = (await res.json()) as { moodboard: { id: string } };
      router.push(`/studio/moodboard/${data.moodboard.id}`);
    } catch {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCreate}
      disabled={loading}
      className="bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold gap-2"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Plus className="w-4 h-4" />
      )}
      Új Moodboard
    </Button>
  );
}
