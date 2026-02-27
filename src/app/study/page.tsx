"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import {
    SystemHealth,
    StudySchedule,
    StudyBlock,
    AvailabilitySlot,
    DailyChallenge,
    PerformanceSnapshot,
} from "@/lib/types";
import {
    BookOpen,
    Calendar,
    Flame,
    Check,
    Loader2,
    Sparkles,
    TrendingUp,
    TrendingDown,
    Minus,
    RefreshCw,
} from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7am-10pm

const TYPE_COLORS: Record<string, string> = {
    "skill-gap": "bg-red-500/20 border-red-500/30 text-red-400",
    "mock-interview": "bg-purple-500/20 border-purple-500/30 text-purple-400",
    "coding-practice": "bg-indigo-500/20 border-indigo-500/30 text-indigo-400",
    "system-design": "bg-cyan-500/20 border-cyan-500/30 text-cyan-400",
    behavioral: "bg-amber-500/20 border-amber-500/30 text-amber-400",
};

const PRIORITY_BADGE: Record<string, string> = {
    critical: "bg-red-500 text-white",
    high: "bg-amber-500 text-white",
    medium: "bg-slate-600 text-slate-300",
};

export default function StudyPage() {
    const [health, setHealth] = useState<SystemHealth>({
        orchestratorRunning: false, activeScouts: 0, neo4jConnected: false,
        totalJobsFound: 0, interviewsReady: 0, skillGapsIdentified: 0,
    });
    const [schedule, setSchedule] = useState<StudySchedule | null>(null);
    const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
    const [perfHistory, setPerfHistory] = useState<PerformanceSnapshot[]>([]);
    const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
    const [generating, setGenerating] = useState(false);
    const [loading, setLoading] = useState(true);

    // Default availability: weekdays 6pm-10pm, weekends 10am-6pm
    const defaultAvailability: AvailabilitySlot[] = [
        { dayOfWeek: 0, startHour: 10, endHour: 18 },
        { dayOfWeek: 1, startHour: 18, endHour: 22 },
        { dayOfWeek: 2, startHour: 18, endHour: 22 },
        { dayOfWeek: 3, startHour: 18, endHour: 22 },
        { dayOfWeek: 4, startHour: 18, endHour: 22 },
        { dayOfWeek: 5, startHour: 18, endHour: 22 },
        { dayOfWeek: 6, startHour: 10, endHour: 18 },
    ];

    const fetchData = useCallback(async () => {
        try {
            const [healthRes, studyRes] = await Promise.all([
                fetch("/api/system"),
                fetch("/api/study"),
            ]);
            const h = await healthRes.json();
            const s = await studyRes.json();
            if (h.success) setHealth(h.data);
            if (s.success) {
                setSchedule(s.data.schedule);
                setDailyChallenge(s.data.dailyChallenge);
                setPerfHistory(s.data.performanceHistory || []);
                if (s.data.schedule?.availability) {
                    setAvailability(s.data.schedule.availability);
                }
            }
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        if (availability.length === 0) setAvailability(defaultAvailability);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchData]);

    const toggleSlot = (day: number, hour: number) => {
        setAvailability((prev) => {
            const existing = prev.find(
                (s) => s.dayOfWeek === day && s.startHour <= hour && s.endHour > hour
            );
            if (existing) {
                // Remove or shrink
                return prev.filter((s) => s !== existing);
            } else {
                // Add a 2-hour block
                return [...prev, { dayOfWeek: day, startHour: hour, endHour: Math.min(hour + 2, 23) }];
            }
        });
    };

    const isSlotActive = (day: number, hour: number) =>
        availability.some(
            (s) => s.dayOfWeek === day && s.startHour <= hour && s.endHour > hour
        );

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const merged = mergeAvailability(availability);
            const res = await fetch("/api/study", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ availability: merged }),
            });
            const data = await res.json();
            if (data.success) {
                setSchedule(data.data);
            }
        } catch (err) {
            console.error("Generation failed:", err);
        } finally {
            setGenerating(false);
        }
    };

    const handleCompleteBlock = async (blockId: string) => {
        await fetch("/api/study", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "complete-block", blockId }),
        });
        await fetchData();
    };

    const handleCompleteChallenge = async () => {
        await fetch("/api/study", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "complete-challenge" }),
        });
        await fetchData();
    };

    // Merge overlapping availability slots
    function mergeAvailability(slots: AvailabilitySlot[]): AvailabilitySlot[] {
        const byDay = new Map<number, AvailabilitySlot[]>();
        for (const s of slots) {
            if (!byDay.has(s.dayOfWeek)) byDay.set(s.dayOfWeek, []);
            byDay.get(s.dayOfWeek)!.push(s);
        }
        const merged: AvailabilitySlot[] = [];
        for (const [day, daySlots] of byDay) {
            daySlots.sort((a, b) => a.startHour - b.startHour);
            let cur = { ...daySlots[0] };
            for (let i = 1; i < daySlots.length; i++) {
                if (daySlots[i].startHour <= cur.endHour) {
                    cur.endHour = Math.max(cur.endHour, daySlots[i].endHour);
                } else {
                    merged.push(cur);
                    cur = { ...daySlots[i] };
                }
            }
            merged.push(cur);
        }
        return merged;
    }

    const completedCount = schedule?.studyPlan.filter((b) => b.completed).length || 0;
    const totalCount = schedule?.studyPlan.length || 0;

    if (loading) {
        return (
            <div><Header health={health} />
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                </div>
            </div>
        );
    }

    return (
        <div>
            <Header health={health} />
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-indigo-400" />
                            Study Plan
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            AI-optimized schedule based on your availability, skill gaps, and interviews
                        </p>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {generating ? "Generating..." : schedule ? "Regenerate" : "Generate Plan"}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main content (2 cols) */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Availability Grid */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                                <Calendar className="w-4 h-4 text-indigo-400" />
                                Your Availability
                                <span className="text-[10px] text-slate-500 font-normal ml-1">
                                    Click to toggle time slots
                                </span>
                            </h3>
                            <div className="overflow-x-auto">
                                <div className="grid grid-cols-8 gap-px bg-slate-700/30 rounded-lg overflow-hidden min-w-[600px]">
                                    {/* Header */}
                                    <div className="bg-slate-900 p-2 text-[10px] text-slate-500" />
                                    {DAYS.map((d) => (
                                        <div key={d} className="bg-slate-900 p-2 text-[10px] text-slate-400 text-center font-medium">
                                            {d}
                                        </div>
                                    ))}

                                    {/* Time rows */}
                                    {HOURS.map((hour) => (
                                        <>
                                            <div key={`h-${hour}`} className="bg-slate-900 p-1.5 text-[9px] text-slate-500 text-right pr-2">
                                                {hour > 12 ? `${hour - 12}pm` : hour === 12 ? "12pm" : `${hour}am`}
                                            </div>
                                            {DAYS.map((_, dayIdx) => (
                                                <button
                                                    key={`${dayIdx}-${hour}`}
                                                    onClick={() => toggleSlot(dayIdx, hour)}
                                                    className={`p-1.5 transition-colors ${isSlotActive(dayIdx, hour)
                                                            ? "bg-indigo-500/30 hover:bg-indigo-500/40"
                                                            : "bg-slate-900 hover:bg-slate-800"
                                                        }`}
                                                />
                                            ))}
                                        </>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Study Plan Calendar */}
                        {schedule && schedule.studyPlan.length > 0 && (
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
                                    <Sparkles className="w-4 h-4 text-amber-400" />
                                    Your Study Blocks
                                    <span className="text-[10px] text-slate-500 font-normal ml-1">
                                        {completedCount}/{totalCount} complete
                                    </span>
                                </h3>
                                <div className="w-full bg-slate-700 rounded-full h-1.5 mb-4">
                                    <div
                                        className="bg-indigo-500 h-1.5 rounded-full transition-all"
                                        style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%" }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    {schedule.studyPlan.map((block) => (
                                        <div
                                            key={block.id}
                                            className={`rounded-lg border p-3 flex items-center gap-3 transition-all ${block.completed
                                                    ? "bg-emerald-500/5 border-emerald-500/20 opacity-60"
                                                    : TYPE_COLORS[block.type] || "bg-slate-700 border-slate-600 text-slate-300"
                                                }`}
                                        >
                                            <button
                                                onClick={() => handleCompleteBlock(block.id)}
                                                className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${block.completed
                                                        ? "bg-emerald-500 border-emerald-500"
                                                        : "border-slate-500 hover:border-white"
                                                    }`}
                                            >
                                                {block.completed && <Check className="w-3 h-3 text-white" />}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${block.completed ? "line-through text-emerald-400/60" : "text-white"}`}>
                                                    {block.topic}
                                                </p>
                                                <p className="text-[10px] text-slate-500">
                                                    {block.date} · {block.startTime}–{block.endTime} · {block.type.replace("-", " ")}
                                                </p>
                                            </div>

                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${PRIORITY_BADGE[block.priority]}`}>
                                                {block.priority}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right sidebar */}
                    <div className="space-y-4">
                        {/* Daily Challenge */}
                        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20 p-5">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                                <Flame className="w-4 h-4 text-amber-400" />
                                Daily Challenge
                                {dailyChallenge && (
                                    <span className="text-[10px] text-amber-400/70 ml-auto">
                                        🔥 {dailyChallenge.streak} streak
                                    </span>
                                )}
                            </h3>

                            {dailyChallenge ? (
                                <div>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${dailyChallenge.difficulty === "hard"
                                            ? "bg-red-500/20 text-red-400"
                                            : dailyChallenge.difficulty === "medium"
                                                ? "bg-amber-500/20 text-amber-400"
                                                : "bg-emerald-500/20 text-emerald-400"
                                        }`}>
                                        {dailyChallenge.difficulty} · {dailyChallenge.type}
                                    </span>
                                    <p className="text-sm text-white mt-2 leading-relaxed">
                                        {dailyChallenge.question}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-2">
                                        Target: {dailyChallenge.targetSkill}
                                    </p>
                                    {!dailyChallenge.completed ? (
                                        <button
                                            onClick={handleCompleteChallenge}
                                            className="mt-3 w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-medium transition-colors"
                                        >
                                            Mark Complete ✓
                                        </button>
                                    ) : (
                                        <div className="mt-3 w-full py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs text-center">
                                            ✅ Completed!
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 italic">
                                    Generate a study plan to unlock daily challenges.
                                </p>
                            )}
                        </div>

                        {/* Performance History */}
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                Performance Trend
                            </h3>

                            {perfHistory.length > 0 ? (
                                <div className="space-y-3">
                                    {perfHistory.slice(-5).map((snap, i) => (
                                        <div key={i} className="border-b border-slate-700/50 pb-2 last:border-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {snap.overallTrend === "improving" ? (
                                                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                                                ) : snap.overallTrend === "declining" ? (
                                                    <TrendingDown className="w-3 h-3 text-red-400" />
                                                ) : (
                                                    <Minus className="w-3 h-3 text-slate-400" />
                                                )}
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(snap.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {snap.strengths.length > 0 && (
                                                <p className="text-[10px] text-emerald-400/70">
                                                    ✓ {snap.strengths.slice(0, 2).join(", ")}
                                                </p>
                                            )}
                                            {snap.weaknesses.length > 0 && (
                                                <p className="text-[10px] text-red-400/70">
                                                    ✗ {snap.weaknesses.slice(0, 2).join(", ")}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-600 italic text-center py-4">
                                    Performance insights appear after mock interviews.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
