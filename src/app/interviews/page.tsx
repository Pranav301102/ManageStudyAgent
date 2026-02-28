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
} from "@/lib/types";
import {
  Mic,
  Briefcase,
  Code,
  Pencil,
  ChevronUp,
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

  const fetchData = useCallback(async () => {
    const [healthRes, interviewsRes, jobsRes] = await Promise.all([
      fetch("/api/system"),
      fetch("/api/interviews"),
      fetch("/api/jobs"),
    ]);
    const healthData = await healthRes.json();
    const interviewsData = await interviewsRes.json();
    const jobsData = await jobsRes.json();

    if (healthData.success) setHealth(healthData.data);
    if (interviewsData.success) setInterviews(interviewsData.data);
    if (jobsData.success) setJobs(jobsData.data);
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

  const readyJobs = jobs.filter((j) => j.interviewReady);
  const otherJobs = jobs.filter((j) => !j.interviewReady);

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
