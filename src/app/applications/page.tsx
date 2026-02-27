"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { SystemHealth, Application, ApplicationStatus, Job } from "@/lib/types";
import {
    Kanban,
    ChevronRight,
    Calendar,
    FileText,
    Plus,
    Clock,
    Loader2,
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

export default function ApplicationsPage() {
    const [health, setHealth] = useState<SystemHealth>({
        orchestratorRunning: false, activeScouts: 0, neo4jConnected: false,
        totalJobsFound: 0, interviewsReady: 0, skillGapsIdentified: 0,
    });
    const [applications, setApplications] = useState<Application[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

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

    return (
        <div>
            <Header health={health} />
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Kanban className="w-5 h-5 text-indigo-400" />
                            Application Tracker
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Track every application through your pipeline
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Application
                    </button>
                </div>

                {/* Kanban Board */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    </div>
                ) : (
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

                                            {/* Quick status buttons */}
                                            <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                    No jobs available. Discover jobs from the dashboard first.
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
