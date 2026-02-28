"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { SystemHealth, Job, UserProfile } from "@/lib/types";
import {
  FileText,
  Sparkles,
  Target,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Zap,
  RefreshCw,
  Brain,
  TrendingUp,
  Shield,
  Eye,
  Bot,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Save,
  Star,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────

interface ATSAnalysis {
  atsScore: number;
  humanScore: number;
  overallScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  entityOverlap: number;
  categoryBreakdown: Record<
    string,
    { jdCount: number; resumeCount: number; overlap: number }
  >;
}

interface AlignmentResult {
  id: string;
  jobId: string;
  originalResume: string;
  alignedResume: string;
  resumeEntities: { text: string; label: string; score: number }[];
  jdEntities: { text: string; label: string; score: number }[];
  alignedEntities: { text: string; label: string; score: number }[];
  missingKeywords: string[];
  addedKeywords: string[];
  atsScore: number;
  humanScore: number;
  overallScore: number;
  suggestions: string[];
}

// ─── Component ──────────────────────────────────────────────────────

export default function ResumePage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500 text-sm">Loading resume optimizer...</div>}>
      <ResumePageContent />
    </Suspense>
  );
}

function ResumePageContent() {
  const searchParams = useSearchParams();
  const [health, setHealth] = useState<SystemHealth>({
    orchestratorRunning: false,
    activeScouts: 0,
    neo4jConnected: false,
    totalJobsFound: 0,
    interviewsReady: 0,
    skillGapsIdentified: 0,
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [resumeText, setResumeText] = useState("");
  const [analysis, setAnalysis] = useState<ATSAnalysis | null>(null);
  const [alignment, setAlignment] = useState<AlignmentResult | null>(null);
  const [bulkResults, setBulkResults] = useState<AlignmentResult[]>([]);
  const [trainingStatus, setTrainingStatus] = useState<{
    samplesCollected: number;
    lastFineTuneAt?: string;
    threshold: number;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aligning, setAligning] = useState(false);
  const [bulkAligning, setBulkAligning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "editor" | "analysis" | "aligned" | "training"
  >("editor");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [alignmentHistoryList, setAlignmentHistoryList] = useState<
    { id: string; jobTitle: string; company: string; atsScore: number; overallScore: number; createdAt: string; feedback: { rating: string } | null; alignedResume: string; missingKeywords?: string[]; addedKeywords?: string[] }[]
  >([]);
  const [feedbackRating, setFeedbackRating] = useState<"good" | "needs_improvement" | "bad" | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, profileRes, jobsRes] = await Promise.all([
        fetch("/api/system"),
        fetch("/api/profile"),
        fetch("/api/jobs"),
      ]);
      const healthData = await healthRes.json();
      const profileData = await profileRes.json();
      const jobsData = await jobsRes.json();

      if (healthData.success) setHealth(healthData.data);
      if (profileData.success && profileData.data) {
        setProfile(profileData.data);
        if (!resumeText && profileData.data.resumeSummary) {
          setResumeText(profileData.data.resumeSummary);
        }
      }
      if (jobsData.success) setJobs(jobsData.data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
  }, [resumeText]);

  useEffect(() => {
    fetchData();
    fetchTrainingStatus();
    fetchAlignmentHistory();
    loadDefaultResume();
  }, [fetchData]);

  // Auto-select job from URL param
  useEffect(() => {
    const jobId = searchParams.get("jobId");
    if (jobId && jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobId);
    }
  }, [searchParams, jobs, selectedJobId]);

  const fetchTrainingStatus = async () => {
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "training_status" }),
      });
      const data = await res.json();
      if (data.success) setTrainingStatus(data.data);
    } catch {
      // Ignore
    }
  };

  const loadDefaultResume = async () => {
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_default_resume" }),
      });
      const data = await res.json();
      if (data.success && data.data.resume && !resumeText) {
        setResumeText(data.data.resume);
      }
    } catch {
      // Ignore
    }
  };

  const handleSaveDefault = async () => {
    if (!resumeText.trim()) return;
    setSavingDefault(true);
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_default_resume", resume: resumeText }),
      });
      const data = await res.json();
      if (data.success) {
        setDefaultSaved(true);
        setTimeout(() => setDefaultSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save default resume:", err);
    } finally {
      setSavingDefault(false);
    }
  };

  const fetchAlignmentHistory = async () => {
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_alignments" }),
      });
      const data = await res.json();
      if (data.success) setAlignmentHistoryList(data.data.alignments);
    } catch {
      // Ignore
    }
  };

  const handleSubmitFeedback = async () => {
    if (!alignment?.id || !feedbackRating) return;
    setFeedbackSubmitting(true);
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_feedback",
          alignmentId: alignment.id,
          rating: feedbackRating,
          comment: feedbackComment || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackSubmitted(true);
        fetchTrainingStatus();
        fetchAlignmentHistory();
      }
    } catch (err) {
      console.error("Feedback submission failed:", err);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // ─── Actions ────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!resumeText.trim() || !selectedJobId) return;
    const selectedJob = jobs.find((j) => j.id === selectedJobId);
    if (!selectedJob?.description) return;

    setAnalyzing(true);
    setActiveTab("analysis");
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "analyze",
          resume: resumeText,
          jobDescription: selectedJob.description,
        }),
      });
      const data = await res.json();
      if (data.success) setAnalysis(data.data.analysis ?? data.data);
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAlign = async () => {
    if (!resumeText.trim() || !selectedJobId) return;
    const selectedJob = jobs.find((j) => j.id === selectedJobId);
    if (!selectedJob?.description) return;

    setAligning(true);
    setActiveTab("aligned");
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "align",
          resume: resumeText,
          jobDescription: selectedJob.description,
          jobId: selectedJob.id,
          jobTitle: selectedJob.title,
          company: selectedJob.company,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlignment(data.data.alignment ?? data.data);
        fetchTrainingStatus();
        fetchAlignmentHistory();
        setFeedbackRating(null);
        setFeedbackComment("");
        setFeedbackSubmitted(false);
      }
    } catch (err) {
      console.error("Alignment failed:", err);
    } finally {
      setAligning(false);
    }
  };

  const handleBulkAlign = async () => {
    if (!resumeText.trim()) return;
    setBulkAligning(true);
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "align_all",
          resume: resumeText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkResults(data.data);
        fetchTrainingStatus();
      }
    } catch (err) {
      console.error("Bulk alignment failed:", err);
    } finally {
      setBulkAligning(false);
    }
  };

  const handleFineTune = async () => {
    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger_finetune" }),
      });
      const data = await res.json();
      if (data.success) fetchTrainingStatus();
    } catch (err) {
      console.error("Fine-tune trigger failed:", err);
    }
  };

  const copyAligned = () => {
    if (alignment?.alignedResume) {
      navigator.clipboard.writeText(alignment.alignedResume);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div>
      <Header health={health} />

      <div className="p-6 space-y-6">
        {/* Hero */}
        <div className="relative bg-gradient-to-br from-indigo-950/50 via-slate-900/80 to-purple-950/30 rounded-2xl border border-indigo-500/20 p-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span className="text-sm text-indigo-400 font-medium">
                  Pioneer AI-Powered
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Resume ATS Optimizer
              </h1>
              <p className="text-sm text-slate-400 max-w-lg">
                Automatically align your resume to any job description. Pioneer
                GLiNER-2 extracts key entities, Gemini rewrites for ATS
                compatibility, then Pioneer verifies the result. Every
                alignment trains the model to give better suggestions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  health.pioneerConnected
                    ? "bg-indigo-500/20 text-indigo-400"
                    : "bg-slate-700 text-slate-400"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    health.pioneerConnected
                      ? "bg-indigo-400 animate-pulse"
                      : "bg-slate-500"
                  }`}
                />
                {health.pioneerConnected
                  ? `Pioneer Cloud (${health.pioneerModel || "gliner-2"})`
                  : "Pioneer Offline"}
              </span>
            </div>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="ATS Score"
            value={
              alignment?.atsScore ?? analysis?.atsScore ?? "—"
            }
            suffix="%"
            icon={Shield}
            color="indigo"
            description="Estimated ATS pass rate"
          />
          <StatCard
            label="Human Score"
            value={
              alignment?.humanScore ?? analysis?.humanScore ?? "—"
            }
            suffix="%"
            icon={Eye}
            color="emerald"
            description="Readability score"
          />
          <StatCard
            label="Entity Overlap"
            value={
              analysis
                ? Math.round(analysis.entityOverlap * 100)
                : alignment
                ? "✓"
                : "—"
            }
            suffix={analysis ? "%" : ""}
            icon={Target}
            color="amber"
            description="JD keyword coverage"
          />
          <StatCard
            label="Training Samples"
            value={trainingStatus?.samplesCollected ?? 0}
            suffix={`/${trainingStatus?.threshold ?? 50}`}
            icon={Brain}
            color="purple"
            description="For Pioneer fine-tuning"
          />
        </div>

        {/* Job Selector + Actions */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1.5">
                Target Job Description
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => {
                  setSelectedJobId(e.target.value);
                  setAnalysis(null);
                  setAlignment(null);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select a discovered job...</option>
                {jobs
                  .sort((a, b) => b.matchScore - a.matchScore)
                  .map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} @ {job.company} (
                      {job.matchScore}% match)
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pb-0.5">
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !selectedJobId || !resumeText.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
              >
                {analyzing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BarChart3 className="w-3.5 h-3.5" />
                )}
                Analyze ATS
              </button>

              <button
                onClick={handleAlign}
                disabled={aligning || !selectedJobId || !resumeText.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
              >
                {aligning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Auto-Align
              </button>

              <button
                onClick={handleBulkAlign}
                disabled={bulkAligning || !resumeText.trim() || jobs.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
              >
                {bulkAligning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                Align All Jobs
              </button>
            </div>
          </div>

          {selectedJob && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedJob.techStack.slice(0, 10).map((tech) => (
                <span
                  key={tech}
                  className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20"
                >
                  {tech}
                </span>
              ))}
              {selectedJob.skillGaps.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {selectedJob.skillGaps.length} skill gaps
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700 w-fit">
          {(
            [
              { key: "editor", label: "Resume Editor", icon: FileText },
              { key: "analysis", label: "ATS Analysis", icon: BarChart3 },
              { key: "aligned", label: "Aligned Resumes", icon: Sparkles },
              { key: "training", label: "Pioneer Training", icon: Brain },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content (left 2 cols) */}
          <div className="lg:col-span-2">
            {activeTab === "editor" && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Your Resume
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveDefault}
                      disabled={savingDefault || !resumeText.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors"
                    >
                      {defaultSaved ? (
                        <Check className="w-3 h-3" />
                      ) : savingDefault ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      {defaultSaved ? "Saved!" : "Save as Default"}
                    </button>
                    <span className="text-[10px] text-slate-500">
                      {resumeText.length} characters
                    </span>
                  </div>
                </div>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your full resume text here..."
                  rows={20}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white font-mono leading-relaxed focus:border-indigo-500 focus:outline-none resize-none"
                />
                <p className="text-[10px] text-slate-500 mt-2">
                  Powered by <span className="text-indigo-400">Pioneer GLiNER-2</span> + <span className="text-blue-400">Gemini 2.5 Flash</span>
                </p>
              </div>
            )}

            {activeTab === "analysis" && (
              <div className="space-y-4">
                {analyzing ? (
                  <LoadingCard message="Pioneer is extracting entities from your resume and the JD..." />
                ) : analysis ? (
                  <>
                    {/* Score Overview */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-400" />
                        ATS Score Breakdown
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <ScoreBar
                          label="ATS Score"
                          value={analysis.atsScore}
                          color="indigo"
                        />
                        <ScoreBar
                          label="Human Score"
                          value={analysis.humanScore}
                          color="emerald"
                        />
                        <ScoreBar
                          label="Overall"
                          value={analysis.overallScore}
                          color="purple"
                        />
                      </div>
                    </div>

                    {/* Entity Overlap by Category */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4 text-amber-400" />
                        Entity Coverage by Category
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(analysis.categoryBreakdown).map(
                          ([cat, data]) => (
                            <button
                              key={cat}
                              onClick={() =>
                                setExpandedCategory(
                                  expandedCategory === cat ? null : cat
                                )
                              }
                              className="w-full bg-slate-900 rounded-lg p-3 text-left hover:bg-slate-900/80 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-white capitalize">
                                    {cat.replace(/_/g, " ")}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {data.resumeCount}/{data.jdCount} matched
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        data.overlap >= 0.7
                                          ? "bg-emerald-400"
                                          : data.overlap >= 0.4
                                          ? "bg-amber-400"
                                          : "bg-red-400"
                                      }`}
                                      style={{
                                        width: `${Math.round(
                                          data.overlap * 100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-400 w-8 text-right">
                                    {Math.round(data.overlap * 100)}%
                                  </span>
                                </div>
                              </div>
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Keywords */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                        <h4 className="text-xs font-semibold text-emerald-400 mb-3 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Matched Keywords ({analysis.matchedKeywords.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.matchedKeywords.map((kw) => (
                            <span
                              key={kw}
                              className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                        <h4 className="text-xs font-semibold text-red-400 mb-3 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Missing Keywords ({analysis.missingKeywords.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.missingKeywords.map((kw) => (
                            <span
                              key={kw}
                              className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 rounded border border-red-500/20"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Suggestions */}
                    {analysis.suggestions.length > 0 && (
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                        <h4 className="text-xs font-semibold text-indigo-400 mb-3 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Suggestions
                        </h4>
                        <ul className="space-y-2">
                          {analysis.suggestions.map((s, i) => (
                            <li
                              key={i}
                              className="text-xs text-slate-300 flex items-start gap-2"
                            >
                              <ArrowRight className="w-3 h-3 text-indigo-400 mt-0.5 flex-shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState
                    icon={BarChart3}
                    title="No Analysis Yet"
                    description="Select a job and click 'Analyze ATS' to see how your resume matches the job description using Pioneer GLiNER-2."
                  />
                )}
              </div>
            )}

            {activeTab === "aligned" && (
              <div className="space-y-4">
                {aligning ? (
                  <LoadingCard message="Pioneer is extracting entities → Gemini is rewriting → Pioneer is re-verifying..." />
                ) : alignment ? (
                  <>
                    {/* Score comparison */}
                    <div className="bg-gradient-to-r from-indigo-950/50 to-purple-950/30 rounded-xl border border-indigo-500/20 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-400" />
                          Alignment Results
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={copyAligned}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors"
                          >
                            {copied ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {copied ? "Copied!" : "Copy"}
                          </button>
                          <button
                            onClick={() => {
                              const text = alignment.alignedResume;
                              const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Aligned Resume</title>
<style>
  body { font-family: 'Georgia', serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #1a1a1a; font-size: 11pt; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Georgia', serif; font-size: 11pt; }
</style></head>
<body><pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
                              const blob = new Blob([html], { type: 'text/html' });
                              const printWindow = window.open('', '_blank');
                              if (printWindow) {
                                printWindow.document.write(html);
                                printWindow.document.close();
                                setTimeout(() => { printWindow.print(); }, 500);
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            Download PDF
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <ScoreComparison
                          label="ATS Score"
                          before={analysis?.atsScore}
                          after={alignment.atsScore}
                          color="indigo"
                        />
                        <ScoreComparison
                          label="Human Score"
                          before={analysis?.humanScore}
                          after={alignment.humanScore}
                          color="emerald"
                        />
                        <ScoreComparison
                          label="Overall"
                          before={analysis?.overallScore}
                          after={alignment.overallScore}
                          color="purple"
                        />
                      </div>
                    </div>

                    {/* Added keywords */}
                    {alignment.addedKeywords.length > 0 && (
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                        <h4 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Keywords Added ({alignment.addedKeywords.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {alignment.addedKeywords.map((kw) => (
                            <span
                              key={kw}
                              className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20"
                            >
                              + {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Aligned resume text */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        Optimized Resume
                      </h3>
                      <div className="bg-slate-900 rounded-lg border border-slate-700 p-4 max-h-[500px] overflow-y-auto">
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                          {alignment.alignedResume}
                        </pre>
                      </div>
                    </div>

                    {/* Suggestions */}
                    {alignment.suggestions.length > 0 && (
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                        <h4 className="text-xs font-semibold text-indigo-400 mb-3 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Additional Suggestions
                        </h4>
                        <ul className="space-y-2">
                          {alignment.suggestions.map((s, i) => (
                            <li
                              key={i}
                              className="text-xs text-slate-300 flex items-start gap-2"
                            >
                              <ArrowRight className="w-3 h-3 text-indigo-400 mt-0.5 flex-shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* ─── Feedback Section ─────────────────────────── */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-800/80 rounded-xl border border-amber-500/20 p-5">
                      <h4 className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Rate This Alignment
                        <span className="text-[9px] text-slate-500 ml-1">— helps refine the Pioneer pipeline</span>
                      </h4>

                      {feedbackSubmitted ? (
                        <div className="flex items-center gap-2 py-3">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-medium">
                            Feedback recorded! Training data updated.
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Rating buttons */}
                          <div className="flex items-center gap-2">
                            {(
                              [
                                { key: "good" as const, label: "Good", icon: ThumbsUp, color: "emerald" },
                                { key: "needs_improvement" as const, label: "Needs Work", icon: Star, color: "amber" },
                                { key: "bad" as const, label: "Poor", icon: ThumbsDown, color: "red" },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => setFeedbackRating(opt.key)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                  feedbackRating === opt.key
                                    ? `bg-${opt.color}-500/20 text-${opt.color}-400 ring-1 ring-${opt.color}-500/40`
                                    : "bg-slate-700 text-slate-400 hover:text-white"
                                }`}
                              >
                                <opt.icon className="w-3.5 h-3.5" />
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {/* Optional comment */}
                          {feedbackRating && (
                            <>
                              <textarea
                                value={feedbackComment}
                                onChange={(e) => setFeedbackComment(e.target.value)}
                                placeholder="Optional: What could be better? (helps fine-tune Pioneer)"
                                rows={2}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none resize-none"
                              />
                              <button
                                onClick={handleSubmitFeedback}
                                disabled={feedbackSubmitting}
                                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                              >
                                {feedbackSubmitting ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <MessageSquare className="w-3 h-3" />
                                )}
                                Submit Feedback
                              </button>
                            </>
                          )}

                          <p className="text-[9px] text-slate-600">
                            Feedback is used as training signal for Pioneer fine-tuning — bad ratings reduce weight, good ratings reinforce patterns.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    icon={Sparkles}
                    title="No Alignment Yet"
                    description="Click 'Auto-Align' to have Pioneer + Gemini automatically optimize your resume for the selected job's ATS."
                  />
                )}

                {/* Past Aligned Resumes */}
                {alignmentHistoryList.length > 0 && (
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      Past Aligned Resumes ({alignmentHistoryList.length})
                    </h3>
                    <div className="space-y-3">
                      {alignmentHistoryList.map((h) => (
                        <div
                          key={h.id}
                          className="bg-slate-900 rounded-lg border border-slate-700 p-4 hover:border-indigo-500/30 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="text-xs font-semibold text-white">{h.jobTitle}</h4>
                              <p className="text-[10px] text-slate-400">{h.company} &middot; {new Date(h.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${h.atsScore >= 80 ? "text-emerald-400" : h.atsScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                                ATS: {h.atsScore}%
                              </span>
                              {h.feedback ? (
                                <span className={`text-[9px] px-2 py-0.5 rounded ${h.feedback.rating === "good" ? "bg-emerald-500/10 text-emerald-400" : h.feedback.rating === "bad" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                                  {h.feedback.rating === "good" ? "Approved" : h.feedback.rating === "bad" ? "Rejected" : "Needs Work"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="bg-slate-800 rounded-lg border border-slate-700/50 p-3 max-h-24 overflow-y-auto mb-2">
                            <pre className="text-[10px] text-slate-400 whitespace-pre-wrap font-mono">{h.alignedResume.slice(0, 300)}...</pre>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setAlignment({
                                  id: h.id,
                                  jobId: "",
                                  originalResume: resumeText,
                                  alignedResume: h.alignedResume,
                                  resumeEntities: [],
                                  jdEntities: [],
                                  alignedEntities: [],
                                  missingKeywords: h.missingKeywords || [],
                                  addedKeywords: h.addedKeywords || [],
                                  atsScore: h.atsScore,
                                  humanScore: 0,
                                  overallScore: h.overallScore,
                                  suggestions: [],
                                });
                                setFeedbackSubmitted(!!h.feedback);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              View full &rarr;
                            </button>
                            <button
                              onClick={() => {
                                const text = h.alignedResume;
                                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Aligned Resume - ${h.jobTitle}</title><style>body{font-family:'Georgia',serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6;color:#1a1a1a;font-size:11pt;}pre{white-space:pre-wrap;word-wrap:break-word;font-family:'Georgia',serif;font-size:11pt;}</style></head><body><pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
                                const printWindow = window.open('', '_blank');
                                if (printWindow) {
                                  printWindow.document.write(html);
                                  printWindow.document.close();
                                  setTimeout(() => { printWindow.print(); }, 500);
                                }
                              }}
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                            >
                              <Download className="w-2.5 h-2.5" />
                              PDF
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "training" && (
              <div className="space-y-4">
                {/* Training Overview */}
                <div className="bg-gradient-to-r from-purple-950/50 to-indigo-950/30 rounded-xl border border-purple-500/20 p-5">
                  <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    Pioneer Fine-Tuning Pipeline
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Every resume alignment generates a training sample. When{" "}
                    {trainingStatus?.threshold ?? 50} samples are collected,
                    Pioneer automatically fine-tunes a custom GLiNER model
                    optimized for your resume&apos;s domain.
                  </p>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-400">
                        Training Data Progress
                      </span>
                      <span className="text-xs text-purple-400 font-medium">
                        {trainingStatus?.samplesCollected ?? 0}/
                        {trainingStatus?.threshold ?? 50} samples
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            ((trainingStatus?.samplesCollected ?? 0) /
                              (trainingStatus?.threshold ?? 50)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {trainingStatus?.lastFineTuneAt && (
                    <p className="text-[10px] text-slate-500">
                      Last fine-tune:{" "}
                      {new Date(
                        trainingStatus.lastFineTuneAt
                      ).toLocaleString()}
                    </p>
                  )}

                  <button
                    onClick={handleFineTune}
                    disabled={
                      (trainingStatus?.samplesCollected ?? 0) < 5
                    }
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Trigger Fine-Tune Now
                  </button>
                </div>

                {/* How it Works */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                  <h4 className="text-xs font-semibold text-white mb-4">
                    How the Pipeline Works
                  </h4>
                  <div className="space-y-3">
                    {[
                      {
                        step: 1,
                        label: "Extract",
                        desc: "Pioneer GLiNER-2 extracts entities from both your resume and the JD",
                        icon: Target,
                        color: "indigo",
                      },
                      {
                        step: 2,
                        label: "Compute Gap",
                        desc: "Calculate entity overlap — what's in the JD that's missing from your resume",
                        icon: BarChart3,
                        color: "amber",
                      },
                      {
                        step: 3,
                        label: "Rewrite",
                        desc: "Gemini 2.5 Flash rewrites resume sections to incorporate missing keywords naturally",
                        icon: Sparkles,
                        color: "emerald",
                      },
                      {
                        step: 4,
                        label: "Verify",
                        desc: "Pioneer re-extracts from the rewritten resume to confirm ATS coverage improved",
                        icon: CheckCircle,
                        color: "purple",
                      },
                      {
                        step: 5,
                        label: "Collect",
                        desc: "Store (resume, JD, aligned_resume, score) as training data",
                        icon: Brain,
                        color: "cyan",
                      },
                      {
                        step: 6,
                        label: "Fine-Tune",
                        desc: "Auto-trigger Pioneer fine-tuning when enough real-world data is collected",
                        icon: Zap,
                        color: "pink",
                      },
                    ].map((s) => (
                      <div
                        key={s.step}
                        className="flex items-start gap-3 bg-slate-900 rounded-lg p-3"
                      >
                        <div
                          className={`w-7 h-7 rounded-lg bg-${s.color}-500/10 flex items-center justify-center flex-shrink-0`}
                        >
                          <s.icon
                            className={`w-3.5 h-3.5 text-${s.color}-400`}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white">
                            {s.step}. {s.label}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {s.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar (right col) */}
          <div className="space-y-4">
            {/* Bulk Results */}
            {bulkResults.length > 0 && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  Bulk Alignment Results
                </h3>
                <div className="space-y-2">
                  {bulkResults.map((r) => {
                    const job = jobs.find((j) => j.id === r.jobId);
                    return (
                      <div
                        key={r.id}
                        className="bg-slate-900 rounded-lg p-3 cursor-pointer hover:bg-slate-900/80 transition-colors"
                        onClick={() => {
                          setAlignment(r);
                          setSelectedJobId(r.jobId);
                          setActiveTab("aligned");
                        }}
                      >
                        <p className="text-xs text-white font-medium truncate">
                          {job?.title ?? "Unknown Job"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {job?.company}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span
                            className={`text-[10px] font-medium ${
                              r.atsScore >= 80
                                ? "text-emerald-400"
                                : r.atsScore >= 50
                                ? "text-amber-400"
                                : "text-red-400"
                            }`}
                          >
                            ATS: {r.atsScore}%
                          </span>
                          <span className="text-[10px] text-slate-500">
                            +{r.addedKeywords.length} keywords
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Entity Breakdown (if alignment exists) */}
            {alignment && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  Pioneer Entities Detected
                </h3>
                <div className="space-y-3">
                  <EntityGroup
                    label="Resume"
                    entities={alignment.resumeEntities}
                    color="blue"
                  />
                  <EntityGroup
                    label="Job Description"
                    entities={alignment.jdEntities}
                    color="amber"
                  />
                  <EntityGroup
                    label="Aligned Resume"
                    entities={alignment.alignedEntities}
                    color="emerald"
                  />
                </div>
              </div>
            )}

            {/* Pioneer Model Info */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                Pioneer Model
              </h3>
              <div className="space-y-2">
                <InfoRow
                  label="Backend"
                  value={
                    health.glinerBackend === "pioneer"
                      ? "Cloud (Primary)"
                      : health.glinerBackend === "local"
                      ? "Local (Fallback)"
                      : "Regex (Offline)"
                  }
                />
                <InfoRow
                  label="Model"
                  value={health.pioneerModel || "gliner-2"}
                />
                <InfoRow
                  label="Status"
                  value={health.pioneerConnected ? "Connected" : "Disconnected"}
                  isStatus
                  active={health.pioneerConnected}
                />
              </div>
            </div>

            {/* Alignment History */}
            {alignmentHistoryList.length > 0 && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Recent Alignments ({alignmentHistoryList.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {alignmentHistoryList.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => {
                        setAlignment({
                          id: h.id,
                          jobId: "",
                          originalResume: resumeText,
                          alignedResume: h.alignedResume,
                          resumeEntities: [],
                          jdEntities: [],
                          alignedEntities: [],
                          missingKeywords: [],
                          addedKeywords: [],
                          atsScore: h.atsScore,
                          humanScore: 0,
                          overallScore: h.overallScore,
                          suggestions: [],
                        });
                        setActiveTab("aligned");
                        setFeedbackSubmitted(!!h.feedback);
                        setFeedbackRating(h.feedback?.rating as "good" | "needs_improvement" | "bad" || null);
                      }}
                      className="w-full bg-slate-900 rounded-lg p-3 text-left hover:bg-slate-900/80 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-white font-medium truncate">{h.jobTitle}</p>
                          <p className="text-[10px] text-slate-400">{h.company}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium ${h.atsScore >= 80 ? "text-emerald-400" : h.atsScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                            {h.atsScore}%
                          </span>
                          {h.feedback && (
                            <span className={`w-2 h-2 rounded-full ${h.feedback.rating === "good" ? "bg-emerald-400" : h.feedback.rating === "bad" ? "bg-red-400" : "bg-amber-400"}`} />
                          )}
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-600 mt-1">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Tips */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Tips for Higher ATS Scores
              </h3>
              <ul className="space-y-2">
                {[
                  "Use exact keywords from the job description",
                  "Include both acronyms and full forms (e.g., ML & Machine Learning)",
                  "Match the job's required certifications exactly",
                  "Use active verbs: 'Developed', 'Implemented', 'Optimized'",
                  "Quantify achievements with numbers when possible",
                ].map((tip, i) => (
                  <li
                    key={i}
                    className="text-[10px] text-slate-400 flex items-start gap-1.5"
                  >
                    <ArrowRight className="w-2.5 h-2.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  color,
  description,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  description: string;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    indigo: { bg: "bg-indigo-400/10", text: "text-indigo-400" },
    emerald: { bg: "bg-emerald-400/10", text: "text-emerald-400" },
    amber: { bg: "bg-amber-400/10", text: "text-amber-400" },
    purple: { bg: "bg-purple-400/10", text: "text-purple-400" },
  };
  const c = colorMap[color] ?? colorMap.indigo;

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">
        {value}
        {suffix && (
          <span className="text-lg text-slate-500 ml-0.5">{suffix}</span>
        )}
      </p>
      <p className="text-[10px] text-slate-500 mt-1">{description}</p>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const barColor =
    color === "indigo"
      ? "bg-indigo-500"
      : color === "emerald"
      ? "bg-emerald-500"
      : "bg-purple-500";
  const textColor =
    color === "indigo"
      ? "text-indigo-400"
      : color === "emerald"
      ? "text-emerald-400"
      : "text-purple-400";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={`text-xs font-bold ${textColor}`}>{value}%</span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ScoreComparison({
  label,
  before,
  after,
  color,
}: {
  label: string;
  before?: number;
  after: number;
  color: string;
}) {
  const improvement = before !== undefined ? after - before : 0;
  const textColor =
    color === "indigo"
      ? "text-indigo-400"
      : color === "emerald"
      ? "text-emerald-400"
      : "text-purple-400";

  return (
    <div className="text-center">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${textColor}`}>{after}%</p>
      {before !== undefined && improvement !== 0 && (
        <p
          className={`text-[10px] font-medium mt-0.5 ${
            improvement > 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {improvement > 0 ? "+" : ""}
          {improvement}% from original
        </p>
      )}
    </div>
  );
}

function EntityGroup({
  label,
  entities,
  color,
}: {
  label: string;
  entities: { text: string; label: string; score: number }[];
  color: string;
}) {
  const tagColor =
    color === "blue"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
      : color === "amber"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

  return (
    <div>
      <p className="text-[10px] text-slate-500 mb-1.5">
        {label} ({entities.length})
      </p>
      <div className="flex flex-wrap gap-1">
        {entities.slice(0, 12).map((e, i) => (
          <span
            key={`${e.text}-${i}`}
            className={`text-[9px] px-1.5 py-0.5 rounded border ${tagColor}`}
            title={`${e.label} (${(e.score * 100).toFixed(0)}%)`}
          >
            {e.text}
          </span>
        ))}
        {entities.length > 12 && (
          <span className="text-[9px] text-slate-500">
            +{entities.length - 12} more
          </span>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  isStatus,
  active,
}: {
  label: string;
  value: string;
  isStatus?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
      <span className="text-[10px] text-slate-500">{label}</span>
      {isStatus ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-300">{value}</span>
          <span
            className={`w-2 h-2 rounded-full ${
              active ? "bg-emerald-400" : "bg-slate-600"
            }`}
          />
        </div>
      ) : (
        <span className="text-[10px] text-slate-300">{value}</span>
      )}
    </div>
  );
}

function LoadingCard({ message }: { message: string }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-indigo-500/20 p-8 flex flex-col items-center justify-center">
      <div className="relative mb-4">
        <div className="w-12 h-12 border-2 border-indigo-500/20 rounded-full" />
        <div className="absolute inset-0 w-12 h-12 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-sm text-indigo-400 font-medium text-center">
        {message}
      </p>
      <p className="text-[10px] text-slate-500 mt-2">
        Powered by Pioneer GLiNER-2
      </p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 flex flex-col items-center justify-center">
      <div className="p-3 bg-slate-700/50 rounded-xl mb-3">
        <Icon className="w-6 h-6 text-slate-500" />
      </div>
      <h3 className="text-sm font-medium text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-500 text-center max-w-sm">
        {description}
      </p>
    </div>
  );
}
