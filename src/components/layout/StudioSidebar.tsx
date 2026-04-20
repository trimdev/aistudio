"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  LayoutDashboard, FolderOpen, Settings, LogOut,
  ShieldCheck, BookOpen, Brain, ChevronDown, ChevronRight,
  Ghost, User, Sofa, Home, LayoutGrid, Layers, Palette, Film,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
}

interface NavSection {
  id: string;
  label?: string;
  accent?: string; // tailwind text colour for dot
  items: NavItem[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StudioSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [modules, setModules] = useState<string[]>([]);
  const [memories, setMemories] = useState<{ id: string; note: string }[]>([]);
  const [memoriesOpen, setMemoriesOpen] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("role, modules")
          .eq("user_id", data.user.id)
          .single();
        const isAdminUser = ws?.role === "admin";
        setIsAdmin(isAdminUser);
        // Admins see ALL modules regardless of their workspace config
        setModules(
          isAdminUser
            ? ["fashion", "ghost", "model", "design-model", "video", "furniture", "moodboard"]
            : ws?.modules ?? []
        );
      }
      fetch("/api/workspace-memory")
        .then((r) => r.json())
        .then((d) => { if (d.memories) setMemories(d.memories); })
        .catch(() => {});
    })();
  }, []);

  const hasFashion     = modules.includes("fashion");
  const hasGhost       = modules.includes("ghost");
  const hasModel       = modules.includes("model");
  const hasDesignModel = modules.includes("design-model");
  const hasVideo       = modules.includes("video");
  const hasFurniture   = modules.includes("furniture");
  const hasMoodboard   = modules.includes("moodboard");

  // Build section list dynamically based on enabled modules
  const sections: NavSection[] = [
    {
      id: "core",
      items: [
        { href: "/studio",          icon: LayoutDashboard, label: t("nav_dashboard"), exact: true },
        { href: "/studio/projects", icon: FolderOpen,      label: t("nav_projects") },
      ],
    },
  ];

  if (hasFashion) {
    sections.push({
      id: "fashion",
      label: "Fashion",
      accent: "bg-gray-400",
      items: [
        ...(hasGhost  ? [
          { href: "/studio/new/ghost",       icon: Ghost,  label: "Ghost fotó" },
          { href: "/studio/new/batch-ghost", icon: Layers, label: "Tömeges Ghost fotó" },
        ] : []),
        ...(hasModel  ? [{ href: "/studio/new/model",        icon: User,    label: "Modell fotó" }] : []),
        ...(hasDesignModel ? [{ href: "/studio/new/design-model", icon: Palette, label: "Design Modell fotó" }] : []),
        ...(hasVideo ? [{ href: "/studio/new/video", icon: Film, label: "Fashion Videó" }] : []),
      ],
    });
  }

  if (hasFurniture) {
    sections.push({
      id: "furniture",
      label: "Furniture",
      accent: "bg-amber-400",
      items: [
        { href: "/studio/furniture/ghost",     icon: Sofa,      label: "Termékkép" },
        { href: "/studio/furniture/lifestyle", icon: Home,      label: "Életkép"   },
      ],
    });
  }

  if (hasMoodboard) {
    sections.push({
      id: "moodboard",
      label: "Moodboard",
      accent: "bg-teal-400",
      items: [
        { href: "/studio/moodboard", icon: LayoutGrid, label: "Moodboard" },
      ],
    });
  }

  sections.push({
    id: "system",
    items: [
      { href: "/studio/settings", icon: Settings, label: t("nav_settings") },
      ...(isAdmin ? [
        { href: "/studio/memory", icon: BookOpen,   label: t("nav_memory") },
        { href: "/admin",         icon: ShieldCheck, label: t("nav_admin")  },
      ] : []),
    ],
  });

  const handleSignOut = () => {
    router.push("/login");
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.signOut();
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] || "—";

  const initials = displayName.slice(0, 2).toUpperCase();

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/") || pathname.startsWith(item.href + "?");
  }

  return (
    <aside className="w-56 shrink-0 border-r border-gray-100 bg-white flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold">G</span>
          </div>
          <span className="font-bold text-sm text-gray-900">GhostStudio</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.id}>
            {section.label && (
              <div className="flex items-center gap-2 px-2 mb-1">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", section.accent)} />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{section.label}</span>
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                      active
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Memória */}
      {memories.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setMemoriesOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
          >
            <Brain className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left">Memória</span>
            {memoriesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          {memoriesOpen && (
            <ul className="px-3 pb-3 space-y-1.5 max-h-52 overflow-y-auto">
              {memories.map((m) => (
                <li key={m.id} className="flex items-start gap-1.5 text-[11px] text-gray-600 leading-relaxed bg-gray-50 rounded-lg px-2.5 py-1.5">
                  <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                  <span>{m.note}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Language switcher */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          {(["en", "hu"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs font-bold transition-all",
                lang === l ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            {user?.user_metadata?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.user_metadata.avatar_url} alt={displayName}
                className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-gray-600">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button onClick={handleSignOut} title="Sign out"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
