"use client";

import { SystemHealth } from "@/lib/types";
import {
  Briefcase,
  Mic,
  AlertTriangle,
  Activity,
} from "lucide-react";

interface Props {
  health: SystemHealth;
}

export default function QuickStats({ health }: Props) {
  const stats = [
    {
      label: "Jobs Found",
      value: health.totalJobsFound,
      icon: Briefcase,
      color: "text-indigo-400",
      bg: "bg-indigo-400/10",
    },
    {
      label: "Interviews Ready",
      value: health.interviewsReady,
      icon: Mic,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Skill Gaps",
      value: health.skillGapsIdentified,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Active Scouts",
      value: health.activeScouts,
      icon: Activity,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-slate-800 rounded-xl p-4 border border-slate-700"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              {stat.label}
            </span>
            <div className={`p-2 rounded-lg ${stat.bg}`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
