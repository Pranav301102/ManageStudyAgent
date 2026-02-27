"use client";

import { PerformanceSnapshot } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus, Trophy, Target, Zap } from "lucide-react";

interface Props {
    snapshots: PerformanceSnapshot[];
}

/** GitHub-style heat map showing interview activity and confidence trends. */
export default function ConfidenceHeatMap({ snapshots }: Props) {
    // Generate last 12 weeks of data (84 days)
    const today = new Date();
    const days: { date: string; level: number; hasInterview: boolean }[] = [];

    for (let i = 83; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];

        const snap = snapshots.find((s) => s.date.split("T")[0] === dateStr);
        let level = 0;
        if (snap) {
            const strength = snap.strengths.length;
            const weakness = snap.weaknesses.length;
            level = Math.min(4, Math.max(1, Math.ceil(
                (strength / Math.max(1, strength + weakness)) * 4
            )));
        }

        days.push({
            date: dateStr,
            level,
            hasInterview: !!snap,
        });
    }

    const COLORS = [
        "bg-slate-800", // 0 - no activity
        "bg-red-500/40", // 1 - low confidence
        "bg-amber-500/40", // 2 - medium
        "bg-emerald-500/40", // 3 - good
        "bg-emerald-400", // 4 - excellent
    ];

    // Layout: 7 rows (days) × 12 cols (weeks)
    const weeks: (typeof days[0])[][] = []; // Changed type here
    for (let w = 0; w < 12; w++) {
        weeks.push(days.slice(w * 7, (w + 1) * 7));
    }

    // Stats
    const totalInterviews = snapshots.length;
    const improving = snapshots.filter((s) => s.overallTrend === "improving").length;
    const latestTrend = snapshots[snapshots.length - 1]?.overallTrend || "stable";

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-emerald-400" />
                Confidence Map
            </h3>

            {/* Stats row */}
            <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-slate-400">
                        {totalInterviews} interviews
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Target className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px] text-slate-400">
                        {improving} improving
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {latestTrend === "improving" ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : latestTrend === "declining" ? (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                    ) : (
                        <Minus className="w-3 h-3 text-slate-400" />
                    )}
                    <span className="text-[10px] text-slate-400">
                        {latestTrend}
                    </span>
                </div>
            </div>

            {/* Heat map grid */}
            <div className="flex gap-[3px]">
                {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[3px]">
                        {week.map((day, di) => (
                            <div
                                key={di}
                                className={`w-3 h-3 rounded-sm ${COLORS[day.level]} ${day.hasInterview ? "ring-1 ring-indigo-400/50" : ""
                                    }`}
                                title={`${day.date}${day.hasInterview ? " (interview)" : ""}`}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-3">
                <span className="text-[9px] text-slate-500">Less</span>
                {COLORS.map((c, i) => (
                    <div key={i} className={`w-2.5 h-2.5 rounded-sm ${c}`} />
                ))}
                <span className="text-[9px] text-slate-500">More</span>
            </div>
        </div>
    );
}
