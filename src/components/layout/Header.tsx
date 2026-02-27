"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SystemHealth } from "@/lib/types";
import { Activity, Circle } from "lucide-react";

interface Props {
  health: SystemHealth;
}

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/study", label: "Study Plan" },
  { href: "/resume", label: "Resume" },
  { href: "/interviews", label: "Interviews" },
  { href: "/skills", label: "Skills" },
  { href: "/sharehub", label: "Job Scout" },
  { href: "/settings", label: "Settings" },
];

export default function Header({ health }: Props) {
  const pathname = usePathname();

  return (
    <header className="h-14 bg-slate-900/80 backdrop-blur border-b border-slate-700 flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <h1 className="text-sm font-medium text-slate-300">
          Career Advocate
        </h1>
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${pathname === link.href
                ? "bg-indigo-500/15 text-indigo-400"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <Circle
            className={`w-2 h-2 fill-current ${health.orchestratorRunning ? "text-emerald-400" : "text-red-400"
              }`}
          />
          <span className="text-slate-400">
            {health.orchestratorRunning ? "Running" : "Stopped"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <Activity className="w-3 h-3" />
          <span>{health.activeScouts} scouts</span>
        </div>

        {health.pioneerConnected !== undefined && (
          <div className="flex items-center gap-1.5">
            <Circle
              className={`w-2 h-2 fill-current ${
                health.pioneerConnected ? "text-indigo-400" : "text-slate-600"
              }`}
            />
            <span className="text-slate-400">
              Pioneer {health.glinerBackend === "pioneer" ? "(cloud)" : health.glinerBackend === "local" ? "(local)" : "(off)"}
            </span>
          </div>
        )}

        {health.lastScanTime && (
          <span className="text-slate-500">
            Last scan:{" "}
            {new Date(health.lastScanTime).toLocaleTimeString()}
          </span>
        )}
      </div>
    </header>
  );
}
