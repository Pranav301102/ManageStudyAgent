"use client";

import { SystemHealth } from "@/lib/types";
import { Circle, Database, Radar, Bot } from "lucide-react";

interface Props {
  health: SystemHealth;
  onStart: () => void;
  onDemo: () => void;
}

export default function SystemHealthPanel({ health, onStart, onDemo }: Props) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Bot className="w-4 h-4 text-cyan-400" />
        System Status
      </h2>

      <div className="space-y-3">
        <StatusRow
          label="Orchestrator"
          active={health.orchestratorRunning}
          icon={<Bot className="w-3.5 h-3.5" />}
        />
        <StatusRow
          label="Yutori Scouts"
          active={health.activeScouts > 0}
          detail={`${health.activeScouts} active`}
          icon={<Radar className="w-3.5 h-3.5" />}
        />
        <StatusRow
          label="Neo4j"
          active={health.neo4jConnected}
          icon={<Database className="w-3.5 h-3.5" />}
        />

        {health.lastScanTime && (
          <p className="text-[10px] text-slate-500 pt-1">
            Last scan: {new Date(health.lastScanTime).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        {!health.orchestratorRunning && (
          <button
            onClick={onStart}
            className="flex-1 text-xs py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
          >
            Start Pipeline
          </button>
        )}
        <button
          onClick={onDemo}
          className="flex-1 text-xs py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Run Demo
        </button>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  active,
  detail,
  icon,
}: {
  label: string;
  active: boolean;
  detail?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {detail && <span className="text-[10px] text-slate-500">{detail}</span>}
        <Circle
          className={`w-2 h-2 fill-current ${
            active ? "text-emerald-400" : "text-slate-600"
          }`}
        />
      </div>
    </div>
  );
}
