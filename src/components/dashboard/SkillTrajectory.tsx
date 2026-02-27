"use client";

import { PerformanceSnapshot, SkillDelta } from "@/lib/types";
import { TrendingUp } from "lucide-react";

interface Props {
    snapshots: PerformanceSnapshot[];
}

/** Skill trajectory chart showing proficiency growth over time. */
export default function SkillTrajectory({ snapshots }: Props) {
    if (snapshots.length === 0) {
        return (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    Skill Trajectory
                </h3>
                <p className="text-xs text-slate-600 italic text-center py-4">
                    Trajectory data appears after interviews.
                </p>
            </div>
        );
    }

    // Collect all skill deltas across snapshots
    const skillMap = new Map<string, { date: string; level: number }[]>();

    for (const snap of snapshots) {
        for (const delta of snap.skillDeltas) {
            if (!skillMap.has(delta.skillName)) {
                skillMap.set(delta.skillName, []);
            }
            skillMap.get(delta.skillName)!.push({
                date: snap.date.split("T")[0],
                level: delta.newLevel,
            });
        }
    }

    const COLORS = [
        "text-indigo-400", "text-emerald-400", "text-amber-400",
        "text-cyan-400", "text-purple-400", "text-rose-400",
    ];

    const BAR_COLORS = [
        "bg-indigo-400", "bg-emerald-400", "bg-amber-400",
        "bg-cyan-400", "bg-purple-400", "bg-rose-400",
    ];

    const skills = Array.from(skillMap.entries()).slice(0, 6);

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Skill Trajectory
            </h3>

            <div className="space-y-3">
                {skills.map(([name, dataPoints], i) => {
                    const latest = dataPoints[dataPoints.length - 1];
                    const first = dataPoints[0];
                    const delta = latest.level - first.level;

                    return (
                        <div key={name} className="flex items-center gap-3">
                            <span className={`text-xs w-24 truncate ${COLORS[i % COLORS.length]}`}>
                                {name}
                            </span>
                            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${BAR_COLORS[i % BAR_COLORS.length]}`}
                                    style={{ width: `${(latest.level / 5) * 100}%` }}
                                />
                            </div>
                            <span className="text-[10px] text-slate-400 w-8 text-right">
                                {latest.level}/5
                            </span>
                            <span className={`text-[10px] w-8 text-right ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-slate-500"
                                }`}>
                                {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "—"}
                            </span>
                        </div>
                    );
                })}
            </div>

            {skills.length === 0 && (
                <p className="text-xs text-slate-600 italic text-center py-2">
                    No skill changes recorded yet.
                </p>
            )}
        </div>
    );
}
