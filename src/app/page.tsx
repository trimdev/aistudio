import Link from "next/link";
import { ArrowRight, Zap, Shield, Layers, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: Zap,
    title: "Seconds, not hours",
    description:
      "Upload 2-3 garment photos and get a studio-quality ghost mannequin composite in under 30 seconds.",
  },
  {
    icon: Layers,
    title: "Front, Back & Interior",
    description:
      "Our AI blends your front, back, and interior shots into a seamless invisible mannequin silhouette.",
  },
  {
    icon: Shield,
    title: "Your data stays yours",
    description:
      "Every client workspace is fully isolated. Your photos and generations are never shared.",
  },
];

const STEPS = [
  { number: "01", title: "Upload garment photos", body: "Drop 2-3 images: front, back, and optionally the interior label." },
  { number: "02", title: "AI composites the shot", body: "Gemini analyses angles, textures, and shadows to plan the perfect composite." },
  { number: "03", title: "Download & publish", body: "Get a clean, white-background product image ready for your store." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold">G</span>
          </div>
          <span className="font-semibold text-gray-900">GhostStudio</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-gray-900 text-white hover:bg-gray-700">
              Get started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge variant="secondary" className="mb-6 text-xs font-medium px-3 py-1">
          Powered by Gemini 2.5 Flash
        </Badge>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-gray-900 leading-tight max-w-3xl mx-auto">
          Ghost mannequin shots.{" "}
          <span className="text-gray-400">In seconds.</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
          Upload 2-3 garment photos and watch our AI generate perfect, studio-quality
          ghost mannequin product images — no Photoshop required.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg" className="bg-gray-900 text-white hover:bg-gray-700 h-12 px-8 gap-2">
              Start for free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="h-12 px-8">
              Sign in to your studio
            </Button>
          </Link>
        </div>

        {/* Hero visual placeholder */}
        <div className="mt-16 rounded-2xl border border-gray-100 bg-gray-50 h-80 flex items-center justify-center shadow-sm">
          <div className="text-center text-gray-400">
            <div className="flex gap-6 items-center justify-center">
              {["Front", "Back", "Interior"].map((label) => (
                <div
                  key={label}
                  className="w-24 h-32 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-xs font-medium text-gray-400"
                >
                  {label}
                </div>
              ))}
              <div className="text-2xl text-gray-300">→</div>
              <div className="w-36 h-44 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center text-xs font-medium text-gray-500 shadow-md">
                Ghost shot ✨
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-y border-gray-100 bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
            <span className="ml-1 font-medium text-gray-700">4.9/5</span>
          </div>
          <span className="text-gray-300 hidden sm:block">|</span>
          <span>Trusted by <strong className="text-gray-700">500+</strong> fashion brands</span>
          <span className="text-gray-300 hidden sm:block">|</span>
          <span>Over <strong className="text-gray-700">50k</strong> ghost shots generated</span>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-semibold text-center text-gray-900 mb-16">
          Everything you need for perfect product shots
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-semibold text-center text-gray-900 mb-16">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map(({ number, title, body }) => (
              <div key={number} className="relative">
                <span className="text-6xl font-bold text-gray-100 absolute -top-4 left-0 select-none">
                  {number}
                </span>
                <div className="pt-8">
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="bg-gray-900 rounded-3xl py-20 px-8">
          <h2 className="text-3xl font-semibold text-white mb-4">
            Ready to transform your product shots?
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Join thousands of fashion brands using GhostStudio to create
            studio-quality imagery at a fraction of the cost.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 h-12 px-8 gap-2">
              Start for free <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">G</span>
            </div>
            <span>GhostStudio</span>
          </div>
          <p>© {new Date().getFullYear()} GhostStudio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
