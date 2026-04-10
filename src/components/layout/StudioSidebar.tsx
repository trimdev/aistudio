"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { LayoutDashboard, FolderOpen, Wand2, Settings, LogOut, ShieldCheck, BookOpen, Brain, ChevronDown, ChevronRight } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export function StudioSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [memories, setMemories] = useState<{ id: string; note: string }[]>([]);
  const [memoriesOpen, setMemoriesOpen] = useState(true);

  const NAV_ITEMS = [
    { href: "/studio",          icon: LayoutDashboard, label: t("nav_dashboard") },
    { href: "/studio/projects", icon: FolderOpen,      label: t("nav_projects")  },
    { href: "/studio/new",      icon: Wand2,           label: t("nav_new")       },
    { href: "/studio/settings", icon: Settings,        label: t("nav_settings")  },
    ...(isAdmin ? [
      { href: "/studio/memory", icon: BookOpen,   label: t("nav_memory") },
      { href: "/admin",         icon: ShieldCheck, label: t("nav_admin")  },
    ] : []),
  ];

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("role")
          .eq("user_id", data.user.id)
          .single();
        setIsAdmin(ws?.role === "admin");
      }
      fetch("/api/workspace-memory")
        .then((r) => r.json())
        .then((d) => { if (d.memories) setMemories(d.memories); })
        .catch(() => {});
    })();
  }, []);

  const handleSignOut = () => {
    // Navigate immediately — don't wait for signOut round-trip
    router.push("/login");
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.signOut();
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] || "—";

  const initials = displayName.slice(0, 2).toUpperCase();

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
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === "/studio" ? pathname === "/studio" : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors",
                active ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
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
            {memoriesOpen
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />}
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
