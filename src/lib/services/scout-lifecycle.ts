// ─── Scout Lifecycle — Self-Replicating Autonomous Scout System ──────
// This module is the autonomous nervous system for the scouting pipeline.
// It runs periodic evaluation cycles that:
//   1. EVALUATE — score each scout's performance using LLM + metrics
//   2. OPTIMIZE — rewrite underperforming scout queries via LLM
//   3. REPLICATE — spawn child scouts when high-value companies appear
//   4. PRUNE — retire dead scouts and consolidate duplicates
//   5. EXPAND — discover & monitor new companies from Tavily research
//
// The system is fully self-sufficient: once started, it maintains and
// grows the scout network with zero human intervention.

import { v4 as uuid } from "uuid";
import { store, addScout, updateSystemHealth } from "../store";
import { Scout, Job } from "../types";
import * as yutoriService from "./yutori-service";
import * as scoutIntelligence from "./scout-intelligence";
import * as memoryLibrary from "./memory-library";
import * as tavilyService from "./tavily-service";
import * as glinerService from "./gliner-service";

// ─── Config ──────────────────────────────────────────────────────────

const LIFECYCLE = {
  /** How often the autonomous evaluation cycle runs (ms) */
  CYCLE_INTERVAL: 60 * 60 * 1000, // 1 hour

  /** Minimum jobs a scout must find before it's evaluated */
  MIN_JOBS_FOR_EVAL: 2,

  /** Match score threshold for a job to count as "high value" */
  HIGH_VALUE_THRESHOLD: 70,

  /** Relevance score below which a scout is retired */
  RETIRE_THRESHOLD: 0.25,

  /** Relevance score below which a scout is optimized */
  OPTIMIZE_THRESHOLD: 0.6,

  /** Max number of child scouts the system can auto-create per cycle */
  MAX_CHILDREN_PER_CYCLE: 3,

  /** Max total scouts in the fleet */
  MAX_FLEET_SIZE: 20,

  /** Max age (ms) for a scout with zero results before retirement */
  STALE_TIMEOUT: 7 * 24 * 60 * 60 * 1000, // 7 days

  /** Minimum hours between company scout spawns for the same company */
  COMPANY_COOLDOWN: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Track which companies already have dedicated scouts
const companyScoutRegistry = new Map<string, { scoutId: string; createdAt: number }>();

// ─── Autonomous Lifecycle Timer ──────────────────────────────────────

let lifecycleTimer: ReturnType<typeof setInterval> | null = null;

export function startLifecycle(): void {
  if (lifecycleTimer) return;
  console.log("[ScoutLifecycle] Starting autonomous lifecycle (every 1h)");
  lifecycleTimer = setInterval(() => {
    runLifecycleCycle().catch((err) =>
      console.error("[ScoutLifecycle] Cycle failed:", err)
    );
  }, LIFECYCLE.CYCLE_INTERVAL);

  // Run first cycle after a short delay to let the system initialize
  setTimeout(() => {
    runLifecycleCycle().catch((err) =>
      console.error("[ScoutLifecycle] Initial cycle failed:", err)
    );
  }, 30_000);
}

export function stopLifecycle(): void {
  if (lifecycleTimer) {
    clearInterval(lifecycleTimer);
    lifecycleTimer = null;
    console.log("[ScoutLifecycle] Lifecycle stopped");
  }
}

// ─── Main Lifecycle Cycle ────────────────────────────────────────────

export async function runLifecycleCycle(): Promise<LifecycleReport> {
  console.log("[ScoutLifecycle] ═══ Running autonomous lifecycle cycle ═══");

  const report: LifecycleReport = {
    timestamp: new Date().toISOString(),
    evaluated: 0,
    optimized: 0,
    retired: 0,
    spawned: 0,
    expanded: 0,
    errors: [],
  };

  const scouts = Array.from(store.scouts.values()) as Scout[];
  const jobs = Array.from(store.jobs.values()) as Job[];
  const profile = store.profile;

  // Phase 1: EVALUATE — score every active scout
  console.log("[ScoutLifecycle] Phase 1: Evaluating scout performance...");
  const evaluations = await evaluateAll(scouts, jobs, profile);
  report.evaluated = evaluations.length;

  // Phase 2: OPTIMIZE — rewrite underperforming scouts
  console.log("[ScoutLifecycle] Phase 2: Optimizing underperformers...");
  for (const ev of evaluations) {
    if (ev.recommendation === "optimize" && ev.suggestedImprovement) {
      try {
        await optimizeScout(ev.scoutId, ev.suggestedImprovement, profile);
        report.optimized++;
      } catch (err) {
        report.errors.push(`Optimize ${ev.scoutId}: ${err}`);
      }
    }
  }

  // Phase 3: PRUNE — retire dead scouts
  console.log("[ScoutLifecycle] Phase 3: Pruning dead scouts...");
  for (const ev of evaluations) {
    if (ev.recommendation === "retire") {
      try {
        await retireScout(ev.scoutId);
        report.retired++;
      } catch (err) {
        report.errors.push(`Retire ${ev.scoutId}: ${err}`);
      }
    }
  }

  // Also retire stale scouts with zero results
  for (const scout of scouts) {
    if (
      scout.status === "active" &&
      scout.jobsFound === 0 &&
      Date.now() - new Date(scout.createdAt).getTime() > LIFECYCLE.STALE_TIMEOUT
    ) {
      try {
        await retireScout(scout.id);
        report.retired++;
      } catch (err) {
        report.errors.push(`Retire stale ${scout.id}: ${err}`);
      }
    }
  }

  // Phase 4: REPLICATE — spawn company-specific scouts from discoveries
  console.log("[ScoutLifecycle] Phase 4: Replicating scouts for new companies...");
  const activeCount = Array.from(store.scouts.values())
    .filter((s) => (s as Scout).status === "active").length;

  if (activeCount < LIFECYCLE.MAX_FLEET_SIZE) {
    const spawned = await replicateFromDiscoveries(jobs, profile);
    report.spawned = spawned;
  }

  // Phase 5: EXPAND — discover entirely new companies to monitor
  console.log("[ScoutLifecycle] Phase 5: Expanding scout network...");
  if (activeCount + report.spawned < LIFECYCLE.MAX_FLEET_SIZE) {
    const expanded = await expandNetwork(scouts, profile);
    report.expanded = expanded;
  }

  // Update system health
  updateSystemHealth({
    activeScouts: Array.from(store.scouts.values())
      .filter((s) => (s as Scout).status === "active").length,
  });

  console.log(
    `[ScoutLifecycle] ═══ Cycle complete: ${report.evaluated} evaluated, ` +
    `${report.optimized} optimized, ${report.retired} retired, ` +
    `${report.spawned} spawned, ${report.expanded} expanded ═══`
  );

  return report;
}

// ─── Phase 1: Evaluate ──────────────────────────────────────────────

async function evaluateAll(
  scouts: Scout[],
  jobs: Job[],
  profile: typeof store.profile
): Promise<scoutIntelligence.ScoutPerformance[]> {
  const evaluations: scoutIntelligence.ScoutPerformance[] = [];

  for (const scout of scouts) {
    if (scout.status !== "active") continue;

    // Get jobs this scout has found
    const scoutJobs = jobs.filter((j) => j.scoutId === scout.id);

    if (scoutJobs.length < LIFECYCLE.MIN_JOBS_FOR_EVAL) {
      // Not enough data to evaluate yet
      continue;
    }

    try {
      const perf = await scoutIntelligence.evaluateScoutPerformance(
        scout,
        scoutJobs.map((j) => ({
          job_title: j.title,
          company: j.company,
          description: j.description,
          matchScore: j.matchScore,
        })),
        profile
      );

      evaluations.push(perf);

      // Persist evaluation to memory library
      await memoryLibrary.updateScoutPerformance(perf);
    } catch (err) {
      console.warn(`[ScoutLifecycle] Eval failed for ${scout.id}:`, err);
    }
  }

  return evaluations;
}

// ─── Phase 2: Optimize ──────────────────────────────────────────────

async function optimizeScout(
  scoutId: string,
  feedback: string,
  profile: typeof store.profile
): Promise<void> {
  const scout = store.scouts.get(scoutId) as Scout | undefined;
  if (!scout || !scout.yutoriScoutId) return;

  console.log(`[ScoutLifecycle] Optimizing scout "${scout.query.slice(0, 50)}..."`);

  // LLM generates improved query
  const improvedQuery = await scoutIntelligence.buildOptimizedQuery(
    scout.query,
    feedback,
    profile
  );

  if (improvedQuery === scout.query) return; // no change

  // Update the Yutori scout in-place
  try {
    await yutoriService.updateScoutQuery(scout.yutoriScoutId, improvedQuery);
  } catch {
    // If PATCH fails, delete and recreate
    try {
      await yutoriService.deleteScout(scout.yutoriScoutId);
    } catch { /* ignore */ }

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/yutori`;
    const newScout = await yutoriService.createScout({
      query: improvedQuery,
      output_interval: scout.interval,
      webhook_url: webhookUrl,
      webhook_format: "scout",
      skip_email: true,
    });

    scout.yutoriScoutId = newScout.id;
  }

  // Update local record
  scout.query = improvedQuery;
  store.scouts.set(scoutId, scout);

  console.log(`[ScoutLifecycle] Scout ${scoutId} optimized → "${improvedQuery.slice(0, 60)}..."`);
}

// ─── Phase 3: Retire ────────────────────────────────────────────────

async function retireScout(scoutId: string): Promise<void> {
  const scout = store.scouts.get(scoutId) as Scout | undefined;
  if (!scout) return;

  console.log(`[ScoutLifecycle] Retiring scout "${scout.query.slice(0, 50)}..."`);

  // Delete from Yutori
  if (scout.yutoriScoutId) {
    try {
      await yutoriService.deleteScout(scout.yutoriScoutId);
    } catch (err) {
      console.warn(`[ScoutLifecycle] Failed to delete Yutori scout ${scout.yutoriScoutId}:`, err);
    }
  }

  // Mark as retired locally
  scout.status = "paused"; // keep record for analytics
  store.scouts.set(scoutId, scout);

  // Update memory library
  await memoryLibrary.updateScoutPerformance({
    scoutId,
    relevanceScore: 0,
    totalJobs: scout.jobsFound,
    highMatchJobs: 0,
    recommendation: "retire",
  });
}

// ─── Phase 4: Self-Replication ──────────────────────────────────────
// When a high-value job is found at a new company, spawn a dedicated
// scout to monitor that company's careers page.

async function replicateFromDiscoveries(
  jobs: Job[],
  profile: typeof store.profile
): Promise<number> {
  let spawned = 0;

  // Find high-value companies we don't already have scouts for
  const highValueJobs = jobs.filter((j) => j.matchScore >= LIFECYCLE.HIGH_VALUE_THRESHOLD);

  // Group by company, pick the best match per company
  const companyBest = new Map<string, Job>();
  for (const job of highValueJobs) {
    const key = job.company.toLowerCase();
    const existing = companyBest.get(key);
    if (!existing || job.matchScore > existing.matchScore) {
      companyBest.set(key, job);
    }
  }

  for (const [companyKey, job] of companyBest) {
    if (spawned >= LIFECYCLE.MAX_CHILDREN_PER_CYCLE) break;

    // Skip if we already have a scout for this company
    const existing = companyScoutRegistry.get(companyKey);
    if (existing && Date.now() - existing.createdAt < LIFECYCLE.COMPANY_COOLDOWN) {
      continue;
    }

    // Skip if any existing scout already targets this company specifically
    const existingScouts = Array.from(store.scouts.values()) as Scout[];
    const alreadyScoured = existingScouts.some(
      (s) => s.status === "active" && s.query.toLowerCase().includes(companyKey)
    );
    if (alreadyScoured) {
      companyScoutRegistry.set(companyKey, {
        scoutId: "existing",
        createdAt: Date.now(),
      });
      continue;
    }

    // Use Tavily to find the company's careers page
    let careerPageUrl = "";
    try {
      const searchResult = await tavilyService.search(
        `${job.company} careers page jobs`,
        { maxResults: 3, searchDepth: "basic" }
      );
      const careerResult = searchResult.results.find(
        (r) => r.url.includes("career") || r.url.includes("jobs") || r.url.includes("hiring")
      );
      careerPageUrl = careerResult?.url || searchResult.results[0]?.url || "";
    } catch {
      careerPageUrl = job.url ? new URL(job.url).origin + "/careers" : "";
    }

    if (!careerPageUrl) continue;

    try {
      console.log(`[ScoutLifecycle] 🧬 Replicating: spawning scout for ${job.company} (${careerPageUrl})`);

      const yutoriScout = await yutoriService.createCompanyScout(
        job.company,
        careerPageUrl,
        profile.targetRoles,
        1800
      );

      const newScout: Scout = {
        id: uuid(),
        yutoriScoutId: yutoriScout.id,
        query: `Monitor ${job.company} careers at ${careerPageUrl}`,
        targetCompanies: [job.company],
        interval: 1800,
        status: "active",
        strategy: "self_replicated",
        jobsFound: 0,
        createdAt: new Date().toISOString(),
      };

      addScout(newScout);
      companyScoutRegistry.set(companyKey, {
        scoutId: newScout.id,
        createdAt: Date.now(),
      });

      // Record in memory library
      await memoryLibrary.addSmartScouts(
        [{
          query: newScout.query,
          strategy: "self_replicated",
          tags: [job.company.toLowerCase(), "auto-spawned"],
          priority: 4,
        }],
        "auto"
      );

      spawned++;
    } catch (err) {
      console.warn(`[ScoutLifecycle] Replication failed for ${job.company}:`, err);
    }
  }

  return spawned;
}

// ─── Phase 5: Network Expansion ─────────────────────────────────────
// Use LLM + Tavily to discover entirely new companies not yet in our network.

async function expandNetwork(
  scouts: Scout[],
  profile: typeof store.profile
): Promise<number> {
  let expanded = 0;

  try {
    // Ask the LLM to suggest new companies we should monitor
    const suggestions = await scoutIntelligence.suggestNewSources(profile, scouts);

    for (const suggestion of suggestions.slice(0, LIFECYCLE.MAX_CHILDREN_PER_CYCLE)) {
      const companyKey = suggestion.company.toLowerCase();

      // Skip if already tracked
      if (companyScoutRegistry.has(companyKey)) continue;
      const alreadyScoured = scouts.some(
        (s) => s.status === "active" && s.query.toLowerCase().includes(companyKey)
      );
      if (alreadyScoured) continue;

      // Verify the career page URL via Tavily
      let verifiedUrl = suggestion.careerPageUrl;
      if (!verifiedUrl || verifiedUrl.includes("example.com")) {
        try {
          const searchResult = await tavilyService.search(
            `${suggestion.company} careers jobs hiring`,
            { maxResults: 3, searchDepth: "basic" }
          );
          const careerResult = searchResult.results.find(
            (r) => r.url.includes("career") || r.url.includes("jobs")
          );
          verifiedUrl = careerResult?.url || "";
        } catch {
          continue;
        }
      }

      if (!verifiedUrl) continue;

      try {
        console.log(`[ScoutLifecycle] 🌱 Expanding: new scout for ${suggestion.company} (${suggestion.reason})`);

        const yutoriScout = await yutoriService.createCompanyScout(
          suggestion.company,
          verifiedUrl,
          profile.targetRoles,
          3600 // longer interval for expansion scouts
        );

        const newScout: Scout = {
          id: uuid(),
          yutoriScoutId: yutoriScout.id,
          query: `Expansion: Monitor ${suggestion.company} — ${suggestion.reason}`,
          targetCompanies: [suggestion.company],
          interval: 3600,
          status: "active",
          strategy: "network_expansion",
          jobsFound: 0,
          createdAt: new Date().toISOString(),
        };

        addScout(newScout);
        companyScoutRegistry.set(companyKey, {
          scoutId: newScout.id,
          createdAt: Date.now(),
        });

        await memoryLibrary.addSmartScouts(
          [{
            query: newScout.query,
            strategy: "network_expansion",
            tags: [suggestion.company.toLowerCase(), "expansion"],
            priority: 3,
          }],
          "auto"
        );

        expanded++;
      } catch (err) {
        console.warn(`[ScoutLifecycle] Expansion failed for ${suggestion.company}:`, err);
      }
    }
  } catch (err) {
    console.warn("[ScoutLifecycle] Network expansion failed:", err);
  }

  return expanded;
}

// ─── Webhook Feedback Loop ──────────────────────────────────────────
// Called by the orchestrator after processing webhook jobs.
// This is how the system learns from each scout's results in real-time.

export async function feedbackFromWebhook(
  scoutId: string | undefined,
  processedJobs: Job[]
): Promise<void> {
  if (!scoutId) return;

  const scout = store.scouts.get(scoutId) as Scout | undefined;
  if (!scout) return;

  // Update job count
  scout.jobsFound += processedJobs.length;
  scout.lastRun = new Date().toISOString();
  store.scouts.set(scoutId, scout);

  // Extract entities from all processed JDs for trend analysis
  const allDescriptions = processedJobs
    .map((j) => j.description)
    .filter(Boolean)
    .join(" ");

  if (allDescriptions.length > 100) {
    try {
      const entities = await glinerService.extractEntities(allDescriptions, [
        "programming_language",
        "framework",
        "technology",
        "company",
      ]);

      // Update memory library with trending skills
      const library = await memoryLibrary.loadMemory();
      const newSkills = entities
        .filter((e) => e.score > 0.5)
        .map((e) => e.text);

      for (const skill of newSkills) {
        if (!library.insights.topSkillsInDemand.includes(skill)) {
          library.insights.topSkillsInDemand.push(skill);
        }
      }
      library.insights.topSkillsInDemand = library.insights.topSkillsInDemand.slice(0, 50);
      await memoryLibrary.saveMemory(library);
    } catch {
      // Non-critical — GLiNER might be down
    }
  }

  // Check for high-value finds that should trigger replication
  const highValue = processedJobs.filter(
    (j) => j.matchScore >= LIFECYCLE.HIGH_VALUE_THRESHOLD
  );

  if (highValue.length > 0) {
    console.log(
      `[ScoutLifecycle] 🎯 Scout ${scoutId} found ${highValue.length} high-value jobs — ` +
      `companies: ${highValue.map((j) => j.company).join(", ")}`
    );

    // Trigger immediate replication for high-value finds
    const activeCount = Array.from(store.scouts.values())
      .filter((s) => (s as Scout).status === "active").length;

    if (activeCount < LIFECYCLE.MAX_FLEET_SIZE) {
      await replicateFromDiscoveries(highValue, store.profile);
    }
  }
}

// ─── Types ───────────────────────────────────────────────────────────

export interface LifecycleReport {
  timestamp: string;
  evaluated: number;
  optimized: number;
  retired: number;
  spawned: number;
  expanded: number;
  errors: string[];
}
