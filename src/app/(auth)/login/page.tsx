"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "AI Studió";

    // Ask browser to autofill saved credentials on page load
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

    // Ask the browser to save the credentials
    if (typeof window !== "undefined" && "PasswordCredential" in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cred = new (window as any).PasswordCredential({ id: email, password });
        await navigator.credentials.store(cred);
      } catch {
        // non-critical, ignore
      }
    }

    // Check workspace role to decide where to redirect
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
      if (ws?.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/studio");
      }
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
    <div className="relative h-screen overflow-hidden flex flex-col items-center justify-center bg-white">
      {/* ── Animated background ─────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* GPU-accelerated gradient orbs */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
        <div className="orb orb-5" />

        {/* White vignette — fades center, lets corners show colour */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.60) 50%, rgba(255,255,255,0.20) 100%)",
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,23,42,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,0.05) 1px,transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0.15))",
          }}
        />
      </div>

      {/* Language toggle */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/80 p-1 shadow-lg backdrop-blur-md">
        {(["hu", "en"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              lang === l ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full flex-col items-center px-4">
        <h1
          className="-mt-20 mb-[100px] text-center font-extrabold leading-[0.95] tracking-[-0.05em] text-slate-950 md:-mt-28"
          style={{ fontSize: "clamp(2.6rem,5.5vw,4.8rem)" }}
        >
          AI Studió
        </h1>

        {/* Login card */}
        <div className="w-full max-w-sm">
          <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-7 shadow-[0_32px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-950">{t("login_title")}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">{t("login_subtitle")}</p>
            </div>

            <form onSubmit={handleSubmit} autoComplete="on" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  {t("login_email")}
                </Label>
                <Input
                  id="email" name="email" type="email" autoComplete="username" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@brand.com" disabled={loading}
                  className="h-11 rounded-xl border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 text-sm font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  {t("login_password")}
                </Label>
                <Input
                  id="password" name="password" type="password" autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" disabled={loading}
                  className="h-11 rounded-xl border-slate-200 bg-white text-slate-950 placeholder:text-slate-400 text-sm font-medium"
                />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-950"
                />
                <span className="text-sm font-medium text-slate-600">{t("login_remember")}</span>
              </label>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-sm font-medium text-red-600">{error}</p>
                </div>
              )}
              <Button
                type="submit" disabled={loading}
                className="mt-1 h-11 w-full rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("login_btn")}
              </Button>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        .orb {
          position: absolute;
          border-radius: 50%;
          mix-blend-mode: multiply;
          filter: blur(60px);
          will-change: transform;
          opacity: 0;
          animation-fill-mode: forwards;
        }

        /* Orb 1 — warm orange, bottom-left */
        .orb-1 {
          width: 55vw; height: 55vw;
          background: radial-gradient(circle, rgba(255,126,69,0.72) 0%, transparent 70%);
          bottom: -10%; left: -10%;
          animation: orbFadeIn 0.6s ease-out 0.05s forwards, orb1Drift 22s ease-in-out 0.65s infinite alternate;
        }
        /* Orb 2 — pink, left-center */
        .orb-2 {
          width: 45vw; height: 45vw;
          background: radial-gradient(circle, rgba(255,79,146,0.60) 0%, transparent 70%);
          top: 20%; left: 5%;
          animation: orbFadeIn 0.6s ease-out 0.1s forwards, orb2Drift 18s ease-in-out 0.7s infinite alternate;
        }
        /* Orb 3 — violet, center */
        .orb-3 {
          width: 40vw; height: 40vw;
          background: radial-gradient(circle, rgba(120,89,255,0.52) 0%, transparent 70%);
          top: 15%; left: 30%;
          animation: orbFadeIn 0.6s ease-out 0.15s forwards, orb3Drift 20s ease-in-out 0.75s infinite alternate;
        }
        /* Orb 4 — cyan, right */
        .orb-4 {
          width: 50vw; height: 50vw;
          background: radial-gradient(circle, rgba(46,184,255,0.50) 0%, transparent 70%);
          top: 10%; right: -5%;
          animation: orbFadeIn 0.6s ease-out 0.2s forwards, orb4Drift 25s ease-in-out 0.8s infinite alternate;
        }
        /* Orb 5 — emerald, top-right */
        .orb-5 {
          width: 38vw; height: 38vw;
          background: radial-gradient(circle, rgba(57,239,182,0.44) 0%, transparent 70%);
          top: -8%; right: 10%;
          animation: orbFadeIn 0.6s ease-out 0.25s forwards, orb5Drift 16s ease-in-out 0.85s infinite alternate;
        }

        @keyframes orbFadeIn {
          to { opacity: 1; }
        }

        @keyframes orb1Drift {
          0%   { transform: translate3d(0%, 0%, 0) scale(1.00); }
          100% { transform: translate3d(6%, -8%, 0) scale(1.12); }
        }
        @keyframes orb2Drift {
          0%   { transform: translate3d(0%, 0%, 0) scale(1.00); }
          100% { transform: translate3d(8%, 6%, 0) scale(1.08); }
        }
        @keyframes orb3Drift {
          0%   { transform: translate3d(0%, 0%, 0) scale(1.00); }
          100% { transform: translate3d(-5%, 10%, 0) scale(1.10); }
        }
        @keyframes orb4Drift {
          0%   { transform: translate3d(0%, 0%, 0) scale(1.00); }
          100% { transform: translate3d(-8%, 6%, 0) scale(1.06); }
        }
        @keyframes orb5Drift {
          0%   { transform: translate3d(0%, 0%, 0) scale(1.00); }
          100% { transform: translate3d(-6%, 12%, 0) scale(1.14); }
        }
      `}</style>
    </div>
  );
}
