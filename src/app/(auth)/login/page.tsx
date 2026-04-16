"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useAnimationFrame } from "framer-motion";

// ─── ShinyText ────────────────────────────────────────────────────────────────

function ShinyText({ text }: { text: string }) {
  const progressRef = useRef(0);
  const [bgPos, setBgPos] = useState("200% center");

  useAnimationFrame((t) => {
    progressRef.current = (t % 3000) / 3000;
    const pos = 200 - progressRef.current * 300;
    setBgPos(`${pos}% center`);
  });

  return (
    <span
      style={{
        backgroundImage:
          "linear-gradient(100deg, #64CEFB 0%, #64CEFB 35%, #ffffff 50%, #64CEFB 65%, #64CEFB 100%)",
        backgroundSize: "200% auto",
        backgroundPosition: bgPos,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        display: "inline-block",
        paddingBottom: "0.15em",
      }}
    >
      {text}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    document.title = "AI Studió";
    if (typeof window !== "undefined" && navigator.credentials?.get) {
      navigator.credentials
        .get({ password: true, mediation: "optional" } as CredentialRequestOptions)
        .then((cred) => {
          if (cred && cred.type === "password") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setEmail((cred as any).id ?? "");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setPassword((cred as any).password ?? "");
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: authError, data } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }

    if (typeof window !== "undefined" && "PasswordCredential" in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cred = new (window as any).PasswordCredential({ id: email, password });
        await navigator.credentials.store(cred);
      } catch { /* non-critical */ }
    }

    try {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("role")
        .eq("user_id", data.user?.id ?? "")
        .single();
      if (!rememberMe) {
        sessionStorage.setItem("gs-temp-session", "1");
        localStorage.setItem("gs-temp-user", "1");
      } else {
        localStorage.removeItem("gs-temp-user");
        sessionStorage.removeItem("gs-temp-session");
      }
      router.push(ws?.role === "admin" ? "/admin" : "/studio");
    } catch {
      if (!rememberMe) {
        sessionStorage.setItem("gs-temp-session", "1");
        localStorage.setItem("gs-temp-user", "1");
      }
      router.push("/studio");
    }
    router.refresh();
  };

  return (
    <div className="relative h-screen overflow-hidden bg-black font-sans">

      {/* ── Video background ─────────────────────────────────────────────── */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-black/50" />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex h-full items-center justify-center px-4">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-16 w-full max-w-5xl">

          {/* Heading */}
          <h1
            className="text-5xl sm:text-6xl md:text-7xl xl:text-8xl font-medium tracking-tighter text-center lg:text-left"
            style={{ lineHeight: 0.95 }}
          >
            <span className="text-white block">AI Studio</span>
            <span className="block">
              <ShinyText text="4 Everyone." />
            </span>
          </h1>

          {/* Login card */}
          <div className="w-full max-w-sm shrink-0">
            <div className="rounded-[28px] border border-white/10 bg-white/10 backdrop-blur-xl p-7 shadow-[0_32px_80px_rgba(0,0,0,0.4)]">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white">{t("login_title")}</h2>
                <p className="mt-1 text-sm font-medium text-white/60">{t("login_subtitle")}</p>
              </div>

              <form onSubmit={handleSubmit} autoComplete="on" className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-bold tracking-wider text-white/50 uppercase">
                    {t("login_email")}
                  </Label>
                  <Input
                    id="email" name="email" type="email" autoComplete="username" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@brand.com" disabled={loading}
                    className="h-11 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/30 text-sm font-medium focus-visible:ring-white/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-bold tracking-wider text-white/50 uppercase">
                    {t("login_password")}
                  </Label>
                  <Input
                    id="password" name="password" type="password" autoComplete="current-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" disabled={loading}
                    className="h-11 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/30 text-sm font-medium focus-visible:ring-white/30"
                  />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="h-4 w-4 rounded border-white/30 accent-white"
                  />
                  <span className="text-sm font-medium text-white/60">{t("login_remember")}</span>
                </label>
                {error && (
                  <div className="rounded-xl border border-red-400/30 bg-red-500/20 px-3 py-2.5">
                    <p className="text-sm font-medium text-red-300">{error}</p>
                  </div>
                )}
                <Button
                  type="submit" disabled={loading}
                  className="mt-1 h-11 w-full rounded-xl bg-white text-sm font-bold text-black hover:bg-white/90"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("login_btn")}
                </Button>
              </form>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
