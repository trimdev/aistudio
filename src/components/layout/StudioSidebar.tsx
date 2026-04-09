"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Wand2,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/studio", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/studio/projects", icon: FolderOpen, label: "Projects" },
  { href: "/studio/new", icon: Wand2, label: "New Generation" },
  { href: "/studio/settings", icon: Settings, label: "Settings" },
];

export function StudioSidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <aside className="w-56 shrink-0 border-r border-gray-100 bg-white flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
            <span className="text-white text-xs font-bold">G</span>
          </div>
          <span className="font-semibold text-sm text-gray-900">GhostStudio</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active =
            href === "/studio"
              ? pathname === "/studio"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <UserButton
            appearance={{
              elements: { avatarBox: "w-8 h-8" },
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {user?.firstName || user?.emailAddresses[0]?.emailAddress}
            </p>
            <p className="text-[11px] text-gray-400 truncate">
              {user?.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
