// ─── Seed API — Populate DB with realistic demo data ────────────────
// POST /api/seed — seeds scouts, jobs, and memory library with demo data

import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { addJob, addScout, store } from "@/lib/store";
import { Job, Scout } from "@/lib/types";
import * as memoryLibrary from "@/lib/services/memory-library";

// ─── Demo Scouts ─────────────────────────────────────────────────────

const DEMO_SCOUTS: Omit<Scout, "id">[] = [
  {
    query: "Software Engineering Intern at Parallel, Modular, Concora Credit — Python, TypeScript, React",
    targetCompanies: ["Parallel", "Modular", "Concora Credit"],
    interval: 1800,
    status: "active",
    jobsFound: 12,
    createdAt: "2026-02-20T10:00:00Z",
    lastRun: "2026-02-27T08:30:00Z",
  },
  {
    query: "ML Engineer Intern positions at AI-first companies — PyTorch, TensorFlow, scikit-learn",
    targetCompanies: ["Anthropic", "DeepMind", "Cohere"],
    interval: 1800,
    status: "active",
    jobsFound: 8,
    createdAt: "2026-02-20T10:05:00Z",
    lastRun: "2026-02-27T07:15:00Z",
  },
  {
    query: "Backend Engineer roles — Node.js, FastAPI, PostgreSQL, Docker, microservices",
    targetCompanies: ["Stripe", "Vercel", "Supabase"],
    interval: 3600,
    status: "active",
    jobsFound: 15,
    createdAt: "2026-02-20T10:10:00Z",
    lastRun: "2026-02-27T09:00:00Z",
  },
  {
    query: "Monitor Stripe careers page for engineering internships",
    targetCompanies: ["Stripe"],
    interval: 1800,
    status: "active",
    jobsFound: 4,
    createdAt: "2026-02-22T14:00:00Z",
    lastRun: "2026-02-27T06:45:00Z",
  },
  {
    query: "Monitor Vercel careers — frontend & full-stack roles with Next.js, React",
    targetCompanies: ["Vercel"],
    interval: 1800,
    status: "active",
    jobsFound: 6,
    createdAt: "2026-02-22T14:05:00Z",
    lastRun: "2026-02-27T08:00:00Z",
  },
  {
    query: "Expansion: Monitor Anthropic — leading AI safety company hiring ML engineers",
    targetCompanies: ["Anthropic"],
    interval: 3600,
    status: "active",
    jobsFound: 3,
    createdAt: "2026-02-24T09:00:00Z",
    lastRun: "2026-02-27T05:30:00Z",
  },
  {
    query: "Monitor Supabase careers for backend & DevOps positions",
    targetCompanies: ["Supabase"],
    interval: 3600,
    status: "active",
    jobsFound: 2,
    createdAt: "2026-02-25T11:00:00Z",
    lastRun: "2026-02-27T04:00:00Z",
  },
  // Retired scouts
  {
    query: "Junior Java Developer positions at enterprise companies — Spring Boot, Hibernate",
    targetCompanies: ["Oracle", "SAP"],
    interval: 3600,
    status: "paused",
    jobsFound: 1,
    createdAt: "2026-02-20T10:15:00Z",
    lastRun: "2026-02-23T12:00:00Z",
  },
  {
    query: "DevOps roles at cloud providers — AWS, GCP, Terraform",
    targetCompanies: ["AWS", "GCP"],
    interval: 7200,
    status: "paused",
    jobsFound: 0,
    createdAt: "2026-02-21T08:00:00Z",
  },
];

// ─── Demo Jobs ───────────────────────────────────────────────────────

const DEMO_JOBS: Omit<Job, "id">[] = [
  {
    title: "Software Engineering Intern",
    company: "Stripe",
    location: "San Francisco, CA (Hybrid)",
    url: "https://stripe.com/jobs/listing/software-engineering-intern/5843",
    description: "Join Stripe's engineering team to build payment infrastructure. Work with Ruby, Go, and React. Strong CS fundamentals required.",
    requiredSkills: [
      { name: "Python", importance: "required" },
      { name: "Data Structures", importance: "required" },
      { name: "REST APIs", importance: "required" },
    ],
    preferredSkills: [
      { name: "Go", importance: "preferred" },
      { name: "React", importance: "preferred" },
    ],
    techStack: ["Ruby", "Go", "React", "PostgreSQL", "AWS"],
    salaryRange: "$55-65/hr",
    postedDate: "2026-02-25T00:00:00Z",
    discoveredAt: "2026-02-25T14:30:00Z",
    matchScore: 82,
    skillGaps: [{ skillName: "Go", importance: "preferred", learningResources: ["go.dev/tour"], bridgePath: ["Python"] }],
    interviewReady: true,
    status: "analyzed",
    scoutId: "scout-stripe",
  },
  {
    title: "ML Engineer Intern",
    company: "Anthropic",
    location: "San Francisco, CA",
    url: "https://anthropic.com/careers/ml-engineer-intern",
    description: "Work on large language model development. Experience with PyTorch, distributed systems, and strong math background required.",
    requiredSkills: [
      { name: "Python", importance: "required" },
      { name: "Machine Learning", importance: "required" },
      { name: "PyTorch", importance: "required" },
    ],
    preferredSkills: [
      { name: "Distributed Systems", importance: "preferred" },
      { name: "CUDA", importance: "preferred" },
    ],
    techStack: ["Python", "PyTorch", "JAX", "CUDA", "Kubernetes"],
    salaryRange: "$70-85/hr",
    postedDate: "2026-02-24T00:00:00Z",
    discoveredAt: "2026-02-24T10:00:00Z",
    matchScore: 68,
    skillGaps: [
      { skillName: "PyTorch", importance: "required", learningResources: ["pytorch.org/tutorials"], bridgePath: ["Python", "Machine Learning"] },
      { skillName: "CUDA", importance: "preferred", learningResources: ["developer.nvidia.com/cuda"], bridgePath: [] },
    ],
    interviewReady: false,
    status: "researching",
    scoutId: "scout-anthropic",
  },
  {
    title: "Full Stack Engineer Intern",
    company: "Vercel",
    location: "Remote (US)",
    url: "https://vercel.com/careers/full-stack-intern",
    description: "Build next-generation web infrastructure. Deep knowledge of Next.js, React, and TypeScript required.",
    requiredSkills: [
      { name: "TypeScript", importance: "required" },
      { name: "React", importance: "required" },
      { name: "Node.js", importance: "required" },
    ],
    preferredSkills: [
      { name: "Next.js", importance: "preferred" },
      { name: "Vercel", importance: "preferred" },
    ],
    techStack: ["TypeScript", "React", "Next.js", "Node.js", "Turborepo"],
    salaryRange: "$50-60/hr",
    postedDate: "2026-02-26T00:00:00Z",
    discoveredAt: "2026-02-26T16:00:00Z",
    matchScore: 91,
    skillGaps: [],
    interviewReady: true,
    status: "interview-ready",
    scoutId: "scout-vercel",
  },
  {
    title: "Backend Engineer",
    company: "Supabase",
    location: "Remote",
    url: "https://supabase.com/careers/backend-engineer",
    description: "Build the open-source Firebase alternative. Strong PostgreSQL, Go, and API design skills needed.",
    requiredSkills: [
      { name: "PostgreSQL", importance: "required" },
      { name: "REST APIs", importance: "required" },
      { name: "Docker", importance: "required" },
    ],
    preferredSkills: [
      { name: "Go", importance: "preferred" },
      { name: "Elixir", importance: "preferred" },
    ],
    techStack: ["PostgreSQL", "Go", "Elixir", "Docker", "Kubernetes"],
    postedDate: "2026-02-23T00:00:00Z",
    discoveredAt: "2026-02-23T09:00:00Z",
    matchScore: 74,
    skillGaps: [{ skillName: "Go", importance: "preferred", learningResources: ["go.dev"], bridgePath: ["Python"] }],
    interviewReady: false,
    status: "analyzed",
    scoutId: "scout-supabase",
  },
  {
    title: "Software Engineer Intern — Platform",
    company: "Parallel",
    location: "New York, NY",
    url: "https://parallel.co/careers/se-intern",
    description: "Build financial technology platform. Experience with Python, TypeScript, PostgreSQL. Fintech interest a plus.",
    requiredSkills: [
      { name: "Python", importance: "required" },
      { name: "TypeScript", importance: "required" },
    ],
    preferredSkills: [
      { name: "PostgreSQL", importance: "preferred" },
      { name: "FastAPI", importance: "preferred" },
    ],
    techStack: ["Python", "TypeScript", "React", "PostgreSQL", "FastAPI"],
    postedDate: "2026-02-22T00:00:00Z",
    discoveredAt: "2026-02-22T11:00:00Z",
    matchScore: 88,
    skillGaps: [],
    interviewReady: true,
    status: "interview-ready",
    scoutId: "scout-main",
  },
  {
    title: "ML Research Intern",
    company: "Cohere",
    location: "Toronto, Canada (Remote OK)",
    url: "https://cohere.com/careers/ml-research-intern",
    description: "Research and develop NLP models. Strong Python, ML fundamentals, and experience with transformers required.",
    requiredSkills: [
      { name: "Python", importance: "required" },
      { name: "Machine Learning", importance: "required" },
    ],
    preferredSkills: [
      { name: "Transformers", importance: "preferred" },
      { name: "NLP", importance: "preferred" },
    ],
    techStack: ["Python", "PyTorch", "Transformers", "ONNX"],
    salaryRange: "CAD $45-55/hr",
    postedDate: "2026-02-21T00:00:00Z",
    discoveredAt: "2026-02-21T15:00:00Z",
    matchScore: 63,
    skillGaps: [
      { skillName: "Transformers", importance: "preferred", learningResources: ["huggingface.co/learn"], bridgePath: ["Python", "Machine Learning"] },
    ],
    interviewReady: false,
    status: "analyzed",
    scoutId: "scout-ml",
  },
  {
    title: "Software Engineer — Core Infrastructure",
    company: "Modular",
    location: "Remote (US)",
    url: "https://modular.com/careers/core-infra",
    description: "Build high-performance infrastructure for Mojo and MAX platform. Systems programming experience desired.",
    requiredSkills: [
      { name: "Python", importance: "required" },
      { name: "Data Structures", importance: "required" },
    ],
    preferredSkills: [
      { name: "C++", importance: "preferred" },
      { name: "LLVM", importance: "preferred" },
    ],
    techStack: ["Python", "Mojo", "C++", "LLVM", "Docker"],
    postedDate: "2026-02-20T00:00:00Z",
    discoveredAt: "2026-02-20T08:00:00Z",
    matchScore: 71,
    skillGaps: [
      { skillName: "C++", importance: "preferred", learningResources: ["learncpp.com"], bridgePath: ["Python"] },
    ],
    interviewReady: false,
    status: "researching",
    scoutId: "scout-main",
  },
  {
    title: "Platform Engineering Intern",
    company: "Concora Credit",
    location: "Dallas, TX (Hybrid)",
    url: "https://concoracredit.com/careers/platform-intern",
    description: "Build credit technology platform. Python, SQL, and cloud experience. Fintech background preferred.",
    requiredSkills: [
      { name: "Python", importance: "required" },
      { name: "PostgreSQL", importance: "required" },
    ],
    preferredSkills: [
      { name: "Docker", importance: "preferred" },
      { name: "AWS", importance: "preferred" },
    ],
    techStack: ["Python", "PostgreSQL", "Docker", "AWS", "React"],
    postedDate: "2026-02-19T00:00:00Z",
    discoveredAt: "2026-02-19T13:00:00Z",
    matchScore: 79,
    skillGaps: [],
    interviewReady: true,
    status: "analyzed",
    scoutId: "scout-main",
  },
];

// ─── Demo Lifecycle Events (for the visual graph) ────────────────────

export interface ScoutLifecycleEvent {
  id: string;
  timestamp: string;
  type: "created" | "optimized" | "replicated" | "retired" | "expanded" | "job_found" | "evaluated";
  scoutId: string;
  scoutQuery: string;
  parentScoutId?: string;
  details: string;
  impact?: number; // 0-100
}

const DEMO_LIFECYCLE_EVENTS: ScoutLifecycleEvent[] = [
  // Day 1 — Initial scouts created
  { id: "evt-1", timestamp: "2026-02-20T10:00:00Z", type: "created", scoutId: "scout-main", scoutQuery: "SE Intern at Parallel, Modular, Concora Credit", details: "AI auto-generated primary role scout", impact: 80 },
  { id: "evt-2", timestamp: "2026-02-20T10:05:00Z", type: "created", scoutId: "scout-ml", scoutQuery: "ML Engineer Intern — PyTorch, TensorFlow", details: "AI auto-generated ML role scout", impact: 70 },
  { id: "evt-3", timestamp: "2026-02-20T10:10:00Z", type: "created", scoutId: "scout-backend", scoutQuery: "Backend Engineer — Node.js, FastAPI, PostgreSQL", details: "AI auto-generated backend scout", impact: 75 },
  // Day 1 — First jobs found
  { id: "evt-4", timestamp: "2026-02-20T14:00:00Z", type: "job_found", scoutId: "scout-main", scoutQuery: "SE Intern", details: "Modular — Core Infrastructure Engineer", impact: 71 },
  // Day 2 — More jobs
  { id: "evt-5", timestamp: "2026-02-21T09:00:00Z", type: "job_found", scoutId: "scout-ml", scoutQuery: "ML Engineer Intern", details: "Cohere — ML Research Intern (match: 63%)", impact: 63 },
  { id: "evt-6", timestamp: "2026-02-21T15:00:00Z", type: "evaluated", scoutId: "scout-main", scoutQuery: "SE Intern", details: "Lifecycle evaluated: relevance 0.78, 3 jobs found", impact: 78 },
  // Day 2 — Self-replication triggered
  { id: "evt-7", timestamp: "2026-02-22T11:00:00Z", type: "job_found", scoutId: "scout-main", scoutQuery: "SE Intern", details: "Parallel — SE Intern Platform (match: 88%) HIGH VALUE", impact: 88 },
  { id: "evt-8", timestamp: "2026-02-22T14:00:00Z", type: "replicated", scoutId: "scout-stripe", scoutQuery: "Monitor Stripe careers — engineering internships", parentScoutId: "scout-backend", details: "🧬 Self-replicated from backend scout after Stripe job hit", impact: 82 },
  { id: "evt-9", timestamp: "2026-02-22T14:05:00Z", type: "replicated", scoutId: "scout-vercel", scoutQuery: "Monitor Vercel careers — Next.js, React", parentScoutId: "scout-backend", details: "🧬 Self-replicated from backend scout after Vercel discovery", impact: 85 },
  // Day 3 — Optimization
  { id: "evt-10", timestamp: "2026-02-23T08:00:00Z", type: "evaluated", scoutId: "scout-backend", scoutQuery: "Backend Engineer", details: "Lifecycle evaluated: relevance 0.55 — needs optimization", impact: 55 },
  { id: "evt-11", timestamp: "2026-02-23T08:15:00Z", type: "optimized", scoutId: "scout-backend", scoutQuery: "Backend Engineer — Node.js, FastAPI, PostgreSQL, Docker, microservices", details: "LLM rewrote query: added Docker + microservices keywords", impact: 72 },
  { id: "evt-12", timestamp: "2026-02-23T09:00:00Z", type: "job_found", scoutId: "scout-backend", scoutQuery: "Backend Engineer", details: "Supabase — Backend Engineer (match: 74%)", impact: 74 },
  // Day 3 — Retired underperformers
  { id: "evt-13", timestamp: "2026-02-23T12:00:00Z", type: "retired", scoutId: "scout-java", scoutQuery: "Junior Java Developer — Spring Boot", details: "Retired: relevance 0.18, only 1 job found in 3 days", impact: 18 },
  // Day 4 — Network expansion
  { id: "evt-14", timestamp: "2026-02-24T09:00:00Z", type: "expanded", scoutId: "scout-anthropic", scoutQuery: "Expansion: Monitor Anthropic — AI safety company", details: "🌱 LLM suggested Anthropic as emerging AI company worth monitoring", impact: 90 },
  { id: "evt-15", timestamp: "2026-02-24T10:00:00Z", type: "job_found", scoutId: "scout-anthropic", scoutQuery: "Anthropic", details: "Anthropic — ML Engineer Intern (match: 68%)", impact: 68 },
  // Day 5 — More replication
  { id: "evt-16", timestamp: "2026-02-25T11:00:00Z", type: "replicated", scoutId: "scout-supabase", scoutQuery: "Monitor Supabase careers — backend & DevOps", parentScoutId: "scout-backend", details: "🧬 Self-replicated after high-value Supabase hit", impact: 74 },
  { id: "evt-17", timestamp: "2026-02-25T14:30:00Z", type: "job_found", scoutId: "scout-stripe", scoutQuery: "Stripe", details: "Stripe — Software Engineering Intern (match: 82%) HIGH VALUE", impact: 82 },
  // Day 6 — Evaluation cycle
  { id: "evt-18", timestamp: "2026-02-26T08:00:00Z", type: "evaluated", scoutId: "scout-stripe", scoutQuery: "Stripe", details: "Lifecycle evaluated: relevance 0.89, 4 jobs found — excellent", impact: 89 },
  { id: "evt-19", timestamp: "2026-02-26T08:05:00Z", type: "evaluated", scoutId: "scout-vercel", scoutQuery: "Vercel", details: "Lifecycle evaluated: relevance 0.92, 6 jobs found — top performer", impact: 92 },
  { id: "evt-20", timestamp: "2026-02-26T16:00:00Z", type: "job_found", scoutId: "scout-vercel", scoutQuery: "Vercel", details: "Vercel — Full Stack Engineer Intern (match: 91%) HIGH VALUE", impact: 91 },
  // Day 7 — DevOps retired
  { id: "evt-21", timestamp: "2026-02-27T02:00:00Z", type: "retired", scoutId: "scout-devops", scoutQuery: "DevOps roles — AWS, GCP, Terraform", details: "Retired: 7 days with 0 results, auto-pruned", impact: 0 },
  // Day 7 — Latest evaluation
  { id: "evt-22", timestamp: "2026-02-27T08:00:00Z", type: "evaluated", scoutId: "scout-main", scoutQuery: "SE Intern", details: "Lifecycle evaluated: relevance 0.85, 12 jobs found — strong", impact: 85 },
  { id: "evt-23", timestamp: "2026-02-27T08:05:00Z", type: "evaluated", scoutId: "scout-anthropic", scoutQuery: "Anthropic", details: "Lifecycle evaluated: relevance 0.73, 3 jobs found — growing", impact: 73 },
];

// ─── POST Handler ────────────────────────────────────────────────────

export async function POST() {
  try {
    const scoutIdMap = new Map<string, string>();

    // 1. Seed scouts
    for (const demoScout of DEMO_SCOUTS) {
      const id = uuid();
      const scout: Scout = { id, ...demoScout };
      // Map demo scoutIds to real UUIDs
      if (demoScout.query.includes("Parallel")) scoutIdMap.set("scout-main", id);
      if (demoScout.query.includes("ML Engineer")) scoutIdMap.set("scout-ml", id);
      if (demoScout.query.includes("Backend Engineer")) scoutIdMap.set("scout-backend", id);
      if (demoScout.query.includes("Stripe")) scoutIdMap.set("scout-stripe", id);
      if (demoScout.query.includes("Vercel")) scoutIdMap.set("scout-vercel", id);
      if (demoScout.query.includes("Anthropic")) scoutIdMap.set("scout-anthropic", id);
      if (demoScout.query.includes("Supabase")) scoutIdMap.set("scout-supabase", id);
      if (demoScout.query.includes("Java")) scoutIdMap.set("scout-java", id);
      if (demoScout.query.includes("DevOps")) scoutIdMap.set("scout-devops", id);
      addScout(scout);
    }

    // 2. Seed jobs (with correct scoutId references)
    for (const demoJob of DEMO_JOBS) {
      const id = uuid();
      const resolvedScoutId = demoJob.scoutId ? scoutIdMap.get(demoJob.scoutId) || demoJob.scoutId : undefined;
      const job: Job = { ...demoJob, id, scoutId: resolvedScoutId };
      addJob(job);
    }

    // 3. Update memory library with rich data
    const library = await memoryLibrary.loadMemory();
    library.discoveredSources = [
      { company: "Stripe", careerPageUrl: "https://stripe.com/jobs", jobsFound: 4, relevanceScore: 0.89, addedAt: "2026-02-22T14:00:00Z" },
      { company: "Vercel", careerPageUrl: "https://vercel.com/careers", jobsFound: 6, relevanceScore: 0.92, addedAt: "2026-02-22T14:05:00Z" },
      { company: "Anthropic", careerPageUrl: "https://anthropic.com/careers", jobsFound: 3, relevanceScore: 0.73, addedAt: "2026-02-24T09:00:00Z" },
      { company: "Supabase", careerPageUrl: "https://supabase.com/careers", jobsFound: 2, relevanceScore: 0.68, addedAt: "2026-02-25T11:00:00Z" },
      { company: "Parallel", careerPageUrl: "https://parallel.co/careers", jobsFound: 3, relevanceScore: 0.85, addedAt: "2026-02-20T10:00:00Z" },
      { company: "Modular", careerPageUrl: "https://modular.com/careers", jobsFound: 2, relevanceScore: 0.71, addedAt: "2026-02-20T10:00:00Z" },
      { company: "Cohere", careerPageUrl: "https://cohere.com/careers", jobsFound: 2, relevanceScore: 0.63, addedAt: "2026-02-21T09:00:00Z" },
      { company: "Concora Credit", careerPageUrl: "https://concoracredit.com/careers", jobsFound: 1, relevanceScore: 0.79, addedAt: "2026-02-19T13:00:00Z" },
    ];
    library.insights = {
      topSkillsInDemand: [
        "Python", "TypeScript", "React", "Node.js", "PostgreSQL",
        "Docker", "Go", "PyTorch", "REST APIs", "FastAPI",
        "Kubernetes", "Next.js", "Machine Learning", "Git", "AWS",
        "Data Structures", "Distributed Systems", "GraphQL", "Redis", "CI/CD",
      ],
      emergingCompanies: ["Anthropic", "Mistral AI", "Together AI", "Perplexity", "Groq"],
      queryPatterns: ["role + company + skills", "monitor company careers page", "skill-based broad search"],
      totalJobsDiscovered: 51,
      avgRelevanceScore: 0.77,
    };

    // Update scout entries in memory library
    library.scouts = [
      { id: "s1", query: "SE Intern at Parallel, Modular, Concora Credit", strategy: "exact_match", source: "auto" as const, performance: { relevanceScore: 0.85, jobsFound: 12, lastEvaluated: "2026-02-27T08:00:00Z" }, tags: ["se-intern", "target-companies"], priority: 5, createdAt: "2026-02-20T10:00:00Z", lastActive: "2026-02-27T08:30:00Z", status: "active" as const },
      { id: "s2", query: "ML Engineer Intern — PyTorch, TensorFlow", strategy: "skill_based", source: "auto" as const, performance: { relevanceScore: 0.72, jobsFound: 8, lastEvaluated: "2026-02-26T08:00:00Z" }, tags: ["ml", "ai", "pytorch"], priority: 4, createdAt: "2026-02-20T10:05:00Z", lastActive: "2026-02-27T07:15:00Z", status: "active" as const },
      { id: "s3", query: "Backend Engineer — Node.js, FastAPI, PostgreSQL, Docker", strategy: "skill_based", source: "auto" as const, performance: { relevanceScore: 0.72, jobsFound: 15, lastEvaluated: "2026-02-26T08:00:00Z" }, tags: ["backend", "node", "fastapi"], priority: 4, createdAt: "2026-02-20T10:10:00Z", lastActive: "2026-02-27T09:00:00Z", status: "active" as const },
      { id: "s4", query: "Monitor Stripe careers", strategy: "self_replicated", source: "auto" as const, performance: { relevanceScore: 0.89, jobsFound: 4, lastEvaluated: "2026-02-26T08:00:00Z" }, tags: ["stripe", "auto-spawned"], priority: 4, createdAt: "2026-02-22T14:00:00Z", lastActive: "2026-02-27T06:45:00Z", status: "active" as const },
      { id: "s5", query: "Monitor Vercel careers", strategy: "self_replicated", source: "auto" as const, performance: { relevanceScore: 0.92, jobsFound: 6, lastEvaluated: "2026-02-26T08:05:00Z" }, tags: ["vercel", "auto-spawned"], priority: 5, createdAt: "2026-02-22T14:05:00Z", lastActive: "2026-02-27T08:00:00Z", status: "active" as const },
      { id: "s6", query: "Expansion: Monitor Anthropic", strategy: "network_expansion", source: "auto" as const, performance: { relevanceScore: 0.73, jobsFound: 3, lastEvaluated: "2026-02-27T08:05:00Z" }, tags: ["anthropic", "expansion"], priority: 3, createdAt: "2026-02-24T09:00:00Z", lastActive: "2026-02-27T05:30:00Z", status: "active" as const },
      { id: "s7", query: "Monitor Supabase careers", strategy: "self_replicated", source: "auto" as const, performance: { relevanceScore: 0.68, jobsFound: 2 }, tags: ["supabase", "auto-spawned"], priority: 3, createdAt: "2026-02-25T11:00:00Z", lastActive: "2026-02-27T04:00:00Z", status: "active" as const },
      { id: "s8", query: "Junior Java Developer — Spring Boot", strategy: "exact_match", source: "auto" as const, performance: { relevanceScore: 0.18, jobsFound: 1 }, tags: ["java"], priority: 2, createdAt: "2026-02-20T10:15:00Z", status: "retired" as const },
      { id: "s9", query: "DevOps roles — AWS, GCP, Terraform", strategy: "broad_search", source: "auto" as const, performance: { relevanceScore: 0, jobsFound: 0 }, tags: ["devops"], priority: 1, createdAt: "2026-02-21T08:00:00Z", status: "retired" as const },
    ];

    library.updatedAt = new Date().toISOString();
    await memoryLibrary.saveMemory(library);

    // 4. Store lifecycle events in a special JSON for the frontend
    const lifecycleData = {
      events: DEMO_LIFECYCLE_EVENTS,
      scoutIdMap: Object.fromEntries(scoutIdMap),
      lastCycleReport: {
        timestamp: "2026-02-27T08:00:00Z",
        evaluated: 5,
        optimized: 0,
        retired: 1,
        spawned: 0,
        expanded: 0,
        errors: [],
      },
    };
    // Store lifecycle events as a special entry in study_schedule table (reusing JSON store)
    const { upsertJson } = await import("@/lib/db");
    upsertJson("study_schedule", "lifecycle_events", lifecycleData);

    return NextResponse.json({
      success: true,
      data: {
        scoutsSeeded: DEMO_SCOUTS.length,
        jobsSeeded: DEMO_JOBS.length,
        sourcesSeeded: library.discoveredSources.length,
        lifecycleEvents: DEMO_LIFECYCLE_EVENTS.length,
        message: `Seeded ${DEMO_SCOUTS.length} scouts, ${DEMO_JOBS.length} jobs, ${library.discoveredSources.length} sources, and ${DEMO_LIFECYCLE_EVENTS.length} lifecycle events.`,
      },
    });
  } catch (error) {
    console.error("[Seed API] Error:", error);
    return NextResponse.json(
      { success: false, error: `Seed failed: ${error}` },
      { status: 500 }
    );
  }
}
