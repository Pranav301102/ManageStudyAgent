// ─── Yutori Service — Job Discovery & Extraction ────────────────────
// Handles all Yutori API interactions: persistent scouting (webhook-driven)
// and on-demand browsing for full JD extraction.

import { config } from "../config";
import {
  YutoriScoutCreate,
  YutoriScoutResponse,
  YutoriScoutUpdate,
  YutoriScoutListResponse,
  YutoriBrowsingCreate,
  YutoriBrowsingResponse,
} from "../types";

const YUTORI_BASE = config.yutori.baseUrl;

async function yutoriRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${YUTORI_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.yutori.apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Yutori API error ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Scouting API — Continuous Job Monitoring ────────────────────────

export async function createScout(
  params: YutoriScoutCreate
): Promise<YutoriScoutResponse> {
  console.log(`[Yutori] Creating scout: "${params.query}"`);

  const response = await yutoriRequest("POST", "/scouting/tasks", {
    query: params.query,
    output_interval: params.output_interval,
    webhook_url: params.webhook_url,
    webhook_format: params.webhook_format || "scout",
    skip_email: params.skip_email ?? true,
    output_schema: params.output_schema || {
      type: "array",
      items: {
        type: "object",
        properties: {
          job_title: {
            description: "The job title or position name",
            type: "string",
          },
          company: {
            description: "The company offering the position",
            type: "string",
          },
          location: {
            description: "Job location (city, state, or remote)",
            type: "string",
          },
          url: {
            description: "Direct URL to the job listing",
            type: "string",
          },
          posted_date: {
            description: "When the job was posted",
            type: "string",
          },
          brief_description: {
            description: "A brief summary of the role",
            type: "string",
          },
        },
      },
    },
  });

  return response as YutoriScoutResponse;
}

/**
 * Create a scout specifically for a company careers page.
 * Used by the self-replication system when a new high-value company is found.
 */
export async function createCompanyScout(
  companyName: string,
  careerPageUrl: string,
  targetRoles: string[],
  interval: number = 1800
): Promise<YutoriScoutResponse> {
  const roleList = targetRoles.length > 0
    ? targetRoles.join(", ")
    : "software engineering, engineering, developer";

  const query = `Monitor ${companyName}'s careers page at ${careerPageUrl} ` +
    `for new ${roleList} positions. Extract job title, location, URL, posted date, and a brief description.`;

  return createScout({
    query,
    output_interval: interval,
    webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/yutori`,
    webhook_format: "scout",
    skip_email: true,
  });
}

/**
 * Update a scout's query in-place (for self-optimization).
 */
export async function updateScoutQuery(
  scoutId: string,
  newQuery: string
): Promise<void> {
  await yutoriRequest("PATCH", `/scouting/tasks/${scoutId}`, {
    query: newQuery,
  });
  console.log(`[Yutori] Scout ${scoutId} query updated`);
}

export async function getScoutDetail(
  scoutId: string
): Promise<YutoriScoutResponse> {
  const response = await yutoriRequest("GET", `/scouting/tasks/${scoutId}`);
  return response as YutoriScoutResponse;
}

export async function pauseScout(scoutId: string): Promise<void> {
  await yutoriRequest("PATCH", `/scouting/tasks/${scoutId}`, {
    paused: true,
  });
  console.log(`[Yutori] Scout ${scoutId} paused`);
}

export async function resumeScout(scoutId: string): Promise<void> {
  await yutoriRequest("PATCH", `/scouting/tasks/${scoutId}`, {
    paused: false,
  });
  console.log(`[Yutori] Scout ${scoutId} resumed`);
}

export async function deleteScout(scoutId: string): Promise<void> {
  await yutoriRequest("DELETE", `/scouting/tasks/${scoutId}`);
  console.log(`[Yutori] Scout ${scoutId} deleted`);
}

// ─── Scouting Updates — Pull-based result retrieval ──────────────────
// Alternative to webhooks when the app runs on localhost.
// Polls Yutori for accumulated scout results via GET /updates.

/**
 * List all scouts on the Yutori account.
 */
export async function listScouts(
  status?: "active" | "paused" | "done"
): Promise<YutoriScoutListResponse> {
  const params = status ? `?status=${status}` : "";
  const response = await yutoriRequest("GET", `/scouting/tasks${params}`);
  return response as YutoriScoutListResponse;
}

/**
 * Get updates (results) for a specific scout.
 * Each update contains a `structured_result` array of discovered jobs.
 * Returns updates newest first.
 */
export async function getScoutUpdates(
  scoutId: string,
  pageSize: number = 20
): Promise<{ updates: YutoriScoutUpdate[]; next_cursor: string | null }> {
  const response = await yutoriRequest(
    "GET",
    `/scouting/tasks/${scoutId}/updates?page_size=${pageSize}`
  );
  return response as { updates: YutoriScoutUpdate[]; next_cursor: string | null };
}

/**
 * Pull all new jobs from all active Yutori scouts.
 * Deduplicates by update ID to avoid reprocessing.
 * Returns an array of raw job objects ready for processJobDiscovery().
 */
export async function pullAllScoutResults(
  processedUpdateIds: Set<string>
): Promise<{
  jobs: Array<{
    job_title?: string;
    company?: string;
    location?: string;
    url?: string;
    posted_date?: string;
    brief_description?: string;
    _scoutId?: string;
    _updateId?: string;
  }>;
  newUpdateIds: string[];
}> {
  const allJobs: Array<{
    job_title?: string;
    company?: string;
    location?: string;
    url?: string;
    posted_date?: string;
    brief_description?: string;
    _scoutId?: string;
    _updateId?: string;
  }> = [];
  const newUpdateIds: string[] = [];

  try {
    const { scouts } = await listScouts("active");
    console.log(`[Yutori] Pulling results from ${scouts.length} active scouts...`);

    for (const scout of scouts) {
      try {
        const { updates } = await getScoutUpdates(scout.id, 10);

        for (const update of updates) {
          // Skip already-processed updates
          if (processedUpdateIds.has(update.id)) continue;

          const jobs = Array.isArray(update.structured_result)
            ? update.structured_result
            : [];

          for (const job of jobs) {
            allJobs.push({
              ...job as Record<string, string>,
              _scoutId: scout.id,
              _updateId: update.id,
            });
          }

          newUpdateIds.push(update.id);
          console.log(
            `[Yutori] Scout ${scout.id.slice(0, 8)}: update ${update.id.slice(0, 8)} → ${jobs.length} jobs`
          );
        }
      } catch (err) {
        console.warn(`[Yutori] Failed to pull updates for scout ${scout.id}:`, err);
      }
    }

    console.log(
      `[Yutori] Pull complete: ${allJobs.length} total jobs from ${newUpdateIds.length} new updates`
    );
  } catch (err) {
    console.error("[Yutori] Failed to list scouts:", err);
  }

  return { jobs: allJobs, newUpdateIds };
}

// ─── Browsing API — Full JD Extraction ───────────────────────────────

export async function createBrowsingTask(
  params: YutoriBrowsingCreate
): Promise<YutoriBrowsingResponse> {
  console.log(`[Yutori] Creating browsing task: "${params.task}" at ${params.start_url}`);

  const response = await yutoriRequest("POST", "/browsing/tasks", {
    task: params.task,
    start_url: params.start_url,
    max_steps: params.max_steps || 50,
    agent: params.agent || "navigator-n1-latest",
    output_schema: params.output_schema || {
      type: "object",
      properties: {
        job_title: { type: "string", description: "Full job title" },
        company: { type: "string", description: "Company name" },
        location: { type: "string", description: "Job location" },
        job_type: { type: "string", description: "Full-time, Part-time, Intern, Contract" },
        description: { type: "string", description: "Full job description text" },
        required_skills: {
          type: "array",
          items: { type: "string" },
          description: "List of required technical skills and qualifications",
        },
        preferred_skills: {
          type: "array",
          items: { type: "string" },
          description: "List of preferred/nice-to-have skills",
        },
        tech_stack: {
          type: "array",
          items: { type: "string" },
          description: "Technologies and tools mentioned",
        },
        salary_range: { type: "string", description: "Salary range if mentioned" },
        team_info: { type: "string", description: "Information about the team" },
        application_deadline: { type: "string", description: "Application deadline if mentioned" },
      },
    },
  });

  return response as YutoriBrowsingResponse;
}

export async function getBrowsingTaskStatus(
  taskId: string
): Promise<YutoriBrowsingResponse> {
  const response = await yutoriRequest("GET", `/browsing/tasks/${taskId}`);
  return response as YutoriBrowsingResponse;
}

// ─── Helper: Poll browsing task until completion ─────────────────────

export async function waitForBrowsingTask(
  taskId: string,
  maxWaitMs: number = 120000,
  pollIntervalMs: number = 5000
): Promise<YutoriBrowsingResponse> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const status = await getBrowsingTaskStatus(taskId);

    if (status.status === "succeeded" || status.status === "failed") {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Browsing task ${taskId} timed out after ${maxWaitMs}ms`);
}

// ─── Build scout query for target roles ──────────────────────────────

export function buildScoutQuery(
  targetRoles: string[],
  targetCompanies: string[]
): string {
  const roles = targetRoles.join(", ");
  const companies = targetCompanies.join(", ");

  return `Find new job postings for the following roles: ${roles}. ` +
    `Focus on these companies: ${companies}. ` +
    `Also include similar roles at other tech startups and companies. ` +
    `Include the job title, company name, location, job URL, posting date, and a brief description.`;
}
