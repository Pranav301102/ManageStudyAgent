"use client";

import Link from "next/link";
import {
  Radar,
  Brain,
  BarChart3,
  Mic,
  ArrowRight,
  Sparkles,
  Network,
  BookOpen,
  ChevronRight,
} from "lucide-react";

const features = [
  {
    icon: Radar,
    title: "Autonomous Scouts",
    desc: "AI agents continuously discover jobs matching your profile across the web.",
    color: "from-indigo-500 to-purple-600",
  },
  {
    icon: Brain,
    title: "Smart Skill Mapping",
    desc: "Neo4j knowledge graph identifies skill gaps and bridge paths to your dream role.",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: Mic,
    title: "Voice Mock Interviews",
    desc: "Practice with AI interviewers that adapt to your strengths and weaknesses.",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: BarChart3,
    title: "Adaptive Study Plans",
    desc: "AI generates personalized study schedules that evolve after every interview.",
    color: "from-cyan-500 to-blue-600",
  },
  {
    icon: Network,
    title: "Entity Extraction",
    desc: "GLiNER extracts skills, technologies, and patterns from JDs and code in real-time.",
    color: "from-pink-500 to-rose-600",
  },
  {
    icon: BookOpen,
    title: "Application Tracker",
    desc: "Kanban board tracks every application from saved → screening → offer.",
    color: "from-violet-500 to-fuchsia-600",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 overflow-hidden">
      {/* Hero Section */}
      <section className="relative px-6 pt-16 pb-24">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-32 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Top bar */}
        <div className="max-w-7xl mx-auto flex items-center justify-between mb-20">
          <div className="flex items-center gap-2">
            <Radar className="w-8 h-8 text-indigo-400" />
            <span className="text-xl font-bold text-white tracking-tight">
              CareerAdvocate
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="text-sm bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>

        {/* Hero text */}
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-indigo-400">
              AI-Powered Career Intelligence
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.1] mb-6 tracking-tight">
            Your Autonomous{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Career Advocate
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            From job discovery to mock interviews — an AI system that scouts opportunities,
            maps your skills, and optimizes your preparation. Autonomously.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25"
            >
              Launch Dashboard
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white px-6 py-3 rounded-xl font-medium transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Dashboard preview mockup */}
        <div className="max-w-5xl mx-auto mt-16 relative z-10">
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-1 shadow-2xl shadow-indigo-500/5">
            <div className="bg-slate-900 rounded-xl p-6">
              {/* Fake top bar */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400/60" />
                <div className="w-3 h-3 rounded-full bg-amber-400/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
                <div className="ml-4 w-48 h-5 bg-slate-800 rounded-md" />
              </div>
              {/* Fake stat cards */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Jobs Found", val: "24", color: "border-indigo-500/30" },
                  { label: "Applications", val: "8", color: "border-emerald-500/30" },
                  { label: "Interviews", val: "5", color: "border-amber-500/30" },
                  { label: "Study Hours", val: "38", color: "border-cyan-500/30" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`bg-slate-800/50 border ${s.color} rounded-lg p-3`}
                  >
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {s.label}
                    </p>
                    <p className="text-2xl font-bold text-white mt-1">{s.val}</p>
                  </div>
                ))}
              </div>
              {/* Fake activity rows */}
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-700/50" />
                    <div className="flex-1 space-y-1.5">
                      <div
                        className="h-3 bg-slate-700/60 rounded"
                        style={{ width: `${60 + i * 10}%` }}
                      />
                      <div
                        className="h-2 bg-slate-800 rounded"
                        style={{ width: `${40 + i * 10}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-20 bg-slate-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">
              Everything You Need to Land the Role
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              An end-to-end system that handles job discovery, skill analysis,
              interview prep, and study optimization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/50 hover:border-slate-600 rounded-xl p-5 transition-all duration-300"
              >
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}
                >
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  {f.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Automate Your Job Search?
          </h2>
          <p className="text-slate-400 mb-8">
            No sign-up required. Jump straight into the dashboard and start scouting.
          </p>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white px-8 py-3.5 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25"
          >
            Launch Dashboard
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radar className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-slate-500">
              CareerAdvocate · Built for SB Hacks XI
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>GLiNER</span>
            <span>·</span>
            <span>Pioneer</span>
            <span>·</span>
            <span>Neo4j</span>
            <span>·</span>
            <span>Yutori</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
