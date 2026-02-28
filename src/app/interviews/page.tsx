"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import InterviewPanel from "@/components/interviews/InterviewPanel";
import VoiceAnalyticsPanel from "@/components/interviews/VoiceAnalytics";
import AIInsightsPanel from "@/components/interviews/AIInsightsPanel";
import {
  InterviewSession,
  Job,
  SystemHealth,
  VoiceAnalysis,
  WorkspaceMode,
  CodeEditorState,
  ExtractedEntity,
  RekaVisionAnalysis,
  StudySchedule,
  StudyBlock,
  DailyChallenge,
  PerformanceSnapshot,
} from "@/lib/types";
import {
  Mic,
  Briefcase,
  Code,
  Pencil,
  BookOpen,
  Flame,
  Check,
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  Brain,
} from "lucide-react";

// Dynamic imports for heavy components (Monaco Editor, Whiteboard)
const CodeEditorPanel = dynamic(
  () => import("@/components/interviews/CodeEditor"),
  { ssr: false, loading: () => <div className="h-[400px] bg-slate-800 rounded-xl animate-pulse" /> }
);
const WhiteboardPanel = dynamic(
  () => import("@/components/interviews/WhiteboardPanel"),
  { ssr: false, loading: () => <div className="h-[400px] bg-slate-800 rounded-xl animate-pulse" /> }
);

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

export default function InterviewsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500 text-sm">Loading...</div>}>
      <InterviewsContent />
    </Suspense>
  );
}

function InterviewsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobIdParam = searchParams.get("jobId");

  const [health, setHealth] = useState<SystemHealth>({
    orchestratorRunning: false,
    activeScouts: 0,
    neo4jConnected: false,
    totalJobsFound: 0,
    interviewsReady: 0,
    skillGapsIdentified: 0,
  });
  const [interviews, setInterviews] = useState<InterviewSession[]>([]);
  const [activeInterview, setActiveInterview] = useState<InterviewSession | null>(null);
  const [latestVoiceAnalysis, setLatestVoiceAnalysis] = useState<VoiceAnalysis | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  // ─── Workspace Mode (Code vs Whiteboard toggle) ────────────────────
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("code");
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [extractedSkills, setExtractedSkills] = useState<ExtractedEntity[]>([]);
  const [codeAnalysis, setCodeAnalysis] = useState<string | undefined>();
  const [whiteboardAnalysis, setWhiteboardAnalysis] = useState<string | undefined>();
  const [rekaAnalysis, setRekaAnalysis] = useState<RekaVisionAnalysis | null>(null);
  const [isAnalyzingWhiteboard, setIsAnalyzingWhiteboard] = useState(false);
  const [hint, setHint] = useState<string | undefined>();

  // ─── Study Plan State ──────────────────────────────────────────────
  const [schedule, setSchedule] = useState<StudySchedule | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [perfHistory, setPerfHistory] = useState<PerformanceSnapshot[]>([]);
  const [showStudyPlan, setShowStudyPlan] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const fetchData = useCallback(async () => {
    const [healthRes, interviewsRes, jobsRes, studyRes] = await Promise.all([
      fetch("/api/system"),
      fetch("/api/interviews"),
      fetch("/api/jobs"),
      fetch("/api/study"),
    ]);
    const healthData = await healthRes.json();
    const interviewsData = await interviewsRes.json();
    const jobsData = await jobsRes.json();
    const studyData = await studyRes.json();

    if (healthData.success) setHealth(healthData.data);
    if (interviewsData.success) setInterviews(interviewsData.data);
    if (jobsData.success) setJobs(jobsData.data);
    if (studyData.success) {
      setSchedule(studyData.data.schedule);
      setDailyChallenge(studyData.data.dailyChallenge);
      setPerfHistory(studyData.data.performanceHistory || []);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-start interview if jobId is in URL
  useEffect(() => {
    if (jobIdParam && !activeInterview) {
      startInterview(jobIdParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIdParam]);

  const startInterview = async (jobId: string) => {
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveInterview(data.data);
        setWorkspaceMode("code");
        setShowWorkspace(false);
        // Reset insights
        setExtractedSkills([]);
        setCodeAnalysis(undefined);
        setWhiteboardAnalysis(undefined);
        setRekaAnalysis(null);
        setHint(undefined);
      }
    } catch (err) {
      console.error("Failed to start interview:", err);
    }
  };

  const handleSubmitResponse = async (
    questionId: string,
    transcript: string,
    audioBase64?: string
  ) => {
    if (!activeInterview) return;

    try {
      const res = await fetch("/api/interviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId: activeInterview.id,
          questionId,
          transcript,
          audioBase64,
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.data.question.voiceAnalysis) {
          setLatestVoiceAnalysis(data.data.question.voiceAnalysis);
        }

        setActiveInterview((prev) => {
          if (!prev) return null;
          const updated = { ...prev };
          const qIndex = updated.questions.findIndex((q) => q.id === questionId);
          if (qIndex !== -1) {
            updated.questions[qIndex] = data.data.question;
          }
          updated.currentQuestionIndex = data.data.nextQuestionIndex;
          if (data.data.isComplete) {
            updated.status = "completed";
            updated.overallScore = data.data.overallScore;
          }
          return updated;
        });

        if (transcript && transcript !== "skipped") {
          extractEntitiesFromText(transcript);
        }
      }
    } catch (err) {
      console.error("Failed to submit response:", err);
    }
  };

  // ─── Sponsor Tech Handlers ─────────────────────────────────────────

  const extractEntitiesFromText = async (text: string) => {
    try {
      const res = await fetch("/api/interviews/extract-entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success && data.data.entities) {
        setExtractedSkills((prev) => {
          const existing = new Set(prev.map((e) => e.text.toLowerCase()));
          const newEntities = data.data.entities.filter(
            (e: ExtractedEntity) => !existing.has(e.text.toLowerCase())
          );
          return [...prev, ...newEntities];
        });
      }
    } catch (err) {
      console.warn("Entity extraction failed:", err);
    }
  };

  const handleWhiteboardSnapshot = async (imageBase64: string) => {
    if (isAnalyzingWhiteboard) return;
    setIsAnalyzingWhiteboard(true);

    try {
      const context = activeInterview
        ? `Interview for ${activeInterview.job.title} at ${activeInterview.job.company}. Current question: ${activeInterview.questions[activeInterview.currentQuestionIndex]?.text || "General system design"}`
        : "System design interview";

      const res = await fetch("/api/interviews/analyze-whiteboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, context }),
      });
      const data = await res.json();
      if (data.success) {
        setRekaAnalysis(data.data);
        setWhiteboardAnalysis(data.data.description);
      }
    } catch (err) {
      console.warn("Whiteboard analysis failed:", err);
    } finally {
      setIsAnalyzingWhiteboard(false);
    }
  };

  const handleCodeChange = async (state: CodeEditorState) => {
    if (state.code.length > 20) {
      extractEntitiesFromText(state.code);
    }
  };

  const handleRequestHint = async (code: string, language: string) => {
    try {
      const problemContext = activeInterview
        ? activeInterview.questions[activeInterview.currentQuestionIndex]?.text || ""
        : "";

      const res = await fetch("/api/interviews/analyze-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, problemContext }),
      });
      const data = await res.json();
      if (data.success) {
        const eval_ = data.data.evaluation;
        if (eval_.suggestions?.length > 0) {
          setHint(eval_.suggestions[0]);
        }
        if (eval_.issues?.length > 0) {
          setCodeAnalysis(eval_.issues.join(". "));
        }
        if (data.data.extractedEntities?.length > 0) {
          setExtractedSkills((prev) => {
            const existing = new Set(prev.map((e) => e.text.toLowerCase()));
            const newEntities = data.data.extractedEntities.filter(
              (e: ExtractedEntity) => !existing.has(e.text.toLowerCase())
            );
            return [...prev, ...newEntities];
          });
        }
      }
    } catch (err) {
      console.warn("Code analysis failed:", err);
    }
  };

  const handleComplete = () => {
    setActiveInterview(null);
    setLatestVoiceAnalysis(null);
    setExtractedSkills([]);
    setCodeAnalysis(undefined);
    setWhiteboardAnalysis(undefined);
    setRekaAnalysis(null);
    setHint(undefined);
    setShowWorkspace(false);
    router.push("/");
  };

  // ─── Study Plan Handlers ──────────────────────────────────────────
  const handleGeneratePlan = async () => {
    setGeneratingPlan(true);
    try {
      // Default availability: weekdays 6pm-10pm, weekends 10am-6pm
      const defaultAvailability = [
        { dayOfWeek: 0, startHour: 10, endHour: 18 },
        { dayOfWeek: 1, startHour: 18, endHour: 22 },
        { dayOfWeek: 2, startHour: 18, endHour: 22 },
        { dayOfWeek: 3, startHour: 18, endHour: 22 },
        { dayOfWeek: 4, startHour: 18, endHour: 22 },
        { dayOfWeek: 5, startHour: 18, endHour: 22 },
        { dayOfWeek: 6, startHour: 10, endHour: 18 },
      ];
      const res = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: schedule?.availability || defaultAvailability }),
      });
      const data = await res.json();
      if (data.success) {
        setSchedule(data.data);
      }
    } catch (err) {
      console.error("Generation failed:", err);
    } finally {
      setGeneratingPlan(false);
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

  const readyJobs = jobs.filter((j) => j.interviewReady);
  const otherJobs = jobs.filter((j) => !j.interviewReady);
  const completedBlocks = schedule?.studyPlan.filter((b) => b.completed).length || 0;
  const totalBlocks = schedule?.studyPlan.length || 0;

  // Get relevant study blocks for the current interview role
  const relevantStudyBlocks = schedule?.studyPlan.filter((block) => {
    if (!activeInterview) return true;
    const techStack = activeInterview.job.techStack.map((t) => t.toLowerCase());
    const gaps = activeInterview.job.skillGaps.map((g) => g.skillName.toLowerCase());
    const topicLower = block.topic.toLowerCase();
    return (
      techStack.some((t) => topicLower.includes(t)) ||
      gaps.some((g) => topicLower.includes(g)) ||
      block.type === "mock-interview" ||
      block.type === "coding-practice"
    );
  }) || [];

  return (
    <div>
      <Header health={health} />
      <div className="p-6">
        {activeInterview ? (
          <div className="space-y-4">
            {/* ─── Top Header Bar ──────────────────────────────────── */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Mic className="w-5 h-5 text-indigo-400" />
                  Mock Interview — {activeInterview.job.title} at{" "}
                  {activeInterview.job.company}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Voice is always active. Toggle Code/Whiteboard workspace below. AI analyzes everything in real-time.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Role context badge */}
                <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{activeInterview.job.company}</span>
                  <span className="text-slate-600">·</span>
                  <span className={activeInterview.job.matchScore >= 80 ? "text-emerald-400" : "text-amber-400"}>
                    {activeInterview.job.matchScore}% match
                  </span>
                  {activeInterview.job.techStack.length > 0 && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-500">
                        {activeInterview.job.techStack.slice(0, 3).join(", ")}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Main Layout: Voice (always visible) + Sidebar ──── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left 2 cols: Voice + Workspace */}
              <div className="lg:col-span-2 space-y-4">
                {/* ─── VOICE PANEL — Always Visible ──────────────── */}
                <InterviewPanel
                  interview={activeInterview}
                  onSubmitResponse={handleSubmitResponse}
                  onComplete={handleComplete}
                />

                {/* ─── Workspace Toggle Bar ──────────────────────── */}
                <div className="flex items-center justify-between bg-slate-900 rounded-xl p-2 border border-slate-700/50">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setShowWorkspace(true); setWorkspaceMode("code"); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        showWorkspace && workspaceMode === "code"
                          ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <Code className="w-4 h-4" />
                      Code Editor
                    </button>
                    <button
                      onClick={() => { setShowWorkspace(true); setWorkspaceMode("whiteboard"); }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        showWorkspace && workspaceMode === "whiteboard"
                          ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <Pencil className="w-4 h-4" />
                      Whiteboard
                    </button>
                  </div>
                  {showWorkspace && (
                    <button
                      onClick={() => setShowWorkspace(false)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <ChevronUp className="w-3 h-3" />
                      Collapse
                    </button>
                  )}
                  {!showWorkspace && (
                    <span className="text-[10px] text-slate-600 pr-2">
                      Open a workspace to code or draw
                    </span>
                  )}
                </div>

                {/* ─── Workspace Content (Code or Whiteboard) ────── */}
                {showWorkspace && (
                  <div className="transition-all">
                    {workspaceMode === "code" ? (
                      <CodeEditorPanel
                        onCodeChange={handleCodeChange}
                        onRequestHint={handleRequestHint}
                        hint={hint}
                        codeAnalysis={codeAnalysis}
                      />
                    ) : (
                      <WhiteboardPanel
                        onSnapshotReady={handleWhiteboardSnapshot}
                        analysis={rekaAnalysis}
                        isAnalyzing={isAnalyzingWhiteboard}
                      />
                    )}
                  </div>
                )}

                {/* ─── Study Plan Section (collapsible) ─────────── */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  <button
                    onClick={() => setShowStudyPlan(!showStudyPlan)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-750 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-semibold text-white">Study Plan & Practice</span>
                      {totalBlocks > 0 && (
                        <span className="text-[10px] text-slate-500 ml-1">
                          {completedBlocks}/{totalBlocks} complete
                        </span>
                      )}
                    </div>
                    {showStudyPlan ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {showStudyPlan && (
                    <div className="px-5 pb-5 space-y-4">
                      {/* Daily Challenge */}
                      {dailyChallenge && (
                        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Flame className="w-4 h-4 text-amber-400" />
                              <span className="text-xs font-semibold text-white">Daily Challenge</span>
                              <span className="text-[10px] text-amber-400/70">
                                {dailyChallenge.streak} day streak
                              </span>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${
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
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-[10px] text-slate-500">Target: {dailyChallenge.targetSkill}</span>
                            {!dailyChallenge.completed ? (
                              <button
                                onClick={handleCompleteChallenge}
                                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-medium transition-colors"
                              >
                                <Check className="w-3 h-3" />
                                Mark Done
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-400">Completed!</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Concept Practice Blocks */}
                      {activeInterview.job.skillGaps.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-xs font-medium text-red-400 uppercase tracking-wider">
                              Skill Gaps to Focus On
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {activeInterview.job.skillGaps.map((gap) => (
                              <div
                                key={gap.skillName}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg"
                              >
                                <Zap className="w-3 h-3 text-red-400" />
                                <span className="text-xs text-red-300">{gap.skillName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Relevant study blocks or generate prompt */}
                      {schedule && relevantStudyBlocks.length > 0 ? (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">
                                Study Blocks
                              </span>
                            </div>
                            {totalBlocks > 0 && (
                              <div className="w-24 bg-slate-700 rounded-full h-1.5">
                                <div
                                  className="bg-indigo-500 h-1.5 rounded-full transition-all"
                                  style={{ width: `${(completedBlocks / totalBlocks) * 100}%` }}
                                />
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {relevantStudyBlocks.slice(0, 6).map((block) => (
                              <div
                                key={block.id}
                                className={`rounded-lg border p-2.5 flex items-center gap-3 transition-all ${
                                  block.completed
                                    ? "bg-emerald-500/5 border-emerald-500/20 opacity-60"
                                    : TYPE_COLORS[block.type] || "bg-slate-700 border-slate-600 text-slate-300"
                                }`}
                              >
                                <button
                                  onClick={() => handleCompleteBlock(block.id)}
                                  className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                                    block.completed
                                      ? "bg-emerald-500 border-emerald-500"
                                      : "border-slate-500 hover:border-white"
                                  }`}
                                >
                                  {block.completed && <Check className="w-2.5 h-2.5 text-white" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-medium ${block.completed ? "line-through text-emerald-400/60" : "text-white"}`}>
                                    {block.topic}
                                  </p>
                                  <p className="text-[9px] text-slate-500">
                                    {block.date} · {block.startTime}–{block.endTime} · {block.type.replace("-", " ")}
                                  </p>
                                </div>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${PRIORITY_BADGE[block.priority]}`}>
                                  {block.priority}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Brain className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                          <p className="text-xs text-slate-500 mb-3">
                            Generate an AI study plan based on your skill gaps and upcoming interviews
                          </p>
                          <button
                            onClick={handleGeneratePlan}
                            disabled={generatingPlan}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 mx-auto"
                          >
                            {generatingPlan ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            {generatingPlan ? "Generating..." : "Generate Study Plan"}
                          </button>
                        </div>
                      )}

                      {/* Performance Trend (compact) */}
                      {perfHistory.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                              Performance Trend
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {perfHistory.slice(-4).map((snap, i) => (
                              <div key={i} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                                <div className="flex items-center gap-1.5 mb-1">
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
                                  <p className="text-[9px] text-emerald-400/70 truncate">
                                    + {snap.strengths[0]}
                                  </p>
                                )}
                                {snap.weaknesses.length > 0 && (
                                  <p className="text-[9px] text-red-400/70 truncate">
                                    - {snap.weaknesses[0]}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Right Sidebar ────────────────────────────────── */}
              <div className="space-y-4">
                {/* Voice analytics — always visible */}
                <VoiceAnalyticsPanel analysis={latestVoiceAnalysis} />

                {/* AI Insights */}
                <AIInsightsPanel
                  extractedSkills={extractedSkills}
                  codeAnalysis={codeAnalysis}
                  whiteboardAnalysis={whiteboardAnalysis}
                  hint={hint}
                />

                {/* Role Context */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    Role Context
                  </h3>
                  <div className="space-y-2 text-xs text-slate-400">
                    <p>
                      <span className="text-slate-500">Company:</span>{" "}
                      {activeInterview.job.company}
                    </p>
                    <p>
                      <span className="text-slate-500">Location:</span>{" "}
                      {activeInterview.job.location}
                    </p>
                    <p>
                      <span className="text-slate-500">Match:</span>{" "}
                      <span className={activeInterview.job.matchScore >= 80 ? "text-emerald-400" : "text-amber-400"}>
                        {activeInterview.job.matchScore}%
                      </span>
                    </p>
                    {activeInterview.job.techStack.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {activeInterview.job.techStack.slice(0, 8).map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {activeInterview.job.skillGaps.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700/50">
                        <p className="text-[10px] text-red-400/70 font-medium mb-1">Skill Gaps:</p>
                        <div className="flex flex-wrap gap-1">
                          {activeInterview.job.skillGaps.map((g) => (
                            <span key={g.skillName} className="px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded text-[10px] border border-red-500/20">
                              {g.skillName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick study tip in sidebar */}
                {dailyChallenge && !dailyChallenge.completed && (
                  <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-xl border border-amber-500/20 p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                        Daily Challenge
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
                      {dailyChallenge.question}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ─── No Active Interview — Selection View ─────────────── */
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-indigo-400" />
              Mock Interviews
            </h2>

            {/* Ready to interview */}
            {readyJobs.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">
                  Ready for Practice
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {readyJobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => startInterview(job.id)}
                      className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-left hover:border-indigo-500/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">
                          {job.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{job.company}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {job.matchScore}% match · {job.skillGaps.length} gaps
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Other discovered jobs */}
            {otherJobs.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">
                  All Discovered Jobs
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {otherJobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => startInterview(job.id)}
                      className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-left hover:border-indigo-500/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">
                          {job.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{job.company}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {job.matchScore}% match · {job.skillGaps.length} gaps
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Past interviews */}
            {interviews.filter((i) => i.status === "completed").length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">
                  Past Sessions
                </h3>
                <div className="space-y-2">
                  {interviews
                    .filter((i) => i.status === "completed")
                    .map((interview) => (
                      <div
                        key={interview.id}
                        className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm text-white">
                            {interview.job.title} at {interview.job.company}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(interview.startedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {interview.overallScore && (
                          <span
                            className={`text-lg font-bold ${
                              interview.overallScore >= 80
                                ? "text-emerald-400"
                                : interview.overallScore >= 60
                                  ? "text-amber-400"
                                  : "text-red-400"
                            }`}
                          >
                            {interview.overallScore}%
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Study Plan Section in non-interview view */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-bold text-white">Study Plan & Concept Practice</span>
                </div>
                <button
                  onClick={handleGeneratePlan}
                  disabled={generatingPlan}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {generatingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {generatingPlan ? "Generating..." : schedule ? "Regenerate" : "Generate Plan"}
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Daily Challenge */}
                  <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-white">Daily Challenge</span>
                      {dailyChallenge && (
                        <span className="text-[10px] text-amber-400/70 ml-auto">
                          {dailyChallenge.streak} day streak
                        </span>
                      )}
                    </div>
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
                        <p className="text-sm text-slate-300 mt-2 leading-relaxed">{dailyChallenge.question}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-[10px] text-slate-500">Target: {dailyChallenge.targetSkill}</span>
                          {!dailyChallenge.completed ? (
                            <button
                              onClick={handleCompleteChallenge}
                              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-medium transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              Mark Done
                            </button>
                          ) : (
                            <span className="text-xs text-emerald-400">Completed!</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Generate a study plan to unlock daily challenges.</p>
                    )}
                  </div>

                  {/* Performance snapshot */}
                  <div className="bg-slate-900/50 rounded-lg border border-slate-700/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-white">Performance Trend</span>
                    </div>
                    {perfHistory.length > 0 ? (
                      <div className="space-y-2">
                        {perfHistory.slice(-3).map((snap, i) => (
                          <div key={i} className="flex items-center gap-2">
                            {snap.overallTrend === "improving" ? (
                              <TrendingUp className="w-3 h-3 text-emerald-400" />
                            ) : snap.overallTrend === "declining" ? (
                              <TrendingDown className="w-3 h-3 text-red-400" />
                            ) : (
                              <Minus className="w-3 h-3 text-slate-400" />
                            )}
                            <span className="text-[10px] text-slate-400">{new Date(snap.date).toLocaleDateString()}</span>
                            {snap.strengths[0] && <span className="text-[9px] text-emerald-400/60 truncate">+{snap.strengths[0]}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 italic">Complete mock interviews to track progress.</p>
                    )}
                  </div>
                </div>

                {/* Study blocks */}
                {schedule && schedule.studyPlan.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-semibold text-white">Study Blocks</span>
                        <span className="text-[10px] text-slate-500">{completedBlocks}/{totalBlocks} complete</span>
                      </div>
                      <div className="w-32 bg-slate-700 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all"
                          style={{ width: totalBlocks > 0 ? `${(completedBlocks / totalBlocks) * 100}%` : "0%" }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {schedule.studyPlan.slice(0, 8).map((block) => (
                        <div
                          key={block.id}
                          className={`rounded-lg border p-2.5 flex items-center gap-3 transition-all ${
                            block.completed
                              ? "bg-emerald-500/5 border-emerald-500/20 opacity-60"
                              : TYPE_COLORS[block.type] || "bg-slate-700 border-slate-600 text-slate-300"
                          }`}
                        >
                          <button
                            onClick={() => handleCompleteBlock(block.id)}
                            className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              block.completed
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-slate-500 hover:border-white"
                            }`}
                          >
                            {block.completed && <Check className="w-2.5 h-2.5 text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium ${block.completed ? "line-through text-emerald-400/60" : "text-white"}`}>
                              {block.topic}
                            </p>
                            <p className="text-[9px] text-slate-500">
                              {block.date} · {block.startTime}–{block.endTime} · {block.type.replace("-", " ")}
                            </p>
                          </div>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${PRIORITY_BADGE[block.priority]}`}>
                            {block.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {readyJobs.length === 0 && otherJobs.length === 0 && interviews.length === 0 && (
              <div className="text-center py-12">
                <Mic className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 text-sm">
                  No interviews available yet. Discover jobs from the dashboard first.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
