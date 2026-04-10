"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(null); setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (authError) { setError(authError.message); setLoading(false); return; }
    setDone(true); setLoading(false);
  };

  if (done) return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
        <p className="text-sm text-white/40 leading-relaxed">
          We sent a confirmation link to <strong className="text-white/60">{email}</strong>.
        </p>
        <Link href="/login">
          <Button variant="outline" className="mt-6 w-full border-white/10 text-white/60 bg-white/5 hover:bg-white/10">
            Back to sign in
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-white">Request access</h1>
          <p className="text-sm text-white/30 mt-1">Create your GhostStudio account</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/50 uppercase tracking-wider">Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@brand.com" disabled={loading}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-white/30 h-10 rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-white/50 uppercase tracking-wider">Password</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters" disabled={loading}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-white/30 h-10 rounded-lg" />
            </div>
            {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5"><p className="text-sm text-red-400">{error}</p></div>}
            <Button type="submit" disabled={loading} className="w-full h-10 bg-white text-black hover:bg-white/90 font-semibold rounded-lg mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account"}
            </Button>
          </form>
        </div>
        <p className="text-center text-xs text-white/20 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-white/40 hover:text-white/60 underline underline-offset-2">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
