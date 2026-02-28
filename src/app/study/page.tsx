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
  Job,
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
  ArrowLeft,
  Clock,
  Target,
  Zap,
  Brain,
  Code,
  MessageSquare,
  Layout,
  ChevronRight,
  Play,
  CheckCircle2,
  Briefcase,
  AlertTriangle,
  Timer,
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

const TYPE_ICONS: Record<string, typeof Code> = {
  "skill-gap": Target,
  "mock-interview": MessageSquare,
  "coding-practice": Code,
  "system-design": Layout,
  behavioral: Brain,
};

const TYPE_LABELS: Record<string, string> = {
  "skill-gap": "Skill Gap",
  "mock-interview": "Mock Interview",
  "coding-practice": "Coding Practice",
  "system-design": "System Design",
  behavioral: "Behavioral",
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-amber-500 text-white",
  medium: "bg-slate-600 text-slate-300",
};

export default function StudyPage() {
  const [health, setHealth] = useState<SystemHealth>({
    orchestratorRunning: false,
    activeScouts: 0,
    neo4jConnected: false,
    totalJobsFound: 0,
    interviewsReady: 0,
    skillGapsIdentified: 0,
  });
  const [schedule, setSchedule] = useState<StudySchedule | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [perfHistory, setPerfHistory] = useState<PerformanceSnapshot[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeBlock, setActiveBlock] = useState<StudyBlock | null>(null);
  const [activeTab, setActiveTab] = useState<"blocks" | "schedule" | "progress">("blocks");

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
      const [healthRes, studyRes, jobsRes] = await Promise.all([
        fetch("/api/system"),
        fetch("/api/study"),
        fetch("/api/jobs"),
      ]);
      const h = await healthRes.json();
      const s = await studyRes.json();
      const j = await jobsRes.json();
      if (h.success) setHealth(h.data);
      if (s.success) {
        setSchedule(s.data.schedule);
        setDailyChallenge(s.data.dailyChallenge);
        setPerfHistory(s.data.performanceHistory || []);
        if (s.data.schedule?.availability) {
          setAvailability(s.data.schedule.availability);
        }
      }
      if (j.success) setJobs(j.data);
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
        return prev.filter((s) => s !== existing);
      } else {
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
    if (activeBlock?.id === blockId) {
      setActiveBlock((prev) => prev ? { ...prev, completed: true } : null);
    }
  };

  const handleCompleteChallenge = async () => {
    await fetch("/api/study", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete-challenge" }),
    });
    await fetchData();
  };

  function mergeAvailability(slots: AvailabilitySlot[]): AvailabilitySlot[] {
    const byDay = new Map<number, AvailabilitySlot[]>();
    for (const s of slots) {
      if (!byDay.has(s.dayOfWeek)) byDay.set(s.dayOfWeek, []);
      byDay.get(s.dayOfWeek)!.push(s);
    }
    const merged: AvailabilitySlot[] = [];
    for (const [, daySlots] of byDay) {
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
  const studyBlocks = schedule?.studyPlan || [];

  const blocksByType = studyBlocks.reduce((acc, block) => {
    if (!acc[block.type]) acc[block.type] = [];
    acc[block.type].push(block);
    return acc;
  }, {} as Record<string, StudyBlock[]>);

  const getLinkedJob = (block: StudyBlock) => {
    if (!block.linkedJobId) return null;
    return jobs.find((j) => j.id === block.linkedJobId) || null;
  };

  const allSkillGaps = jobs.flatMap((j) => j.skillGaps.map((g) => ({ ...g, jobTitle: j.title, company: j.company })));
  const uniqueGaps = [...new Map(allSkillGaps.map((g) => [g.skillName, g])).values()];

  if (loading) {
    return (
      <div>
        <Header health={health} />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      </div>
    );
  }

  // ─── Active Study Session View ─────────────────────────────────────
  if (activeBlock) {
    const linkedJob = getLinkedJob(activeBlock);
    const TypeIcon = TYPE_ICONS[activeBlock.type] || BookOpen;

    return (
      <div>
        <Header health={health} />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveBlock(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Study Plan
            </button>
            <div className="flex items-center gap-3">
              {!activeBlock.completed ? (
                <button
                  onClick={() => handleCompleteBlock(activeBlock.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark Complete
                </button>
              ) : (
                <span className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm font-medium border border-emerald-500/20">
                  <Check className="w-4 h-4" />
                  Completed
                </span>
              )}
            </div>
          </div>

          {/* Session header card */}
          <div className={`rounded-xl border p-6 ${TYPE_COLORS[activeBlock.type] || "bg-slate-800 border-slate-700"}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-900/50 flex items-center justify-center">
                  <TypeIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{activeBlock.topic}</h2>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {activeBlock.startTime} – {activeBlock.endTime}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {activeBlock.date}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[activeBlock.priority]}`}>
                      {activeBlock.priority}
                    </span>
                  </div>
                  {activeBlock.triggeredBy === "interview-failure" && activeBlock.failureReason && (
                    <p className="text-xs text-red-400/80 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Triggered by interview weakness: {activeBlock.failureReason}
                    </p>
                  )}
                </div>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full border ${TYPE_COLORS[activeBlock.type]}`}>
                {TYPE_LABELS[activeBlock.type] || activeBlock.type}
              </span>
            </div>
          </div>

          {/* Study content area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <Brain className="w-4 h-4 text-indigo-400" />
                  Study Focus
                </h3>

                {activeBlock.type === "coding-practice" && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Practice coding problems related to <span className="text-indigo-400 font-medium">{activeBlock.topic}</span>.
                      Focus on writing clean, efficient solutions and explaining your approach.
                    </p>
                    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700/50">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Suggested Practice</h4>
                      <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> Implement the core algorithm from scratch</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> Analyze time &amp; space complexity</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> Write test cases for edge conditions</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> Try solving with multiple approaches</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeBlock.type === "system-design" && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Study system design concepts for <span className="text-cyan-400 font-medium">{activeBlock.topic}</span>.
                      Practice whiteboarding architecture and discussing tradeoffs.
                    </p>
                    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700/50">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Key Areas</h4>
                      <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" /> Define requirements and constraints</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" /> Design high-level architecture</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" /> Discuss scaling, caching, and data storage</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" /> Consider failure modes and monitoring</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeBlock.type === "behavioral" && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Prepare for behavioral questions around <span className="text-amber-400 font-medium">{activeBlock.topic}</span>.
                      Use the STAR method (Situation, Task, Action, Result).
                    </p>
                    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700/50">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">STAR Framework</h4>
                      <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> <strong className="text-amber-300">Situation</strong> — Set the scene with context</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> <strong className="text-amber-300">Task</strong> — Describe your responsibility</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> <strong className="text-amber-300">Action</strong> — Explain what you did</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> <strong className="text-amber-300">Result</strong> — Share the outcome &amp; metrics</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeBlock.type === "skill-gap" && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Close your skill gap in <span className="text-red-400 font-medium">{activeBlock.topic}</span>.
                      Focus on foundational concepts and hands-on practice.
                    </p>
                    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700/50">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Study Steps</h4>
                      <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" /> Review core concepts and fundamentals</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" /> Set up a hands-on project or exercise</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" /> Build something small to reinforce learning</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" /> Review related interview questions</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeBlock.type === "mock-interview" && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Practice a mock interview focusing on <span className="text-purple-400 font-medium">{activeBlock.topic}</span>.
                      Simulate real interview conditions — time pressure, thinking out loud.
                    </p>
                    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700/50">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Interview Tips</h4>
                      <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" /> Think out loud — verbalize your approach</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" /> Clarify requirements before solving</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" /> Start with brute force, then optimize</li>
                        <li className="flex items-start gap-2"><Zap className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" /> Test your solution with examples</li>
                      </ul>
                    </div>
                    {linkedJob && (
                      <a
                        href={`/interviews?jobId=${linkedJob.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <Play className="w-4 h-4" />
                        Start Mock Interview for {linkedJob.company}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  Notes
                </h3>
                <textarea
                  className="w-full h-40 bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                  placeholder="Take notes as you study... jot down concepts, questions, or key takeaways"
                />
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              {linkedJob && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    Linked Role
                  </h3>
                  <div className="space-y-2 text-xs text-slate-400">
                    <p className="text-sm text-white font-medium">{linkedJob.title}</p>
                    <p>{linkedJob.company} · {linkedJob.location}</p>
                    <p className={linkedJob.matchScore >= 80 ? "text-emerald-400" : "text-amber-400"}>
                      {linkedJob.matchScore}% match
                    </p>
                    {linkedJob.techStack.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {linkedJob.techStack.slice(0, 8).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      dailyChallenge.difficulty === "hard"
                        ? "bg-red-500/20 text-red-400"
                        : dailyChallenge.difficulty === "medium"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {dailyChallenge.difficulty} · {dailyChallenge.type}
                    </span>
                    <p className="text-sm text-white mt-2 leading-relaxed">{dailyChallenge.question}</p>
                    <p className="text-[10px] text-slate-500 mt-2">Target: {dailyChallenge.targetSkill}</p>
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
                  <p className="text-xs text-slate-500 italic">Generate a study plan to unlock daily challenges.</p>
                )}
              </div>

              {perfHistory.length > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Performance
                  </h3>
                  <div className="space-y-2">
                    {perfHistory.slice(-3).map((snap, i) => (
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
                          <p className="text-[10px] text-emerald-400/70">✓ {snap.strengths.slice(0, 2).join(", ")}</p>
                        )}
                        {snap.weaknesses.length > 0 && (
                          <p className="text-[10px] text-red-400/70">✗ {snap.weaknesses.slice(0, 2).join(", ")}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Study Plan View (Selection) ──────────────────────────────
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
              AI-optimized study schedule based on your skill gaps and upcoming interviews
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

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total Blocks</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalCount}</p>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Completed</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{completedCount}</p>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="w-4 h-4 text-red-400" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Skill Gaps</span>
            </div>
            <p className="text-2xl font-bold text-red-400">{uniqueGaps.length}</p>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Streak</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{dailyChallenge?.streak ?? 0}</p>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Timer className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Progress</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}%` : "—"}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
          {([
            { key: "blocks" as const, label: "Study Topics", icon: BookOpen },
            { key: "schedule" as const, label: "Schedule", icon: Calendar },
            { key: "progress" as const, label: "Progress", icon: TrendingUp },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Study Topics Tab ─────────────────────── */}
        {activeTab === "blocks" && (
          <div className="space-y-6">
            {dailyChallenge && (
              <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 rounded-xl border border-amber-500/20 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-bold text-white">Daily Challenge</span>
                    <span className="text-[10px] text-amber-400/70 px-2 py-0.5 bg-amber-500/10 rounded-full">
                      🔥 {dailyChallenge.streak} day streak
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${
                    dailyChallenge.difficulty === "hard"
                      ? "bg-red-500/20 text-red-400"
                      : dailyChallenge.difficulty === "medium"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-emerald-500/20 text-emerald-400"
                  }`}>
                    {dailyChallenge.difficulty} · {dailyChallenge.type}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{dailyChallenge.question}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[10px] text-slate-500">Target: {dailyChallenge.targetSkill}</span>
                  {!dailyChallenge.completed ? (
                    <button
                      onClick={handleCompleteChallenge}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      Mark Complete
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Completed!
                    </span>
                  )}
                </div>
              </div>
            )}

            {uniqueGaps.length > 0 && (
              <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Skill Gaps to Close</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueGaps.map((gap) => (
                    <div
                      key={gap.skillName}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg"
                    >
                      <Zap className="w-3 h-3 text-red-400" />
                      <span className="text-xs text-red-300">{gap.skillName}</span>
                      <span className="text-[9px] text-slate-600">({gap.company})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {studyBlocks.length > 0 ? (
              Object.entries(blocksByType).map(([type, blocks]) => {
                const TypeIcon = TYPE_ICONS[type] || BookOpen;
                return (
                  <div key={type}>
                    <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                      <TypeIcon className="w-4 h-4" />
                      {TYPE_LABELS[type] || type}
                      <span className="text-[10px] text-slate-600">
                        {blocks.filter((b) => b.completed).length}/{blocks.length} complete
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {blocks.map((block) => {
                        const job = getLinkedJob(block);
                        return (
                          <button
                            key={block.id}
                            onClick={() => setActiveBlock(block)}
                            className={`text-left rounded-xl border p-4 transition-all group hover:scale-[1.01] ${
                              block.completed
                                ? "bg-emerald-500/5 border-emerald-500/20 opacity-70"
                                : "bg-slate-800 border-slate-700 hover:border-indigo-500/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                {block.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                ) : (
                                  <Play className="w-4 h-4 text-indigo-400 flex-shrink-0 group-hover:text-indigo-300" />
                                )}
                                <span className={`text-sm font-medium ${
                                  block.completed ? "line-through text-emerald-400/60" : "text-white group-hover:text-indigo-400"
                                } transition-colors`}>
                                  {block.topic}
                                </span>
                              </div>
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${PRIORITY_BADGE[block.priority]}`}>
                                {block.priority}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                {block.date}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {block.startTime}–{block.endTime}
                              </span>
                            </div>
                            {job && (
                              <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                                <Briefcase className="w-2.5 h-2.5" />
                                <span>{job.company} — {job.title}</span>
                              </div>
                            )}
                            {block.triggeredBy === "interview-failure" && (
                              <p className="text-[9px] text-red-400/60 mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Triggered by interview weakness
                              </p>
                            )}
                            {!block.completed && (
                              <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="w-3 h-3" />
                                Start Studying
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
                <Brain className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Study Plan Yet</h3>
                <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
                  Generate an AI-powered study plan based on your availability and skill gaps.
                  Set your availability in the Schedule tab first, or use the defaults.
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? "Generating..." : "Generate Study Plan"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Schedule Tab ────────────────────── */}
        {activeTab === "schedule" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  Your Availability
                  <span className="text-[10px] text-slate-500 font-normal ml-1">Click to toggle time slots</span>
                </h3>
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-8 gap-px bg-slate-700/30 rounded-lg overflow-hidden min-w-[600px]">
                    <div className="bg-slate-900 p-2 text-[10px] text-slate-500" />
                    {DAYS.map((d) => (
                      <div key={d} className="bg-slate-900 p-2 text-[10px] text-slate-400 text-center font-medium">{d}</div>
                    ))}
                    {HOURS.map((hour) => (
                      <>
                        <div key={`h-${hour}`} className="bg-slate-900 p-1.5 text-[9px] text-slate-500 text-right pr-2">
                          {hour > 12 ? `${hour - 12}pm` : hour === 12 ? "12pm" : `${hour}am`}
                        </div>
                        {DAYS.map((_, dayIdx) => (
                          <button
                            key={`${dayIdx}-${hour}`}
                            onClick={() => toggleSlot(dayIdx, hour)}
                            className={`p-1.5 transition-colors ${
                              isSlotActive(dayIdx, hour)
                                ? "bg-indigo-500/30 hover:bg-indigo-500/40"
                                : "bg-slate-900 hover:bg-slate-800"
                            }`}
                          />
                        ))}
                      </>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? "Generating..." : "Generate from Availability"}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Upcoming Blocks
                </h3>
                {studyBlocks.filter((b) => !b.completed).length > 0 ? (
                  <div className="space-y-2">
                    {studyBlocks.filter((b) => !b.completed).slice(0, 8).map((block) => (
                      <button
                        key={block.id}
                        onClick={() => setActiveBlock(block)}
                        className="w-full text-left rounded-lg border p-2.5 flex items-center gap-2 transition-all hover:border-indigo-500/30 bg-slate-900/50 border-slate-700/50"
                      >
                        <Play className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{block.topic}</p>
                          <p className="text-[9px] text-slate-500">{block.date} · {block.startTime}</p>
                        </div>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${PRIORITY_BADGE[block.priority]}`}>
                          {block.priority}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">All blocks completed! Generate more.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Progress Tab ─────────────────────── */}
        {activeTab === "progress" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {totalCount > 0 && (
              <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-400" />
                    Overall Progress
                  </h3>
                  <span className="text-sm text-slate-400">{completedCount}/{totalCount} blocks</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all"
                    style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-5 gap-2 mt-4">
                  {Object.entries(blocksByType).map(([type, blocks]) => {
                    const done = blocks.filter((b) => b.completed).length;
                    const TypeIcon = TYPE_ICONS[type] || BookOpen;
                    return (
                      <div key={type} className="text-center">
                        <TypeIcon className="w-4 h-4 mx-auto text-slate-500 mb-1" />
                        <p className="text-[10px] text-slate-500">{TYPE_LABELS[type]}</p>
                        <p className="text-xs font-semibold text-white">{done}/{blocks.length}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Performance Trend
              </h3>
              {perfHistory.length > 0 ? (
                <div className="space-y-3">
                  {perfHistory.slice(-6).map((snap, i) => (
                    <div key={i} className="border-b border-slate-700/50 pb-3 last:border-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        {snap.overallTrend === "improving" ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : snap.overallTrend === "declining" ? (
                          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                          <Minus className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span className="text-xs text-slate-400">{new Date(snap.date).toLocaleDateString()}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                          snap.overallTrend === "improving"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : snap.overallTrend === "declining"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-slate-700 text-slate-400"
                        }`}>
                          {snap.overallTrend}
                        </span>
                      </div>
                      {snap.strengths.length > 0 && (
                        <p className="text-[10px] text-emerald-400/70">✓ {snap.strengths.join(", ")}</p>
                      )}
                      {snap.weaknesses.length > 0 && (
                        <p className="text-[10px] text-red-400/70">✗ {snap.weaknesses.join(", ")}</p>
                      )}
                      {snap.recommendedFocus.length > 0 && (
                        <p className="text-[10px] text-indigo-400/60 mt-0.5">Focus: {snap.recommendedFocus.join(", ")}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic text-center py-6">
                  Performance insights appear after mock interviews.
                </p>
              )}
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Completed Study Sessions
              </h3>
              {studyBlocks.filter((b) => b.completed).length > 0 ? (
                <div className="space-y-2">
                  {studyBlocks.filter((b) => b.completed).map((block) => {
                    const TypeIcon = TYPE_ICONS[block.type] || BookOpen;
                    return (
                      <div
                        key={block.id}
                        className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3 flex items-center gap-3"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-emerald-400/80 line-through">{block.topic}</p>
                          <p className="text-[9px] text-slate-600">{block.date} · {TYPE_LABELS[block.type]}</p>
                        </div>
                        <TypeIcon className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic text-center py-6">
                  No completed sessions yet. Start studying!
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
