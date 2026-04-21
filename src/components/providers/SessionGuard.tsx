"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Signs the user out if they had logged in without "Remember me"
 * and then closed all browser tabs (sessionStorage was cleared).
 */
export function SessionGuard() {
  const router = useRouter();

  useEffect(() => {
    const wasTemp = localStorage.getItem("gs-temp-user");
    const stillActive = sessionStorage.getItem("gs-temp-session");

    if (wasTemp && !stillActive) {
      localStorage.removeItem("gs-temp-user");
      const supabase = getSupabaseBrowserClient();
      supabase.auth.signOut().then(() => router.push("/login"));
    } else if (wasTemp && stillActive) {
      // Refresh sessionStorage marker (survives navigation within the session)
      sessionStorage.setItem("gs-temp-session", "1");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
