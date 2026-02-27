"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Network,
  Mic,
  Settings,
  Radar,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  BookOpen,
  Radar as RadarIcon,
  LogOut,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: Briefcase },
  { href: "/study", label: "Study Plan", icon: BookOpen },
  { href: "/interviews", label: "Interviews", icon: Mic },
  { href: "/skills", label: "Skill Graph", icon: Network },
  { href: "/sharehub", label: "Job Scout", icon: RadarIcon },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/";
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-700 flex flex-col z-50 transition-all duration-300 ${collapsed ? "w-16" : "w-56"
        }`}
    >
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-2 px-4 py-5 border-b border-slate-700 hover:opacity-80 transition-opacity"
      >
        <Radar className="w-7 h-7 text-indigo-400 flex-shrink-0" />
        {!collapsed && (
          <span className="text-lg font-bold text-white tracking-tight">
            CareerAdvocate
          </span>
        )}
      </Link>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: logout + collapse */}
      <div className="border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-5 py-3 text-sm text-slate-500 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 border-t border-slate-700/50 text-slate-400 hover:text-white transition-colors w-full"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 mx-auto" />
          ) : (
            <ChevronLeft className="w-4 h-4 mx-auto" />
          )}
        </button>
      </div>
    </aside>
  );
}
