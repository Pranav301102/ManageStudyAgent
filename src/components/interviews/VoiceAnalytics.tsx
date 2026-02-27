"use client";

import { VoiceAnalysis } from "@/lib/types";
import { Activity, TrendingUp, Gauge, MessageSquare } from "lucide-react";

interface Props {
  analysis: VoiceAnalysis | null;
}

export default function VoiceAnalyticsPanel({ analysis }: Props) {
  if (!analysis) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-cyan-400" />
          Voice Analytics
        </h3>
        <p className="text-xs text-slate-500 text-center py-4">
          Voice analytics will appear here after you respond to a question.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-cyan-400" />
        Voice Analytics
        <span className="text-[10px] px-1.5 py-0.5 bg-cyan-400/10 text-cyan-400 rounded ml-auto">
          Powered by Modulate
        </span>
      </h3>

      <div className="space-y-3">
        <AnalyticBar
          label="Confidence"
          value={analysis.confidence}
          icon={<TrendingUp className="w-3 h-3" />}
        />
        <AnalyticBar
          label="Clarity"
          value={analysis.clarity}
          icon={<MessageSquare className="w-3 h-3" />}
        />
        <AnalyticBar
          label="Pace"
          value={analysis.pace}
          icon={<Gauge className="w-3 h-3" />}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-700">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Sentiment
          </p>
          <p className="text-xs text-white capitalize">{analysis.sentiment}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Emotion
          </p>
          <p className="text-xs text-white capitalize">{analysis.emotion}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Filler Words
          </p>
          <p
            className={`text-xs font-medium ${
              analysis.fillerWordCount <= 2
                ? "text-emerald-400"
                : analysis.fillerWordCount <= 5
                ? "text-amber-400"
                : "text-red-400"
            }`}
          >
            {analysis.fillerWordCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Duration
          </p>
          <p className="text-xs text-white">
            {analysis.duration > 0
              ? `${Math.round(analysis.duration)}s`
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function AnalyticBar({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  const color =
    value >= 70
      ? "bg-emerald-400"
      : value >= 40
      ? "bg-amber-400"
      : "bg-red-400";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400 flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className="text-xs text-white font-medium">{value}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
