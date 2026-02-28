// ─── Orchestrator — Autonomous Pipeline Controller ──────────────────
// This is the brain: it reacts to webhook events and chains all services
// together without manual intervention.

import { v4 as uuid } from "uuid";
import { store, addJob, addScout, updateSystemHealth } from "../store";
import { getDb } from "../db";
import * as yutoriService from "../services/yutori-service";
import * as tavilyService from "../services/tavily-service";
import * as llmService from "../services/llm-service";
import * as neo4jService from "../services/neo4j-service";
import * as glinerService from "../services/gliner-service";
import * as pioneerService from "../services/pioneer-service";
import * as resumeAlignment from "../services/resume-alignment";
import * as scoutIntelligence from "../services/scout-intelligence";
import * as memoryLibrary from "../services/memory-library";
import * as scoutLifecycle from "../services/scout-lifecycle";
import {
  Job,
  Scout,
  InterviewSession,
  RequiredSkill,
  SkillGap,
} from "../types";

// ─── Initialize: Autonomous scout generation ─────────────────────────

export async function initialize(): Promise<void> {
  console.log("[Orchestrator] Initializing autonomous pipeline...");

  const { profile } = store;

  // Sync profile to memory library
  await memoryLibrary.syncProfile(profile);

  // Test Neo4j connection
  let neo4jConnected = false;
  try {
    neo4jConnected = await neo4jService.testConnection();
    if (neo4jConnected) {
      await neo4jService.initializeSchema();
      await neo4jService.upsertUserSkills(profile.id, profile.skills);
    }
  } catch (err) {
    console.warn("[Orchestrator] Neo4j not available, using local fallback:", err);
  }

  updateSystemHealth({
    orchestratorRunning: true,
    neo4jConnected,
  });

  // ─── Autonomous Scout Generation ────────────────────────────────
  // Let the LLM decide what to monitor
  await autoGenerateScouts();

  // ─── Start Self-Replicating Scout Lifecycle ─────────────────────
  // Runs hourly: evaluates, optimizes, replicates, and expands scouts
  scoutLifecycle.startLifecycle();

  // ─── Sync & Poll Yutori for accumulated results ─────────────────
  // On startup, pull any results that accumulated while the app was offline
  try {
    const syncResult = await syncScoutsWithYutori();
    console.log(`[Orchestrator] Startup sync: ${syncResult.created} created, ${syncResult.orphansRemoved} orphans removed`);
    const pollResult = await pollAllScouts();
    console.log(`[Orchestrator] Startup poll: ${pollResult.newJobs} new jobs ingested`);
  } catch (err) {
    console.warn("[Orchestrator] Startup sync/poll failed (non-critical):", err);
  }

  // ─── Schedule periodic polling (every 30 min) ──────────────────
  setInterval(async () => {
    try {
      const result = await pollAllScouts();
      if (result.newJobs > 0) {
        console.log(`[Orchestrator] Periodic poll: ${result.newJobs} new jobs ingested`);
      }
    } catch (err) {
      console.warn("[Orchestrator] Periodic poll failed:", err);
    }
  }, 30 * 60 * 1000);

  console.log("[Orchestrator] Initialization complete — lifecycle running.");
}

/**
 * Auto-generate scouts using LLM intelligence.
 * Generates diverse queries, creates Yutori scouts, and saves to memory.
 */
export async function autoGenerateScouts(): Promise<Scout[]> {
  const { profile } = store;
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/yutori`;

  console.log("[Orchestrator] Auto-generating scouts via LLM...");

  // Step 1: LLM generates smart queries
  const smartQueries = await scoutIntelligence.generateSmartQueries(profile);
  console.log(`[Orchestrator] LLM generated ${smartQueries.length} scout queries`);

  // Step 2: Save to memory library
  const memoryEntries = await memoryLibrary.addSmartScouts(smartQueries, "auto");

  // Step 3: Create Yutori scouts for each query
  const createdScouts: Scout[] = [];

  for (const sq of smartQueries) {
    try {
      const scoutResponse = await yutoriService.createScout({
        query: sq.query,
        output_interval: 1800,
        webhook_url: webhookUrl,
        webhook_format: "scout",
        skip_email: true,
      });

      const scout: Scout = {
        id: memoryEntries.find((m) => m.query === sq.query)?.id || uuid(),
        yutoriScoutId: scoutResponse.id,
        query: sq.query,
        targetCompanies: [],
        interval: 1800,
        status: "active",
        jobsFound: 0,
        createdAt: new Date().toISOString(),
      };

      addScout(scout);
      createdScouts.push(scout);
      console.log(`[Orchestrator] Scout created: "${sq.strategy}" — ${sq.query.slice(0, 60)}...`);
    } catch (err) {
      console.warn(`[Orchestrator] Failed to create scout for query: ${sq.query.slice(0, 60)}`, err);

      // Still track it locally
      const scout: Scout = {
        id: uuid(),
        query: sq.query,
        targetCompanies: [],
        interval: 1800,
        status: "error",
        jobsFound: 0,
        createdAt: new Date().toISOString(),
      };
      addScout(scout);
      createdScouts.push(scout);
    }
  }

  updateSystemHealth({
    activeScouts: Array.from(store.scouts.values()).filter((s) => s.status === "active").length,
  });

  return createdScouts;
}

// ─── Sync: Link local DB scouts with live Yutori scouts ──────────────

/**
 * Sync local scout records with Yutori's actual scouts.
 * - Fetches active Yutori scouts
 * - Creates local records for any Yutori scouts missing locally
 * - Removes orphaned local scouts that have no Yutori backing
 */
export async function syncScoutsWithYutori(): Promise<{
  synced: number;
  created: number;
  orphansRemoved: number;
}> {
  console.log("[Orchestrator] Syncing scouts with Yutori...");

  let synced = 0;
  let created = 0;
  let orphansRemoved = 0;

  try {
    const { scouts: yutoriScouts } = await yutoriService.listScouts();

    // Build a set of all Yutori scout IDs
    const yutoriIds = new Set(yutoriScouts.map((s) => s.id));

    // Build a map of which Yutori IDs are already tracked locally
    const localScouts = Array.from(store.scouts.values()) as Scout[];
    const localYutoriIds = new Set(
      localScouts.filter((s) => s.yutoriScoutId).map((s) => s.yutoriScoutId!)
    );

    // Create local records for any Yutori scouts missing locally
    for (const ys of yutoriScouts) {
      if (!localYutoriIds.has(ys.id)) {
        const scout: Scout = {
          id: uuid(),
          yutoriScoutId: ys.id,
          query: ys.query,
          targetCompanies: [],
          interval: ys.output_interval || 1800,
          status: ys.status === "paused" ? "paused" : "active",
          jobsFound: 0,
          createdAt: ys.created_at,
        };
        addScout(scout);
        created++;
        console.log(`[Orchestrator] Created local scout for Yutori ${ys.id.slice(0, 8)}: "${ys.query.slice(0, 50)}..."`);
      } else {
        synced++;
      }
    }

    // Remove orphaned local scouts (no yutoriScoutId or yutoriScoutId not in Yutori)
    for (const local of localScouts) {
      if (!local.yutoriScoutId || !yutoriIds.has(local.yutoriScoutId)) {
        // Only remove if not a special scout (keep error-state ones as reference)
        if (local.status === "active" || local.status === "paused") {
          store.scouts.delete(local.id);
          orphansRemoved++;
        }
      }
    }

    updateSystemHealth({
      activeScouts: Array.from(store.scouts.values()).filter((s) => (s as Scout).status === "active").length,
    });

    console.log(
      `[Orchestrator] Sync complete: ${synced} synced, ${created} created, ${orphansRemoved} orphans removed`
    );
  } catch (err) {
    console.error("[Orchestrator] Scout sync failed:", err);
  }

  return { synced, created, orphansRemoved };
}

// ─── Poll: Pull results from Yutori scouts ───────────────────────────
// Since webhooks can't reach localhost, we pull results from Yutori's
// /updates endpoint and process them through the standard pipeline.

/**
 * Load processed update IDs from SQLite.
 */
function getProcessedUpdateIds(): Set<string> {
  try {
    const rows = getDb()
      .prepare("SELECT update_id FROM processed_updates")
      .all() as { update_id: string }[];
    return new Set(rows.map((r) => r.update_id));
  } catch {
    return new Set();
  }
}

/**
 * Mark update IDs as processed in SQLite.
 */
function markUpdatesProcessed(updateIds: string[], scoutId?: string, jobsCount?: number): void {
  const stmt = getDb().prepare(
    "INSERT OR IGNORE INTO processed_updates (update_id, scout_id, jobs_count) VALUES (?, ?, ?)"
  );
  for (const id of updateIds) {
    stmt.run(id, scoutId || null, jobsCount || 0);
  }
}

/**
 * Poll all Yutori scouts for new results, deduplicates by update ID,
 * and processes new jobs through the full pipeline.
 */
export async function pollAllScouts(): Promise<{
  newUpdates: number;
  newJobs: number;
  ingestedJobs: Job[];
}> {
  console.log("[Orchestrator] Polling Yutori scouts for new results...");

  const processedIds = getProcessedUpdateIds();
  const { jobs: rawJobs, newUpdateIds } = await yutoriService.pullAllScoutResults(processedIds);

  if (rawJobs.length === 0) {
    console.log("[Orchestrator] No new jobs from Yutori scouts");
    return { newUpdates: 0, newJobs: 0, ingestedJobs: [] };
  }

  // Deduplicate by URL against existing jobs AND within the batch
  const existingUrls = new Set<string>();
  const allJobs = Array.from(store.jobs.values()) as Job[];
  for (const job of allJobs) {
    if (job.url) existingUrls.add(job.url);
  }
  // Also deduplicate by title+company for jobs without URLs
  const existingKeys = new Set<string>();
  for (const job of allJobs) {
    existingKeys.add(`${job.title}||${job.company}`.toLowerCase());
  }

  const uniqueJobs = rawJobs.filter((j) => {
    // URL-based dedup
    if (j.url) {
      if (existingUrls.has(j.url)) return false;
      existingUrls.add(j.url);
    }
    // Title+Company dedup
    const key = `${j.job_title || ""}||${j.company || ""}`.toLowerCase();
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  console.log(`[Orchestrator] ${rawJobs.length} raw → ${uniqueJobs.length} unique new jobs (${rawJobs.length - uniqueJobs.length} duplicates filtered)`);

  // ── Lightweight Bulk Ingest ─────────────────────────────────────────
  // Save all job metadata immediately — no heavy pipeline processing.
  // Jobs are saved as "discovered" so they show up in the UI right away.
  // The full enrichment pipeline (browsing, NER, gaps, interview prep)
  // can run later on individual jobs via processJobDiscovery().

  const ingestedJobs: Job[] = [];

  // Group by Yutori scout ID → local scout ID mapping
  const localScouts = Array.from(store.scouts.values()) as Scout[];
  const yutoriToLocal = new Map<string, Scout>();
  for (const s of localScouts) {
    if (s.yutoriScoutId) yutoriToLocal.set(s.yutoriScoutId, s);
  }

  for (const raw of uniqueJobs) {
    const jobId = uuid();
    const localScout = raw._scoutId ? yutoriToLocal.get(raw._scoutId) : undefined;

    const job: Job = {
      id: jobId,
      title: raw.job_title || "Unknown Role",
      company: raw.company || "Unknown Company",
      location: raw.location || "Unknown",
      url: raw.url || "",
      description: raw.brief_description || "",
      requiredSkills: [],
      preferredSkills: [],
      techStack: [],
      postedDate: raw.posted_date || new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
      matchScore: 0,
      skillGaps: [],
      interviewReady: false,
      status: "discovered",
      scoutId: localScout?.id || raw._scoutId,
    };

    addJob(job);
    ingestedJobs.push(job);

    // Update scout jobsFound count
    if (localScout) {
      localScout.jobsFound = (localScout.jobsFound || 0) + 1;
      localScout.lastRun = new Date().toISOString();
      store.scouts.set(localScout.id, localScout);
    }
  }

  // Mark all updates as processed so they're not pulled again
  markUpdatesProcessed(newUpdateIds);

  updateSystemHealth({
    totalJobsFound: store.jobs.size,
    lastScanTime: new Date().toISOString(),
  });

  console.log(`[Orchestrator] Poll complete: ${ingestedJobs.length} new jobs ingested from ${newUpdateIds.length} updates`);

  return {
    newUpdates: newUpdateIds.length,
    newJobs: ingestedJobs.length,
    ingestedJobs,
  };
}

// ─── Enrich: Run full pipeline on a batch of discovered jobs ─────────
// Processes up to `limit` un-enriched jobs through the heavy pipeline
// (browsing, entity extraction, company research, gap analysis, interview prep)

export async function enrichDiscoveredJobs(limit: number = 5): Promise<{
  enriched: number;
  errors: number;
}> {
  const allJobs = Array.from(store.jobs.values()) as Job[];
  const discovered = allJobs.filter((j) => j.status === "discovered" && j.url);
  const batch = discovered.slice(0, limit);

  if (batch.length === 0) {
    console.log("[Orchestrator] No discovered jobs to enrich");
    return { enriched: 0, errors: 0 };
  }

  console.log(`[Orchestrator] Enriching ${batch.length} of ${discovered.length} discovered jobs...`);

  let enriched = 0;
  let errors = 0;

  for (const job of batch) {
    try {
      // Step 1: Browse for full JD
      job.status = "researching";
      if (job.url) {
        try {
          const browsingResult = await yutoriService.createBrowsingTask({
            task: `Extract the full job description, required skills, preferred skills, tech stack, salary range, and team information from this job listing page.`,
            start_url: job.url,
          });
          const completed = await yutoriService.waitForBrowsingTask(
            browsingResult.task_id,
            90000
          );
          if (completed.status === "succeeded" && completed.structured_result) {
            const result = completed.structured_result as Record<string, unknown>;
            job.description = (result.description as string) || job.description;
            job.techStack = (result.tech_stack as string[]) || [];
            job.requiredSkills = ((result.required_skills as string[]) || []).map(
              (s) => ({ name: s, importance: "required" as const })
            );
            job.preferredSkills = ((result.preferred_skills as string[]) || []).map(
              (s) => ({ name: s, importance: "preferred" as const })
            );
            if (result.salary_range) {
              job.salaryRange = result.salary_range as string;
            }
          }
        } catch (err) {
          console.warn(`[Orchestrator] Browsing failed for ${job.url}:`, err);
        }
      }

      // Step 2: Entity extraction via Pioneer GLiNER-2
      if (job.description && job.requiredSkills.length === 0) {
        try {
          const jdSkills = await glinerService.extractJDSkillsStructured(job.description);
          if (jdSkills.required.length > 0 || jdSkills.preferred.length > 0) {
            job.requiredSkills = jdSkills.required.map((e) => ({
              name: e.text, importance: "required" as const,
            }));
            job.preferredSkills = jdSkills.preferred.map((e) => ({
              name: e.text, importance: "preferred" as const,
            }));
            const pioneerTech = jdSkills.allTech
              .filter((e) => ["technology", "framework", "programming_language", "database", "cloud_service", "tool", "library", "platform"].includes(e.label))
              .map((e) => e.text);
            job.techStack = [...new Set([...job.techStack, ...pioneerTech])];
          }
        } catch (err) {
          console.warn("[Orchestrator] GLiNER extraction failed:", err);
        }
      }

      // Step 3: Match scoring + gaps
      const [skillGaps, matchScore] = await Promise.all([
        computeGaps(job),
        computeMatch(job),
      ]);
      job.skillGaps = skillGaps;
      job.matchScore = matchScore;
      job.status = "analyzed";

      store.jobs.set(job.id, job);
      enriched++;
      console.log(`[Orchestrator] Enriched: ${job.title} @ ${job.company} (match: ${matchScore}%)`);
    } catch (err) {
      errors++;
      console.error(`[Orchestrator] Failed to enrich ${job.title}:`, err);
      job.status = "discovered"; // reset so it can be retried
      store.jobs.set(job.id, job);
    }
  }

  return { enriched, errors };
}

// ─── Process Webhook: Full autonomous pipeline ───────────────────────
// This is triggered when Yutori scout finds a match. It runs the entire
// pipeline: extract JD → research company → compute gaps → prep interview

export async function processJobDiscovery(
  rawJobs: Array<{
    job_title?: string;
    company?: string;
    location?: string;
    url?: string;
    posted_date?: string;
    brief_description?: string;
  }>,
  sourceScoutId?: string
): Promise<Job[]> {
  console.log(`[Orchestrator] Processing ${rawJobs.length} discovered jobs (scout: ${sourceScoutId || "manual"})...`);

  const processedJobs: Job[] = [];

  for (const raw of rawJobs) {
    try {
      const jobId = uuid();

      // Step 1: Create initial job entry
      const job: Job = {
        id: jobId,
        title: raw.job_title || "Unknown Role",
        company: raw.company || "Unknown Company",
        location: raw.location || "Unknown",
        url: raw.url || "",
        description: raw.brief_description || "",
        requiredSkills: [],
        preferredSkills: [],
        techStack: [],
        postedDate: raw.posted_date || new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        matchScore: 0,
        skillGaps: [],
        interviewReady: false,
        status: "discovered",
        scoutId: sourceScoutId,
      };

      addJob(job);
      console.log(`[Orchestrator] Job discovered: ${job.title} at ${job.company}`);

      // Step 2: Extract full JD via Yutori Browsing (if URL available)
      job.status = "researching";
      if (job.url) {
        try {
          const browsingResult = await yutoriService.createBrowsingTask({
            task: `Extract the full job description, required skills, preferred skills, tech stack, salary range, and team information from this job listing page.`,
            start_url: job.url,
          });

          // Poll for completion
          const completed = await yutoriService.waitForBrowsingTask(
            browsingResult.task_id,
            90000 // 90 second timeout
          );

          if (completed.status === "succeeded" && completed.structured_result) {
            const result = completed.structured_result as Record<string, unknown>;
            job.description = (result.description as string) || job.description;
            job.techStack = (result.tech_stack as string[]) || [];
            job.requiredSkills = ((result.required_skills as string[]) || []).map(
              (s) => ({ name: s, importance: "required" as const })
            );
            job.preferredSkills = ((result.preferred_skills as string[]) || []).map(
              (s) => ({ name: s, importance: "preferred" as const })
            );
            if (result.salary_range) {
              job.salaryRange = result.salary_range as string;
            }
          }
        } catch (err) {
          console.warn(`[Orchestrator] Browsing failed for ${job.url}:`, err);
        }
      }

      // ── Pioneer Cloud-First Skill Extraction ──────────────────────
      // Use Pioneer GLiNER-2 cloud as PRIMARY extractor (always available)
      // Falls back to local GLiNER, then LLM
      if (job.description) {
        try {
          console.log(`[Orchestrator] Running Pioneer cloud NER on JD for ${job.title}`);
          // Pioneer cloud: structured JD extraction with multi-pass for max F1
          const jdSkills = await glinerService.extractJDSkillsStructured(job.description);

          if (jdSkills.required.length > 0 || jdSkills.preferred.length > 0) {
            if (job.requiredSkills.length === 0) {
              job.requiredSkills = jdSkills.required.map((e) => ({
                name: e.text,
                importance: "required" as const,
              }));
            }
            if (job.preferredSkills.length === 0) {
              job.preferredSkills = jdSkills.preferred.map((e) => ({
                name: e.text,
                importance: "preferred" as const,
              }));
            }
            // Merge Pioneer-extracted tech entities into techStack
            const pioneerTech = jdSkills.allTech
              .filter((e) => ["technology", "framework", "programming_language", "database", "cloud_service", "tool", "library", "platform"].includes(e.label))
              .map((e) => e.text);
            job.techStack = [...new Set([...job.techStack, ...pioneerTech])];
          }
        } catch (err) {
          console.warn("[Orchestrator] Pioneer/GLiNER JD extraction failed, trying LLM:", err);
        }
      }

      // Fallback: if GLiNER didn't produce skills, use LLM extraction
      if (job.requiredSkills.length === 0 && job.description) {
        try {
          const extracted = await llmService.extractSkillsFromJD(job.description);
          job.requiredSkills = extracted.required.map((s) => ({
            name: s,
            importance: "required" as const,
          }));
          job.preferredSkills = extracted.preferred.map((s) => ({
            name: s,
            importance: "preferred" as const,
          }));
          job.techStack = extracted.techStack;
        } catch (err) {
          console.warn("[Orchestrator] LLM skill extraction failed:", err);
        }
      }

      // ── Smart Research: Tavily + GLiNER context ─────────────────────
      // Pass the JD's tech stack to Tavily so it builds targeted queries
      const [companyIntel, skillGaps, matchScore] = await Promise.all([
        tavilyService.researchCompany(job.company, {
          techStack: job.techStack,
          requiredSkills: job.requiredSkills.map((s) => s.name),
        }).catch((err) => {
          console.warn(`[Orchestrator] Tavily+GLiNER research failed for ${job.company}:`, err);
          return undefined;
        }),
        computeGaps(job),
        computeMatch(job),
      ]);

      // Merge company tech stack back into job if discovery found more
      if (companyIntel?.techStack.length) {
        job.techStack = [...new Set([...job.techStack, ...companyIntel.techStack])];
      }

      job.companyIntel = companyIntel;
      job.skillGaps = skillGaps;
      job.matchScore = matchScore;
      job.status = "analyzed";

      // Step 4: Generate interview questions
      try {
        const questions = await llmService.generateInterviewQuestions(
          job,
          companyIntel,
          skillGaps
        );

        const interview: InterviewSession = {
          id: uuid(),
          jobId: job.id,
          job,
          questions,
          currentQuestionIndex: 0,
          status: "preparing",
          startedAt: new Date().toISOString(),
        };

        store.interviews.set(interview.id, interview);
        job.interviewReady = true;
        job.status = "interview-ready";

        updateSystemHealth({
          interviewsReady: Array.from(store.interviews.values()).filter(
            (i) => i.status === "preparing" || i.status === "active"
          ).length,
        });

        console.log(`[Orchestrator] Interview ready for ${job.title} at ${job.company}`);
      } catch (err) {
        console.warn("[Orchestrator] Interview prep failed:", err);
      }

      // Update store
      store.jobs.set(job.id, job);
      updateSystemHealth({
        totalJobsFound: store.jobs.size,
        skillGapsIdentified: job.skillGaps.length,
        lastScanTime: new Date().toISOString(),
      });

      // Record to memory library for persistence & sharing
      await memoryLibrary.recordDiscovery(job);

      // ── Auto Resume Alignment (background) ─────────────────────────
      // When a job is discovered, automatically align the user's resume
      // using Pioneer cloud extraction + Gemini rewrite
      if (store.profile.resumeSummary && job.description) {
        resumeAlignment.alignResume(
          store.profile.resumeSummary,
          job.description,
          job
        ).then((alignment) => {
          console.log(
            `[Orchestrator] Auto-aligned resume for ${job.title}: ` +
            `ATS=${alignment.atsScore}, Human=${alignment.humanScore}`
          );
        }).catch((err) => {
          console.warn(`[Orchestrator] Auto resume alignment failed for ${job.title}:`, err);
        });
      }

      processedJobs.push(job);
    } catch (err) {
      console.error("[Orchestrator] Failed to process job:", err);
    }
  }

  return processedJobs;
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function computeGaps(job: Job): Promise<SkillGap[]> {
  const { profile } = store;

  if (store.systemHealth.neo4jConnected) {
    try {
      await neo4jService.upsertJobSkills(
        job.id,
        job.company,
        job.title,
        job.requiredSkills,
        job.preferredSkills
      );
      return await neo4jService.computeSkillGaps(profile.id, job.id);
    } catch (err) {
      console.warn("[Orchestrator] Neo4j gap analysis failed, using local:", err);
    }
  }

  return neo4jService.computeSkillGapsLocal(
    profile.skills,
    job.requiredSkills,
    job.preferredSkills
  );
}

async function computeMatch(job: Job): Promise<number> {
  const { profile } = store;

  if (store.systemHealth.neo4jConnected) {
    try {
      return await neo4jService.computeMatchScore(profile.id, job.id);
    } catch {
      // fallback
    }
  }

  return neo4jService.computeMatchScoreLocal(
    profile.skills,
    job.requiredSkills
  );
}

// ─── Manual trigger: add a job URL and process it ────────────────────

export async function processManualJob(
  url: string,
  title: string,
  company: string
): Promise<Job> {
  const jobs = await processJobDiscovery([
    {
      job_title: title,
      company,
      url,
      location: "Unknown",
      posted_date: new Date().toISOString(),
      brief_description: "",
    },
  ]);

  if (jobs.length === 0) {
    throw new Error("Failed to process job");
  }

  return jobs[0];
}
