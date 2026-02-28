"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { SystemHealth, Application, ApplicationStatus, Job } from "@/lib/types";
import {
    Kanban,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Calendar,
    FileText,
    Plus,
    Clock,
    Loader2,
    Target,
    MapPin,
    AlertTriangle,
    Mic,
    Sparkles,
    Briefcase,
    ExternalLink,
} from "lucide-react";

const STATUS_COLUMNS: { status: ApplicationStatus; label: string; color: string }[] = [
    { status: "saved", label: "Saved", color: "bg-slate-500" },
    { status: "applied", label: "Applied", color: "bg-blue-500" },
    { status: "screening", label: "Screening", color: "bg-indigo-500" },
    { status: "phone-screen", label: "Phone Screen", color: "bg-violet-500" },
    { status: "technical", label: "Technical", color: "bg-purple-500" },
    { status: "onsite", label: "On-site", color: "bg-amber-500" },
    { status: "offer", label: "Offer 🎉", color: "bg-emerald-500" },
    { status: "rejected", label: "Rejected", color: "bg-red-500/60" },
];

type PageTab = "pipeline" | "discover";

export default function ApplicationsPage() {
    const router = useRouter();
    const [health, setHealth] = useState<SystemHealth>({
        orchestratorRunning: false, activeScouts: 0, neo4jConnected: false,
        totalJobsFound: 0, interviewsReady: 0, skillGapsIdentified: 0,
    });
    const [applications, setApplications] = useState<Application[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeTab, setActiveTab] = useState<PageTab>("pipeline");

    const fetchData = useCallback(async () => {
        try {
            const [healthRes, appsRes, jobsRes] = await Promise.all([
                fetch("/api/system"),
                fetch("/api/applications"),
                fetch("/api/jobs"),
            ]);
            const h = await healthRes.json();
            const a = await appsRes.json();
            const j = await jobsRes.json();
            if (h.success) setHealth(h.data);
            if (a.success) setApplications(a.data);
            if (j.success) setJobs(j.data);
        } catch (err) {
            console.error("Fetch failed:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleAddApplication = async (jobId: string) => {
        try {
            const res = await fetch("/api/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId }),
            });
            const data = await res.json();
            if (data.success) {
                await fetchData();
                setShowAddModal(false);
            }
        } catch (err) {
            console.error("Failed to add application:", err);
        }
    };

    const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
        try {
            await fetch("/api/applications", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ applicationId: appId, status: newStatus }),
            });
            await fetchData();
        } catch (err) {
            console.error("Status update failed:", err);
        }
    };

    const appsByStatus = STATUS_COLUMNS.map((col) => ({
        ...col,
        apps: applications.filter((a) => a.status === col.status),
    }));

    const availableJobs = jobs.filter(
        (j) => !applications.some((a) => a.jobId === j.id)
    );

    const trackedJobIds = new Set(applications.map((a) => a.jobId));

    return (
        <div>
            <Header health={health} />
            <div className="p-6">
                {/* Page header with tabs */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Kanban className="w-5 h-5 text-indigo-400" />
                            Applications
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Discover jobs and track your application pipeline
                        </p>
                    </div>
                    {activeTab === "pipeline" && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Application
                        </button>
                    )}
                </div>

                {/* Tab switcher */}
                <div className="flex gap-1 mb-6 bg-slate-800 rounded-lg p-1 w-fit">
                    <button
                        onClick={() => setActiveTab("pipeline")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === "pipeline"
                                ? "bg-indigo-500 text-white"
                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                        }`}
                    >
                        <Kanban className="w-4 h-4" />
                        Pipeline
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300 ml-1">
                            {applications.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab("discover")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === "discover"
                                ? "bg-emerald-500 text-white"
                                : "text-slate-400 hover:text-white hover:bg-slate-700"
                        }`}
                    >
                        <Target className="w-4 h-4" />
                        Discover Jobs
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300 ml-1">
                            {jobs.length}
                        </span>
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    </div>
                ) : activeTab === "pipeline" ? (
                    /* ─── Pipeline (Kanban Board) ─── */
                    <div className="flex gap-3 overflow-x-auto pb-4">
                        {appsByStatus.map((col) => (
                            <div
                                key={col.status}
                                className="min-w-[220px] max-w-[260px] flex-shrink-0"
                            >
                                {/* Column header */}
                                <div className="flex items-center gap-2 mb-3 px-2">
                                    <div className={`w-2 h-2 rounded-full ${col.color}`} />
                                    <span className="text-xs font-medium text-slate-300">
                                        {col.label}
                                    </span>
                                    <span className="text-[10px] text-slate-600 ml-auto">
                                        {col.apps.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="space-y-2">
                                    {col.apps.map((app) => (
                                        <div
                                            key={app.id}
                                            className="bg-slate-800 rounded-lg border border-slate-700 p-3 hover:border-indigo-500/30 transition-colors group"
                                        >
                                            <p className="text-sm text-white font-medium">
                                                {app.job.title}
                                            </p>
                                            <p className="text-xs text-slate-400">{app.job.company}</p>

                                            <p className="text-[10px] text-slate-500 mt-1">
                                                {app.job.matchScore}% match
                                            </p>

                                            {app.interviewDate && (
                                                <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-400">
                                                    <Calendar className="w-3 h-3" />
                                                    Interview: {new Date(app.interviewDate).toLocaleDateString()}
                                                </div>
                                            )}

                                            {app.nextAction && (
                                                <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                                                    <Clock className="w-3 h-3" />
                                                    {app.nextAction}
                                                </div>
                                            )}

                                            {/* Action buttons: Interview & Resume */}
                                            <div className="flex gap-1.5 mt-2">
                                                <button
                                                    onClick={() => router.push(`/interviews?jobId=${app.jobId}`)}
                                                    className="text-[9px] px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors flex items-center gap-1 border border-indigo-500/20"
                                                >
                                                    <Mic className="w-2.5 h-2.5" />
                                                    Interview
                                                </button>
                                                <button
                                                    onClick={() => router.push(`/resume?jobId=${app.jobId}`)}
                                                    className="text-[9px] px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-1 border border-purple-500/20"
                                                >
                                                    <Sparkles className="w-2.5 h-2.5" />
                                                    Align Resume
                                                </button>
                                            </div>

                                            {/* Quick status buttons */}
                                            <div className="flex flex-wrap gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {STATUS_COLUMNS.filter(
                                                    (s) => s.status !== app.status && s.status !== "saved"
                                                )
                                                    .slice(0, 3)
                                                    .map((s) => (
                                                        <button
                                                            key={s.status}
                                                            onClick={() => handleStatusChange(app.id, s.status)}
                                                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
                                                        >
                                                            {s.label}
                                                        </button>
                                                    ))}
                                            </div>

                                            {/* Timeline */}
                                            <details className="mt-2">
                                                <summary className="text-[9px] text-slate-600 cursor-pointer hover:text-slate-400 flex items-center gap-1">
                                                    <ChevronRight className="w-2.5 h-2.5" />
                                                    Timeline ({app.timeline.length})
                                                </summary>
                                                <div className="mt-1 space-y-1 pl-2 border-l border-slate-700">
                                                    {app.timeline.map((event, i) => (
                                                        <div key={i} className="text-[9px] text-slate-500">
                                                            <span className="text-slate-400">{event.status}</span>
                                                            {" — "}
                                                            {new Date(event.date).toLocaleDateString()}
                                                            {event.notes && (
                                                                <span className="block text-slate-600 pl-1">
                                                                    {event.notes}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        </div>
                                    ))}

                                    {col.apps.length === 0 && (
                                        <div className="bg-slate-800/30 rounded-lg border border-dashed border-slate-700/50 p-4 text-center">
                                            <p className="text-[10px] text-slate-600">&nbsp;</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* ─── Discover Jobs Tab ─── */
                    <div>
                        {jobs.length === 0 ? (
                            <div className="text-center py-16">
                                <Target className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                <p className="text-slate-500 text-sm">
                                    No jobs discovered yet. Start the orchestrator or run a demo from the dashboard.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {jobs.map((job) => (
                                    <DiscoverJobCard
                                        key={job.id}
                                        job={job}
                                        isTracked={trackedJobIds.has(job.id)}
                                        onTrack={() => handleAddApplication(job.id)}
                                        onInterview={() => router.push(`/interviews?jobId=${job.id}`)}
                                        onAlignResume={() => router.push(`/resume?jobId=${job.id}`)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Add Application Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-[480px] max-h-[80vh] overflow-y-auto">
                            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-400" />
                                Add Application
                            </h3>

                            {availableJobs.length > 0 ? (
                                <div className="space-y-2">
                                    {availableJobs.map((job) => (
                                        <button
                                            key={job.id}
                                            onClick={() => handleAddApplication(job.id)}
                                            className="w-full text-left bg-slate-900 rounded-lg border border-slate-700 p-3 hover:border-indigo-500/50 transition-colors"
                                        >
                                            <p className="text-sm text-white">{job.title}</p>
                                            <p className="text-xs text-slate-400">
                                                {job.company} · {job.matchScore}% match
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">
                                    All discovered jobs are already in your pipeline.
                                </p>
                            )}

                            <button
                                onClick={() => setShowAddModal(false)}
                                className="mt-4 w-full text-center text-xs text-slate-500 hover:text-white py-2"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Discover Job Card ─── */

function DiscoverJobCard({
    job,
    isTracked,
    onTrack,
    onInterview,
    onAlignResume,
}: {
    job: Job;
    isTracked: boolean;
    onTrack: () => void;
    onInterview: () => void;
    onAlignResume: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [justTracked, setJustTracked] = useState(false);

    const isNew = Date.now() - new Date(job.discoveredAt).getTime() < 60 * 60 * 1000;
    const tracked = isTracked || justTracked;

    return (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-white">{job.title}</h3>
                            {isNew && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">
                                    NEW
                                </span>
                            )}
                            {job.interviewReady && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded font-medium">
                                    INTERVIEW READY
                                </span>
                            )}
                            {tracked && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">
                                    IN PIPELINE
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{job.company}</p>
                    </div>
                    <span className={`text-xs font-medium ${
                        job.matchScore >= 80 ? "text-emerald-400" : job.matchScore >= 50 ? "text-amber-400" : "text-red-400"
                    }`}>
                        {job.matchScore}% match
                    </span>
                </div>

                <div className="flex items-center gap-4 mt-3">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                    </span>
                    {job.skillGaps.length > 0 && (
                        <span className="text-xs text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {job.skillGaps.length} gaps
                        </span>
                    )}
                </div>

                {/* Tech stack tags */}
                {job.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.techStack.slice(0, 6).map((tech) => (
                            <span key={tech} className="text-[10px] px-2 py-0.5 bg-slate-900 text-slate-300 rounded border border-slate-700">
                                {tech}
                            </span>
                        ))}
                        {job.techStack.length > 6 && (
                            <span className="text-[10px] text-slate-500">+{job.techStack.length - 6} more</span>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-xs px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 transition-colors"
                    >
                        <FileText className="w-3 h-3" />
                        Details
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <button
                        onClick={onInterview}
                        className="text-xs px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg flex items-center gap-1 transition-colors"
                    >
                        <Mic className="w-3 h-3" />
                        Mock Interview
                    </button>
                    <button
                        onClick={onAlignResume}
                        className="text-xs px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg flex items-center gap-1 transition-colors border border-purple-500/20"
                    >
                        <Sparkles className="w-3 h-3" />
                        Align Resume
                    </button>
                    {!tracked ? (
                        <button
                            onClick={() => { onTrack(); setJustTracked(true); }}
                            className="text-xs px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg flex items-center gap-1 transition-colors border border-emerald-500/20"
                        >
                            <Briefcase className="w-3 h-3" />
                            Save to Pipeline
                        </button>
                    ) : (
                        <span className="text-xs px-3 py-1.5 bg-emerald-500/10 text-emerald-400/60 rounded-lg flex items-center gap-1 border border-emerald-500/10">
                            <Briefcase className="w-3 h-3" />
                            Tracked
                        </span>
                    )}
                    {job.url && (
                        <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 transition-colors"
                        >
                            <ExternalLink className="w-3 h-3" />
                            Apply
                        </a>
                    )}
                </div>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="border-t border-slate-700 p-4 space-y-3">
                    {job.description && (
                        <div>
                            <p className="text-xs font-medium text-slate-300 mb-1">Description</p>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {job.description.slice(0, 500)}
                                {job.description.length > 500 && "..."}
                            </p>
                        </div>
                    )}
                    {job.skillGaps.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-slate-300 mb-1">Skill Gaps</p>
                            <div className="flex flex-wrap gap-1.5">
                                {job.skillGaps.map((gap) => (
                                    <span
                                        key={gap.skillName}
                                        className={`text-[10px] px-2 py-0.5 rounded ${
                                            gap.importance === "required"
                                                ? "bg-red-500/20 text-red-400"
                                                : "bg-amber-500/20 text-amber-400"
                                        }`}
                                    >
                                        {gap.skillName}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {job.companyIntel && (
                        <div>
                            <p className="text-xs font-medium text-slate-300 mb-1">Company Intel</p>
                            <p className="text-xs text-slate-400">{job.companyIntel.summary.slice(0, 200)}</p>
                            {job.companyIntel.recentNews.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {job.companyIntel.recentNews.slice(0, 2).map((news, i) => (
                                        <a key={i} href={news.url} target="_blank" rel="noopener noreferrer"
                                            className="text-[10px] text-indigo-400 hover:text-indigo-300 block truncate">
                                            → {news.title}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
