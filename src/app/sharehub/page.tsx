"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Header from "@/components/layout/Header";
import { SystemHealth, Job } from "@/lib/types";
import {
  Radar,
  Download,
  Upload,
  Sparkles,
  Globe,
  Tag,
  TrendingUp,
  Zap,
  Check,
  Loader2,
  ChevronRight,
  GitBranch,
  Circle,
  ArrowRight,
  Timer,
  Target,
  Workflow,
  Network,
  Eye,
  Briefcase,
  AlertTriangle,
  Database,
  RefreshCw,
  Radio,
  Plus,
  ExternalLink,
  Satellite,
  Activity,
} from "lucide-react";
import { Scout } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────

interface MemoryScout {
  id: string;
  query: string;
  strategy: string;
  source: "auto" | "manual" | "imported";
  performance: {
    relevanceScore: number;
    jobsFound: number;
    lastEvaluated?: string;
  };
  tags: string[];
  priority: number;
  createdAt: string;
  lastActive?: string;
  status: "active" | "paused" | "retired";
}

interface DiscoveredSource {
  company: string;
  careerPageUrl?: string;
  lastChecked?: string;
  jobsFound: number;
  relevanceScore: number;
  addedAt: string;
}

interface LibraryData {
  version: string;
  createdAt: string;
  updatedAt: string;
  profile: { roles: string[]; skills: string[] };
  scouts: MemoryScout[];
  discoveredSources: DiscoveredSource[];
  insights: {
    topSkillsInDemand: string[];
    emergingCompanies: string[];
    queryPatterns: string[];
    totalJobsDiscovered: number;
    avgRelevanceScore: number;
  };
}

interface LifecycleEvent {
  id: string;
  timestamp: string;
  type: "created" | "optimized" | "replicated" | "retired" | "expanded" | "job_found" | "evaluated";
  scoutId: string;
  scoutQuery: string;
  parentScoutId?: string;
  details: string;
  impact?: number;
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function JobScoutPage() {
  const [health, setHealth] = useState<SystemHealth>({
    orchestratorRunning: false,
    activeScouts: 0,
    neo4jConnected: false,
    totalJobsFound: 0,
    interviewsReady: 0,
    skillGapsIdentified: 0,
  });
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [liveScouts, setLiveScouts] = useState<Scout[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lifecycleEvents, setLifecycleEvents] = useState<LifecycleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [creatingScouts, setCreatingScouts] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"graph" | "scouts" | "jobs" | "timeline">("graph");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, libraryRes, jobsRes, scoutsRes] = await Promise.all([
        fetch("/api/system"),
        fetch("/api/library"),
        fetch("/api/jobs"),
        fetch("/api/scouts"),
      ]);
      const [healthData, libraryData, jobsData, scoutsData] = await Promise.all([
        healthRes.json(),
        libraryRes.json(),
        jobsRes.json(),
        scoutsRes.json(),
      ]);

      if (healthData.success) setHealth(healthData.data);
      if (libraryData.success) setLibrary(libraryData.data);
      if (jobsData.success) setJobs(jobsData.data);
      if (scoutsData.success) setLiveScouts(scoutsData.data);

      // Load lifecycle events
      try {
        const lcRes = await fetch("/api/system?lifecycle=true");
        const lcData = await lcRes.json();
        if (lcData.success && lcData.data?.events) {
          setLifecycleEvents(lcData.data.events);
        }
      } catch { /* lifecycle data is optional */ }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setImportResult(data.data.message);
        await fetchData();
      } else {
        setImportResult("Seed failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Seed failed:", err);
      setImportResult("Seed failed — check console.");
    } finally {
      setSeeding(false);
    }
  };

  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/library", { method: "PUT" });
      const data = await res.json();
      if (data.success) {
        setImportResult(data.data.message);
        await fetchData();
      }
    } catch (err) {
      console.error("Auto-generate failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = () => {
    if (!library) return;
    const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scout-library-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryJson: text }),
      });
      const data = await res.json();
      if (data.success) {
        setImportResult(data.data.message);
        await fetchData();
      }
    } catch (err) {
      console.error("Import failed:", err);
      setImportResult("Import failed.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Yutori Operations ───────────────────────────────────────────
  const handleSyncAndPoll = async () => {
    setSyncing(true);
    setPolling(true);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-and-poll" }),
      });
      const data = await res.json();
      if (data.success) {
        const syncMsg = `Synced ${data.data.sync.created} scouts`;
        const pollMsg = `ingested ${data.data.poll.newJobs} new jobs`;
        setImportResult(`${syncMsg}, ${pollMsg}`);
        await fetchData();
      }
    } catch (err) {
      console.error("Sync-and-poll failed:", err);
      setImportResult("Sync failed — check console.");
    } finally {
      setSyncing(false);
      setPolling(false);
    }
  };

  const handleCreateDiverseScouts = async () => {
    setCreatingScouts(true);
    try {
      const res = await fetch("/api/scouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-diverse" }),
      });
      const data = await res.json();
      if (data.success) {
        setImportResult(`Created ${data.data.scouts.length} diverse scouts on Yutori`);
        await fetchData();
      }
    } catch (err) {
      console.error("Create diverse scouts failed:", err);
      setImportResult("Scout creation failed.");
    } finally {
      setCreatingScouts(false);
    }
  };

  // Use live scouts from /api/scouts (Yutori-linked) as primary data source
  const activeYutoriScouts = liveScouts.filter((s) => s.status === "active");
  const pausedYutoriScouts = liveScouts.filter((s) => s.status === "paused");
  const totalYutoriJobs = liveScouts.reduce((sum, s) => sum + (s.jobsFound || 0), 0);
  const yutoriLinkedCount = liveScouts.filter((s) => s.yutoriScoutId).length;

  // Feed live scouts into graph and fleet (NOT memory library)
  const activeScouts = liveScouts.filter((s) => s.status === "active");
  const retiredScouts = liveScouts.filter((s) => s.status === "paused" || s.status === "error");
  const hasData = liveScouts.length > 0 || (library?.scouts.length ?? 0) > 0 || jobs.length > 0;

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

  return (
    <div>
      <Header health={health} />
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Radar className="w-5 h-5 text-indigo-400" />
              Job Scout
              {yutoriLinkedCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full flex items-center gap-1">
                  <Satellite className="w-3 h-3" /> {yutoriLinkedCount} Yutori-linked
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous scout network powered by Yutori &middot; Live polling &middot; {jobs.length} jobs discovered
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncAndPoll}
              disabled={syncing || polling}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-cyan-600/20"
            >
              {syncing || polling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? "Syncing..." : polling ? "Polling..." : "Sync & Poll"}
            </button>
            <button
              onClick={handleCreateDiverseScouts}
              disabled={creatingScouts}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-purple-600/20"
            >
              {creatingScouts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creatingScouts ? "Creating..." : "Deploy Scouts"}
            </button>
            <button
              onClick={handleAutoGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Generating..." : "AI Generate"}
            </button>
            <button onClick={handleExport} disabled={!library} className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={handleImportClick} disabled={importing} className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </div>
        </div>

        {importResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400">{importResult}</span>
            <button onClick={() => setImportResult(null)} className="ml-auto text-xs text-slate-500 hover:text-white">&times;</button>
          </div>
        )}

        {/* Yutori Live Scouts Panel */}
        {activeYutoriScouts.length > 0 && (
          <div className="bg-gradient-to-r from-cyan-950/40 to-slate-900 rounded-xl border border-cyan-500/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Satellite className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Live Yutori Scouts</h3>
              <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full">Polling every 30min</span>
              <span className="ml-auto text-[10px] text-slate-500">{pausedYutoriScouts.length} paused</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {activeYutoriScouts.map((scout) => (
                <div key={scout.id} className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50 hover:border-cyan-500/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        <p className="text-xs font-medium text-white truncate">{scout.query.slice(0, 55)}...</p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        {scout.yutoriScoutId && (
                          <span className="flex items-center gap-0.5 text-cyan-400/70" title={scout.yutoriScoutId}>
                            <Radio className="w-2.5 h-2.5" /> {scout.yutoriScoutId.slice(0, 8)}
                          </span>
                        )}
                        <span>{scout.interval / 60}m interval</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-sm font-bold text-white">{scout.jobsFound}</span>
                      <span className="text-[10px] text-slate-500 ml-0.5">jobs</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard icon={<Satellite className="w-4 h-4 text-cyan-400" />} label="Yutori Scouts" value={yutoriLinkedCount} />
          <StatCard icon={<Activity className="w-4 h-4 text-emerald-400" />} label="Active" value={activeYutoriScouts.length} />
          <StatCard icon={<Briefcase className="w-4 h-4 text-indigo-400" />} label="Jobs Found" value={jobs.length} />
          <StatCard icon={<Zap className="w-4 h-4 text-amber-400" />} label="Scout Jobs" value={totalYutoriJobs} />
          <StatCard icon={<TrendingUp className="w-4 h-4 text-purple-400" />} label="Avg Match" value={jobs.length > 0 ? `${Math.round(jobs.reduce((s, j) => s + j.matchScore, 0) / jobs.length)}%` : "—"} />
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
          {([
            { key: "graph", label: "Scout Graph", icon: Network },
            { key: "scouts", label: "Fleet", icon: Radar },
            { key: "jobs", label: "Discovered Jobs", icon: Briefcase },
            { key: "timeline", label: "Lifecycle Timeline", icon: Workflow },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key
                ? "bg-indigo-500/20 text-indigo-400"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* No Data State */}
        {!hasData && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <Satellite className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Scout Data Yet</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Click &quot;Sync & Poll&quot; to pull results from your Yutori scouts,
              or &quot;Deploy Scouts&quot; to create 5 diverse scouts on Yutori.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={handleSyncAndPoll} disabled={syncing} className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors">\n                {syncing ? "Syncing..." : "Sync & Poll Yutori"}\n              </button>
              <button onClick={handleCreateDiverseScouts} disabled={creatingScouts} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">\n                {creatingScouts ? "Creating..." : "Deploy 5 Diverse Scouts"}\n              </button>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {hasData && activeTab === "graph" && (
          <ScoutGraph
            scouts={activeScouts}
            retiredScouts={retiredScouts}
            jobs={jobs}
            events={lifecycleEvents}
            sources={library?.discoveredSources || []}
          />
        )}
        {hasData && activeTab === "scouts" && (
          <ScoutFleet scouts={activeScouts} retiredScouts={retiredScouts} />
        )}
        {hasData && activeTab === "jobs" && (
          <JobsDiscovered jobs={jobs} />
        )}
        {hasData && activeTab === "timeline" && (
          <LifecycleTimeline events={lifecycleEvents} />
        )}

        {/* Bottom Panels */}
        {hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SkillsInDemand skills={library?.insights.topSkillsInDemand || []} />
            <DiscoveredSources sources={library?.discoveredSources || []} />
            <EmergingCompanies companies={library?.insights.emergingCompanies || []} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SCOUT GRAPH — n8n-style visual pipeline
// ═══════════════════════════════════════════════════════════════════════

function ScoutGraph({
  scouts,
  retiredScouts,
  jobs,
  events,
}: {
  scouts: Scout[];
  retiredScouts: Scout[];
  jobs: Job[];
  events: LifecycleEvent[];
  sources: DiscoveredSource[];
}) {
  const graphData = useMemo(() => {
    const nodes: GNode[] = [];
    const edges: GEdge[] = [];

    // Central hub
    nodes.push({ id: "hub", type: "hub", label: "Job Scout Engine", sublabel: "Self-Replicating AI", x: 400, y: 60, color: "#6366f1" });

    // Split scouts into different columns based on their source or tags
    const categorize = (s: Scout): "general" | "company" | "emerging" => {
      if (s.query.startsWith("Monitor ") && s.targetCompanies.length > 0) return "company";
      if (s.strategy === "company_focused") return "company";
      if (s.query.toLowerCase().includes("anthropic") || s.query.toLowerCase().includes("emerging") || s.strategy === "emerging_company") return "emerging";
      return "general";
    };

    const autoScouts = scouts.filter(s => categorize(s) === "general");
    const replicatedScouts = scouts.filter(s => categorize(s) === "company");
    const expandedScouts = scouts.filter(s => categorize(s) === "emerging");

    // Column 1: Auto-generated (left)
    autoScouts.forEach((s, i) => {
      const y = 180 + i * 100;
      nodes.push({ id: s.id, type: "scout", label: truncate(s.query, 38), sublabel: `${s.jobsFound} jobs · ${s.yutoriScoutId ? "Yutori" : "Local"}`, x: 120, y, color: s.jobsFound > 10 ? "#10b981" : s.jobsFound > 0 ? "#f59e0b" : "#6b7280", strategy: "auto" });
      edges.push({ from: "hub", to: s.id, type: "created", animated: true });
    });

    // Column 2: Self-replicated (center)
    replicatedScouts.forEach((s, i) => {
      const y = 180 + i * 100;
      nodes.push({ id: s.id, type: "scout", label: truncate(s.query, 38), sublabel: `${s.jobsFound} jobs · ${s.targetCompanies[0] || "Yutori"}`, x: 400, y, color: s.jobsFound > 10 ? "#10b981" : s.jobsFound > 0 ? "#f59e0b" : "#6b7280", strategy: "replicated" });
      const replicateEvent = events.find(e => e.type === "replicated" && e.scoutQuery.toLowerCase().includes(s.query.toLowerCase().slice(0, 20)));
      const parentId = replicateEvent?.parentScoutId;
      if (parentId) {
        const parentNode = nodes.find(n => n.id === parentId || (n.type === "scout" && n.strategy === "auto"));
        edges.push({ from: parentNode?.id || "hub", to: s.id, type: "replicated", animated: true });
      } else {
        edges.push({ from: "hub", to: s.id, type: "replicated", animated: true });
      }
    });

    // Column 3: Expanded (right)
    expandedScouts.forEach((s, i) => {
      const y = 180 + i * 100;
      nodes.push({ id: s.id, type: "scout", label: truncate(s.query, 38), sublabel: `${s.jobsFound} jobs · ${s.targetCompanies[0] || "Expansion"}`, x: 680, y, color: s.jobsFound > 10 ? "#10b981" : s.jobsFound > 0 ? "#f59e0b" : "#6b7280", strategy: "expanded" });
      edges.push({ from: "hub", to: s.id, type: "expanded", animated: true });
    });

    // Company output nodes
    const companyMap = new Map<string, { count: number; avgMatch: number }>();
    for (const job of jobs) {
      const ex = companyMap.get(job.company);
      if (ex) { ex.count++; ex.avgMatch = (ex.avgMatch * (ex.count - 1) + job.matchScore) / ex.count; }
      else companyMap.set(job.company, { count: 1, avgMatch: job.matchScore });
    }

    const maxY = Math.max(...nodes.map(n => n.y), 250);
    const jobY = maxY + 120;
    let ji = 0;
    for (const [company, data] of companyMap) {
      const jid = `job-${company.toLowerCase().replace(/\s+/g, "-")}`;
      nodes.push({ id: jid, type: "company", label: company, sublabel: `${data.count} jobs · ${data.avgMatch.toFixed(0)}% avg`, x: Math.min(80 + ji * 120, 720), y: jobY, color: data.avgMatch >= 80 ? "#10b981" : data.avgMatch >= 60 ? "#f59e0b" : "#6b7280" });
      // Link companies to scouts by targetCompanies or query match
      for (const s of scouts) {
        if (s.targetCompanies.some(t => t.toLowerCase() === company.toLowerCase()) || s.query.toLowerCase().includes(company.toLowerCase())) {
          edges.push({ from: s.id, to: jid, type: "discovered" });
        }
      }
      ji++;
    }

    // Retired / paused nodes
    retiredScouts.forEach((s, i) => {
      nodes.push({ id: `retired-${s.id}`, type: "retired", label: truncate(s.query, 30), sublabel: `${s.status === "paused" ? "Paused" : "Error"} · ${s.jobsFound} jobs`, x: 680, y: jobY + 80 + i * 60, color: "#374151" });
      edges.push({ from: "hub", to: `retired-${s.id}`, type: "retired" });
    });

    return { nodes, edges };
  }, [scouts, retiredScouts, jobs, events]);

  const svgHeight = Math.max(600, Math.max(...graphData.nodes.map(n => n.y)) + 120);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-6 text-[10px]">
        <span className="text-slate-400 font-semibold uppercase tracking-wider">Scout Pipeline Graph</span>
        <div className="flex items-center gap-4 ml-auto text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Engine</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400" /> General</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400" /> Target Companies</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Emerging</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Jobs</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-600" /> Retired</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width="800" height={svgHeight} viewBox={`0 0 800 ${svgHeight}`} className="w-full min-w-[800px]">
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* Column labels */}
          <text x="120" y="145" textAnchor="middle" className="fill-slate-600 text-[10px] font-semibold uppercase">General Role Search</text>
          <text x="400" y="145" textAnchor="middle" className="fill-slate-600 text-[10px] font-semibold uppercase">Target Companies</text>
          <text x="680" y="145" textAnchor="middle" className="fill-slate-600 text-[10px] font-semibold uppercase">Emerging Ops</text>

          {/* Edges */}
          {graphData.edges.map((edge, i) => {
            const f = graphData.nodes.find(n => n.id === edge.from);
            const t = graphData.nodes.find(n => n.id === edge.to);
            if (!f || !t) return null;
            const isRep = edge.type === "replicated";
            const isRet = edge.type === "retired";
            const isDis = edge.type === "discovered";
            return (
              <g key={`e-${i}`}>
                <path
                  d={bPath(f.x, f.y, t.x, t.y)}
                  fill="none"
                  stroke={isRet ? "#374151" : isRep ? "#a855f7" : isDis ? "#10b98140" : "#6366f180"}
                  strokeWidth={isRep ? 2.5 : isDis ? 1 : 1.5}
                  strokeDasharray={isRet ? "4 4" : edge.animated ? "6 3" : "none"}
                  opacity={isRet ? 0.3 : 0.6}
                >
                  {edge.animated && <animate attributeName="stroke-dashoffset" from="18" to="0" dur={isRep ? "0.8s" : "1.2s"} repeatCount="indefinite" />}
                </path>
                {isRep && (
                  <circle r="3" fill="#a855f7" opacity="0.8">
                    <animateMotion dur="2s" repeatCount="indefinite" path={bPath(f.x, f.y, t.x, t.y)} />
                  </circle>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {graphData.nodes.map(node => (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              {node.type === "hub" ? (
                <g filter="url(#glow)">
                  <rect x="-75" y="-28" width="150" height="56" rx="12" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2" />
                  <text x="-52" y="4" textAnchor="middle" className="fill-indigo-400 text-[12px]">&#9889;</text>
                  <text x="5" y="-6" textAnchor="middle" className="fill-white text-[11px] font-bold">{node.label}</text>
                  <text x="5" y="10" textAnchor="middle" className="fill-indigo-300 text-[9px]">{node.sublabel}</text>
                  <circle cx="65" cy="-18" r="4" fill="#6366f1"><animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" /></circle>
                </g>
              ) : node.type === "scout" ? (
                <g>
                  <rect x="-85" y="-22" width="170" height="44" rx="8" fill="#0f172a" stroke={node.strategy === "replicated" ? "#a855f7" : node.strategy === "expanded" ? "#f59e0b" : "#06b6d4"} strokeWidth="1.5" opacity="0.95" />
                  <circle cx="-68" cy="0" r="6" fill={node.color} />
                  <text x="5" y="-5" textAnchor="middle" className="fill-slate-200 text-[9px]">{node.label}</text>
                  <text x="5" y="10" textAnchor="middle" className="fill-slate-500 text-[8px]">{node.sublabel}</text>
                </g>
              ) : node.type === "company" ? (
                <g>
                  <rect x="-50" y="-18" width="100" height="36" rx="8" fill="#0d1117" stroke={node.color} strokeWidth="1" opacity="0.9" />
                  <text x="0" y="-2" textAnchor="middle" className="fill-slate-200 text-[10px] font-medium">{node.label}</text>
                  <text x="0" y="12" textAnchor="middle" className="fill-slate-500 text-[8px]">{node.sublabel}</text>
                </g>
              ) : (
                <g opacity="0.35">
                  <rect x="-70" y="-14" width="140" height="28" rx="6" fill="#1e293b" stroke="#374151" strokeWidth="1" strokeDasharray="4 3" />
                  <text x="0" y="-1" textAnchor="middle" className="fill-slate-500 text-[8px]">{node.label}</text>
                  <text x="0" y="10" textAnchor="middle" className="fill-slate-600 text-[7px]">{node.sublabel}</text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

interface GNode { id: string; type: "hub" | "scout" | "company" | "retired"; label: string; sublabel: string; x: number; y: number; color: string; strategy?: string; }
interface GEdge { from: string; to: string; type: "created" | "replicated" | "expanded" | "discovered" | "retired"; animated?: boolean; }

function bPath(x1: number, y1: number, x2: number, y2: number) {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}
function scoreColor(s: number) { return s >= 0.8 ? "#10b981" : s >= 0.6 ? "#f59e0b" : s >= 0.3 ? "#f97316" : "#ef4444"; }
function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) + "\u2026" : s; }
function timeAgo(d: string) { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; }

// ═══════════════════════════════════════════════════════════════════════
// SCOUT FLEET
// ═══════════════════════════════════════════════════════════════════════

function ScoutFleet({ scouts, retiredScouts }: { scouts: Scout[]; retiredScouts: Scout[] }) {
  const sLabel = (s?: string) => (s || "auto_generated").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const sColor = (s?: string) => {
    if (s === "self_replicated") return "bg-purple-500/15 text-purple-400 border-purple-500/20";
    if (s === "network_expansion") return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    if (s === "skill_based") return "bg-cyan-500/15 text-cyan-400 border-cyan-500/20";
    return "bg-indigo-500/15 text-indigo-400 border-indigo-500/20";
  };

  return (
    <div className="space-y-3">
      {scouts.map(scout => (
        <div key={scout.id} className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-indigo-500/30 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sColor(scout.strategy)}`}>{sLabel(scout.strategy)}</span>
                {scout.yutoriScoutId && <span className="text-[10px] text-cyan-400/70 flex items-center gap-0.5"><Radio className="w-2.5 h-2.5" /> {scout.yutoriScoutId.slice(0, 8)}</span>}
              </div>
              <p className="text-sm text-white leading-relaxed mb-2">{scout.query}</p>
              <div className="flex items-center gap-3 flex-wrap">
                {scout.targetCompanies.slice(0, 5).map(company => <span key={company} className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Tag className="w-2.5 h-2.5" /> {company}</span>)}
                <span className="text-[10px] text-slate-600">{scout.interval / 60}m interval</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 space-y-1">
              <div className="flex items-center gap-1 justify-end"><Briefcase className="w-3 h-3 text-slate-500" /><span className="text-sm font-semibold text-white">{scout.jobsFound}</span><span className="text-[10px] text-slate-500">jobs</span></div>
              <div className="flex items-center gap-1 justify-end"><Target className="w-3 h-3 text-slate-500" /><span className="text-sm font-semibold text-emerald-400">{scout.status}</span></div>
              {scout.lastRun && <p className="text-[10px] text-slate-600 pt-0.5"><Timer className="w-2.5 h-2.5 inline mr-0.5" />{timeAgo(scout.lastRun)}</p>}
              {scout.createdAt && <p className="text-[10px] text-slate-600">Created {timeAgo(scout.createdAt)}</p>}
            </div>
          </div>
        </div>
      ))}
      {retiredScouts.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 flex items-center gap-1"><ChevronRight className="w-3 h-3" />{retiredScouts.length} paused/error scouts</summary>
          <div className="space-y-2 mt-2 opacity-50">
            {retiredScouts.map(s => (
              <div key={s.id} className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 flex items-center justify-between">
                <div><p className="text-xs text-slate-500">{s.query}</p><p className="text-[10px] text-slate-600">{s.jobsFound} jobs &middot; {s.status}</p></div>
                <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full">{s.status === "paused" ? "Paused" : "Error"}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DISCOVERED JOBS
// ═══════════════════════════════════════════════════════════════════════

function JobsDiscovered({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
      <Briefcase className="w-8 h-8 text-slate-700 mx-auto mb-3" />
      <p className="text-sm text-slate-400">No jobs discovered yet. Scouts are searching...</p>
    </div>
  );

  const sBadge = (s: string) => {
    if (s === "interview-ready") return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    if (s === "analyzed") return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
    if (s === "researching") return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    return "bg-slate-700 text-slate-400";
  };

  return (
    <div className="space-y-2">
      {jobs.map(job => (
        <div key={job.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-indigo-500/20 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-white truncate">{job.title}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${sBadge(job.status)}`}>{job.status.replace(/-/g, " ")}</span>
              </div>
              <p className="text-xs text-slate-400">{job.company} &middot; {job.location}</p>
              {job.salaryRange && <p className="text-[10px] text-emerald-400 mt-0.5">{job.salaryRange}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {job.techStack.slice(0, 6).map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">{t}</span>)}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: job.matchScore >= 80 ? "#10b98120" : job.matchScore >= 60 ? "#f59e0b20" : "#6b728020", color: job.matchScore >= 80 ? "#10b981" : job.matchScore >= 60 ? "#f59e0b" : "#9ca3af" }}>{job.matchScore}%</div>
              <p className="text-[10px] text-slate-600 mt-1">{timeAgo(job.discoveredAt)}</p>
              {job.skillGaps.length > 0 && <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-0.5 justify-end"><AlertTriangle className="w-2.5 h-2.5" /> {job.skillGaps.length} gaps</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LIFECYCLE TIMELINE
// ═══════════════════════════════════════════════════════════════════════

function LifecycleTimeline({ events }: { events: LifecycleEvent[] }) {
  const sorted = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  if (sorted.length === 0) return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
      <Workflow className="w-8 h-8 text-slate-700 mx-auto mb-3" />
      <p className="text-sm text-slate-400">No lifecycle events yet. Seed data to see a demo timeline.</p>
    </div>
  );

  const grouped = new Map<string, LifecycleEvent[]>();
  for (const e of sorted) {
    const d = new Date(e.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(e);
  }

  const eBadge = (t: string) => {
    const map: Record<string, string> = { created: "bg-cyan-500/10 text-cyan-400", optimized: "bg-blue-500/10 text-blue-400", retired: "bg-red-500/10 text-red-400", job_found: "bg-emerald-500/10 text-emerald-400", evaluated: "bg-indigo-500/10 text-indigo-400" };
    return map[t] || "bg-slate-700 text-slate-400";
  };

  const eIcon = (t: string) => {
    const base = "w-5 h-5 rounded-full flex items-center justify-center";
    const map: Record<string, { cls: string; icon: React.ReactNode }> = {
      created: { cls: `${base} bg-cyan-500/15`, icon: <Zap className="w-2.5 h-2.5 text-cyan-400" /> },
      optimized: { cls: `${base} bg-blue-500/15`, icon: <RefreshCw className="w-2.5 h-2.5 text-blue-400" /> },
      retired: { cls: `${base} bg-red-500/15`, icon: <AlertTriangle className="w-2.5 h-2.5 text-red-400" /> },
      job_found: { cls: `${base} bg-emerald-500/15`, icon: <Briefcase className="w-2.5 h-2.5 text-emerald-400" /> },
      evaluated: { cls: `${base} bg-indigo-500/15`, icon: <Eye className="w-2.5 h-2.5 text-indigo-400" /> },
    };
    const m = map[t] || { cls: `${base} bg-slate-700`, icon: <Circle className="w-2.5 h-2.5 text-slate-400" /> };
    return <div className={m.cls}>{m.icon}</div>;
  };

  return (
    <div className="space-y-6">
      {[...grouped.entries()].map(([day, dayEvents]) => (
        <div key={day}>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> {day}
          </h4>
          <div className="space-y-1.5 ml-3 border-l border-slate-700/50 pl-4">
            {dayEvents.map(evt => (
              <div key={evt.id} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{eIcon(evt.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${eBadge(evt.type)}`}>{evt.type.toUpperCase().replace("_", " ")}</span>
                    <span className="text-[10px] text-slate-600">{new Date(evt.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    {evt.impact !== undefined && <span className="text-[10px] text-slate-500">Impact: <span style={{ color: scoreColor(evt.impact / 100) }}>{evt.impact}</span></span>}
                  </div>
                  <p className="text-xs text-slate-300">{evt.details}</p>
                  {evt.parentScoutId && <p className="text-[10px] text-purple-400 mt-0.5 flex items-center gap-1"><GitBranch className="w-2.5 h-2.5" /> Spawned from parent scout</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Bottom Panels ───────────────────────────────

function SkillsInDemand({ skills }: { skills: string[] }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-amber-400" /> Skills In Demand</h3>
      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">{skills.slice(0, 20).map((s, i) => <span key={i} className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px] border border-amber-500/15">{s}</span>)}</div>
      ) : <p className="text-xs text-slate-600 italic">Skills appear as jobs are analyzed.</p>}
    </div>
  );
}

function DiscoveredSources({ sources }: { sources: DiscoveredSource[] }) {
  const sorted = [...sources].sort((a, b) => b.relevanceScore - a.relevanceScore);
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Globe className="w-4 h-4 text-cyan-400" /> Discovered Sources</h3>
      {sorted.length > 0 ? (
        <div className="space-y-2">
          {sorted.slice(0, 10).map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.relevanceScore > 0.7 ? "#10b981" : s.relevanceScore > 0.4 ? "#f59e0b" : "#6b7280" }} />
                <span className="text-xs text-slate-300 truncate">{s.company}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-slate-500">{s.jobsFound} jobs</span>
                <span className="text-[10px]" style={{ color: scoreColor(s.relevanceScore) }}>{(s.relevanceScore * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-slate-600 italic">Sources appear as jobs are discovered.</p>}
    </div>
  );
}

function EmergingCompanies({ companies }: { companies: string[] }) {
  if (companies.length === 0) return null;
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-purple-400" /> AI Suggested Companies</h3>
      <div className="space-y-1.5">{companies.map((c, i) => <div key={i} className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-purple-400" /><span className="text-xs text-slate-400">{c}</span></div>)}</div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-1.5">{icon}<span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span></div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}