"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import QuickStats from "@/components/dashboard/QuickStats";
import ScoutCards from "@/components/dashboard/ScoutCards";
import JobFeed from "@/components/dashboard/JobFeed";
import SystemHealthPanel from "@/components/dashboard/SystemHealth";
import ConfidenceHeatMap from "@/components/dashboard/ConfidenceHeatMap";
import SkillTrajectory from "@/components/dashboard/SkillTrajectory";
import { SystemHealth, Scout, Job, PerformanceSnapshot } from "@/lib/types";
import {
    Rocket,
    CalendarPlus,
    Mic,
    BookOpen,
    FileText,
    Sun,
    Moon,
    CloudSun,
    X,
    Radar,
} from "lucide-react";
import Link from "next/link";

function getGreeting(): { text: string; icon: typeof Sun } {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: Sun };
    if (hour < 17) return { text: "Good afternoon", icon: CloudSun };
    return { text: "Good evening", icon: Moon };
}

const quickActions = [
    { href: "/applications", label: "Track Application", icon: CalendarPlus, color: "from-indigo-500 to-purple-600" },
    { href: "/study", label: "Study Now", icon: BookOpen, color: "from-emerald-500 to-teal-600" },
    { href: "/interviews", label: "Mock Interview", icon: Mic, color: "from-amber-500 to-orange-600" },
    { href: "/resume", label: "Align Resume", icon: FileText, color: "from-purple-500 to-pink-600" },
];

export default function DashboardPage() {
    const [health, setHealth] = useState<SystemHealth>({
        orchestratorRunning: false,
        activeScouts: 0,
        neo4jConnected: false,
        totalJobsFound: 0,
        interviewsReady: 0,
        skillGapsIdentified: 0,
    });
    const [scouts, setScouts] = useState<Scout[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
    const [loading, setLoading] = useState(false);
    const [userName, setUserName] = useState("User");
    const [showScoutModal, setShowScoutModal] = useState(false);
    const [scoutForm, setScoutForm] = useState({ query: "", companies: "", interval: "30" });
    const [creatingScout, setCreatingScout] = useState(false);
    const greeting = getGreeting();

    const fetchData = useCallback(async () => {
        try {
            const [healthRes, scoutsRes, jobsRes, authRes, studyRes] = await Promise.all([
                fetch("/api/system"),
                fetch("/api/scouts"),
                fetch("/api/jobs"),
                fetch("/api/auth"),
                fetch("/api/study"),
            ]);

            const healthData = await healthRes.json();
            const scoutsData = await scoutsRes.json();
            const jobsData = await jobsRes.json();
            const authData = await authRes.json();
            const studyData = await studyRes.json();

            if (healthData.success) setHealth(healthData.data);
            if (scoutsData.success) setScouts(scoutsData.data);
            if (jobsData.success) setJobs(jobsData.data);
            if (authData.success && authData.data?.name) setUserName(authData.data.name);
            if (studyData.success && studyData.data?.performanceHistory) setSnapshots(studyData.data.performanceHistory);
        } catch (err) {
            console.error("Failed to fetch data:", err);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // 30s instead of 10s
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleStart = async () => {
        setLoading(true);
        try {
            await fetch("/api/orchestrator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "start" }),
            });
            await fetchData();
        } catch (err) {
            console.error("Failed to start:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDemo = async () => {
        setLoading(true);
        try {
            await fetch("/api/orchestrator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "demo" }),
            });
            await fetchData();
        } catch (err) {
            console.error("Failed to run demo:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateScout = () => setShowScoutModal(true);

    const handleSubmitScout = async () => {
        if (!scoutForm.query.trim()) return;
        setCreatingScout(true);
        try {
            const companies = scoutForm.companies
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean);
            await fetch("/api/scouts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: scoutForm.query,
                    targetCompanies: companies,
                    interval: parseInt(scoutForm.interval) * 60,
                }),
            });
            setShowScoutModal(false);
            setScoutForm({ query: "", companies: "", interval: "30" });
            await fetchData();
        } catch (err) {
            console.error("Failed to create scout:", err);
        } finally {
            setCreatingScout(false);
        }
    };

    const handleApplyJob = async (jobId: string) => {
        try {
            await fetch("/api/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId }),
            });
            await fetchData();
        } catch (err) {
            console.error("Failed to add application:", err);
        }
    };

    return (
        <div>
            <Header health={health} />

            <div className="p-6 space-y-6">
                {/* Welcome Hero */}
                <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-900/80 to-slate-800/80 rounded-2xl border border-slate-700/50 p-6 overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />
                    <div className="relative z-10 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <greeting.icon className="w-5 h-5 text-amber-400" />
                                <span className="text-sm text-slate-400">{greeting.text}</span>
                            </div>
                            <h1 className="text-2xl font-bold text-white mb-2">
                                {userName}
                            </h1>
                            <p className="text-sm text-slate-400 max-w-md">
                                {health.totalJobsFound > 0
                                    ? `${health.totalJobsFound} jobs discovered · ${health.interviewsReady} interviews ready · ${health.activeScouts} scouts active`
                                    : "Launch your scouts to start discovering opportunities."}
                            </p>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2">
                            {quickActions.map((a) => (
                                <Link
                                    key={a.href}
                                    href={a.href}
                                    className={`flex items-center gap-2 bg-gradient-to-r ${a.color} text-white text-xs font-medium px-3 py-2 rounded-lg hover:opacity-90 transition-opacity shadow-sm`}
                                >
                                    <a.icon className="w-3.5 h-3.5" />
                                    {a.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {loading && (
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-indigo-400">
                            Processing... The orchestrator is running the full pipeline.
                        </span>
                    </div>
                )}

                <QuickStats health={health} />

                {/* Creative components row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ConfidenceHeatMap snapshots={snapshots} />
                    <SkillTrajectory snapshots={snapshots} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <ScoutCards scouts={scouts} onCreateScout={handleCreateScout} />
                        <JobFeed jobs={jobs} onApply={handleApplyJob} />
                    </div>

                    <div>
                        <SystemHealthPanel
                            health={health}
                            onStart={handleStart}
                            onDemo={handleDemo}
                        />
                    </div>
                </div>
            </div>

            {/* Scout Creation Modal */}
            {showScoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Radar className="w-5 h-5 text-indigo-400" />
                                Create Scout
                            </h3>
                            <button onClick={() => setShowScoutModal(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Search Query</label>
                                <input
                                    type="text"
                                    placeholder="e.g. SWE Intern at top YC startups"
                                    value={scoutForm.query}
                                    onChange={(e) => setScoutForm({ ...scoutForm, query: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Target Companies <span className="text-slate-500">(comma-separated, optional)</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. Stripe, Figma, Notion, Linear"
                                    value={scoutForm.companies}
                                    onChange={(e) => setScoutForm({ ...scoutForm, companies: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-300 mb-1.5 block">Check Interval</label>
                                <select
                                    value={scoutForm.interval}
                                    onChange={(e) => setScoutForm({ ...scoutForm, interval: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                >
                                    <option value="15">Every 15 minutes</option>
                                    <option value="30">Every 30 minutes</option>
                                    <option value="60">Every hour</option>
                                    <option value="360">Every 6 hours</option>
                                    <option value="1440">Every 24 hours</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mt-6">
                            <button
                                onClick={handleSubmitScout}
                                disabled={!scoutForm.query.trim() || creatingScout}
                                className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {creatingScout ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Radar className="w-4 h-4" />
                                        Deploy Scout
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setShowScoutModal(false)}
                                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>

                        <p className="text-[10px] text-slate-500 mt-3 text-center">
                            Powered by Yutori — scouts continuously monitor job boards and company career pages
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
