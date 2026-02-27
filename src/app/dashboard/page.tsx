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

    const handleCreateScout = async () => {
        const query = prompt("Enter scout query (e.g., 'SWE Intern jobs at top startups'):");
        if (!query) return;

        try {
            await fetch("/api/scouts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query,
                    targetCompanies: [],
                    interval: 1800,
                }),
            });
            await fetchData();
        } catch (err) {
            console.error("Failed to create scout:", err);
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
                        <JobFeed jobs={jobs} />
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
        </div>
    );
}
