"use client";

import { Scout } from "@/lib/types";
import { Radar, Clock, AlertCircle, Pause, Play } from "lucide-react";

interface Props {
  scouts: Scout[];
  onCreateScout: () => void;
}

export default function ScoutCards({ scouts, onCreateScout }: Props) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Radar className="w-4 h-4 text-indigo-400" />
          Active Scouts
        </h2>
        <button
          onClick={onCreateScout}
          className="text-xs px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
        >
          + Add Scout
        </button>
      </div>

      {scouts.length === 0 ? (
        <p className="text-slate-500 text-sm py-4 text-center">
          No scouts active. Start the orchestrator or add one manually.
        </p>
      ) : (
        <div className="space-y-3">
          {scouts.map((scout) => (
            <div
              key={scout.id}
              className="bg-slate-900 rounded-lg p-3 border border-slate-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {scout.query.slice(0, 60)}...
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Every {scout.interval / 60} min
                    </span>
                    <span className="text-xs text-slate-400">
                      {scout.jobsFound} jobs found
                    </span>
                  </div>
                  {scout.targetCompanies.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {scout.targetCompanies.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {scout.status === "active" ? (
                    <span className="flex items-center gap-1 text-emerald-400 text-xs">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      Live
                    </span>
                  ) : scout.status === "error" ? (
                    <span className="flex items-center gap-1 text-red-400 text-xs">
                      <AlertCircle className="w-3 h-3" />
                      Error
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400 text-xs">
                      <Pause className="w-3 h-3" />
                      Paused
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
