// ─── Memory Library — JSON Persistence for Scout Configs & Sources ───
// Manages a shareable JSON memory file that persists scout configurations,
// discovered company sources, performance metrics, and trend insights.
// Can be exported/imported for sharing with other users.

import { promises as fs } from "fs";
import path from "path";
import { Scout, Job, UserProfile } from "../types";
import { SmartQuery, ScoutPerformance } from "./scout-intelligence";

// ─── Types ───────────────────────────────────────────────────────────

export interface ScoutMemoryEntry {
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

export interface DiscoveredSource {
    company: string;
    careerPageUrl?: string;
    lastChecked?: string;
    jobsFound: number;
    relevanceScore: number;
    addedAt: string;
}

export interface LibraryInsights {
    topSkillsInDemand: string[];
    emergingCompanies: string[];
    queryPatterns: string[];
    totalJobsDiscovered: number;
    avgRelevanceScore: number;
}

export interface ScoutMemoryLibrary {
    version: string;
    createdAt: string;
    updatedAt: string;
    profile: {
        roles: string[];
        skills: string[];
    };
    scouts: ScoutMemoryEntry[];
    discoveredSources: DiscoveredSource[];
    insights: LibraryInsights;
}

// ─── File Path ───────────────────────────────────────────────────────

const LIBRARY_DIR = path.join(process.cwd(), "public", "library");
const LIBRARY_FILE = path.join(LIBRARY_DIR, "scout-memory.json");

// ─── Default Library ─────────────────────────────────────────────────

function createDefaultLibrary(): ScoutMemoryLibrary {
    return {
        version: "1.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profile: { roles: [], skills: [] },
        scouts: [],
        discoveredSources: [],
        insights: {
            topSkillsInDemand: [],
            emergingCompanies: [],
            queryPatterns: [],
            totalJobsDiscovered: 0,
            avgRelevanceScore: 0,
        },
    };
}

// ─── Core CRUD ───────────────────────────────────────────────────────

/**
 * Load the memory library from disk. Creates a default one if missing.
 */
export async function loadMemory(): Promise<ScoutMemoryLibrary> {
    try {
        const data = await fs.readFile(LIBRARY_FILE, "utf-8");
        return JSON.parse(data) as ScoutMemoryLibrary;
    } catch {
        // File doesn't exist yet — create default
        const lib = createDefaultLibrary();
        await saveMemory(lib);
        return lib;
    }
}

/**
 * Save the memory library to disk.
 */
export async function saveMemory(library: ScoutMemoryLibrary): Promise<void> {
    library.updatedAt = new Date().toISOString();

    try {
        await fs.mkdir(LIBRARY_DIR, { recursive: true });
        await fs.writeFile(LIBRARY_FILE, JSON.stringify(library, null, 2), "utf-8");
    } catch (err) {
        console.error("[MemoryLibrary] Failed to save:", err);
    }
}

// ─── Scout Management ────────────────────────────────────────────────

/**
 * Add auto-generated scouts from SmartQuery results.
 */
export async function addSmartScouts(
    queries: SmartQuery[],
    source: "auto" | "manual" = "auto"
): Promise<ScoutMemoryEntry[]> {
    const library = await loadMemory();
    const newEntries: ScoutMemoryEntry[] = [];

    for (const q of queries) {
        // Deduplicate by query similarity
        const exists = library.scouts.some(
            (s) => s.query.toLowerCase() === q.query.toLowerCase()
        );
        if (exists) continue;

        const entry: ScoutMemoryEntry = {
            id: `scout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            query: q.query,
            strategy: q.strategy,
            source,
            performance: { relevanceScore: 0, jobsFound: 0 },
            tags: q.tags,
            priority: q.priority,
            createdAt: new Date().toISOString(),
            status: "active",
        };

        library.scouts.push(entry);
        newEntries.push(entry);
    }

    await saveMemory(library);
    return newEntries;
}

/**
 * Update scout performance metrics after evaluation.
 */
export async function updateScoutPerformance(
    perf: ScoutPerformance
): Promise<void> {
    const library = await loadMemory();

    const scout = library.scouts.find((s) => s.id === perf.scoutId);
    if (scout) {
        scout.performance.relevanceScore = perf.relevanceScore;
        scout.performance.jobsFound += perf.totalJobs;
        scout.performance.lastEvaluated = new Date().toISOString();
        scout.lastActive = new Date().toISOString();

        if (perf.recommendation === "retire") {
            scout.status = "retired";
        }
    }

    // Update aggregate insights
    const activeScouts = library.scouts.filter((s) => s.status === "active");
    if (activeScouts.length > 0) {
        library.insights.avgRelevanceScore =
            activeScouts.reduce((sum, s) => sum + s.performance.relevanceScore, 0) /
            activeScouts.length;
    }

    await saveMemory(library);
}

/**
 * Record a discovered job — updates sources and insights.
 */
export async function recordDiscovery(job: Job): Promise<void> {
    const library = await loadMemory();

    // Update or add company source
    const existing = library.discoveredSources.find(
        (s) => s.company.toLowerCase() === job.company.toLowerCase()
    );

    if (existing) {
        existing.jobsFound++;
        existing.lastChecked = new Date().toISOString();
        existing.relevanceScore = Math.max(
            existing.relevanceScore,
            job.matchScore / 100
        );
    } else {
        library.discoveredSources.push({
            company: job.company,
            careerPageUrl: job.url ? new URL(job.url).origin : undefined,
            lastChecked: new Date().toISOString(),
            jobsFound: 1,
            relevanceScore: job.matchScore / 100,
            addedAt: new Date().toISOString(),
        });
    }

    // Update skill demand insights
    const allSkills = [
        ...job.requiredSkills.map((s) => s.name),
        ...job.techStack,
    ];
    for (const skill of allSkills) {
        if (!library.insights.topSkillsInDemand.includes(skill)) {
            library.insights.topSkillsInDemand.push(skill);
        }
    }
    // Keep only top 30 most common
    library.insights.topSkillsInDemand = library.insights.topSkillsInDemand.slice(0, 30);

    library.insights.totalJobsDiscovered++;

    await saveMemory(library);
}

/**
 * Sync profile info into the library (for export context).
 */
export async function syncProfile(profile: UserProfile): Promise<void> {
    const library = await loadMemory();
    library.profile = {
        roles: profile.targetRoles,
        skills: profile.skills.map((s) => s.name),
    };
    await saveMemory(library);
}

// ─── Export / Import ─────────────────────────────────────────────────

/**
 * Export the full library as a JSON string (for sharing).
 */
export async function exportLibrary(): Promise<string> {
    const library = await loadMemory();
    return JSON.stringify(library, null, 2);
}

/**
 * Import a library from another user. Merges scouts and sources
 * without duplicating. Imported scouts are tagged as "imported".
 */
export async function importLibrary(
    importedJson: string
): Promise<{ scoutsAdded: number; sourcesAdded: number }> {
    const imported = JSON.parse(importedJson) as ScoutMemoryLibrary;
    const library = await loadMemory();

    let scoutsAdded = 0;
    let sourcesAdded = 0;

    // Merge scouts
    for (const scout of imported.scouts) {
        const exists = library.scouts.some(
            (s) => s.query.toLowerCase() === scout.query.toLowerCase()
        );
        if (!exists) {
            library.scouts.push({
                ...scout,
                id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                source: "imported",
                createdAt: new Date().toISOString(),
                status: "active",
            });
            scoutsAdded++;
        }
    }

    // Merge discovered sources
    for (const source of imported.discoveredSources) {
        const exists = library.discoveredSources.some(
            (s) => s.company.toLowerCase() === source.company.toLowerCase()
        );
        if (!exists) {
            library.discoveredSources.push({
                ...source,
                addedAt: new Date().toISOString(),
            });
            sourcesAdded++;
        }
    }

    // Merge skill insights (deduplicated)
    const allSkills = new Set([
        ...library.insights.topSkillsInDemand,
        ...imported.insights.topSkillsInDemand,
    ]);
    library.insights.topSkillsInDemand = Array.from(allSkills).slice(0, 30);

    const allCompanies = new Set([
        ...library.insights.emergingCompanies,
        ...imported.insights.emergingCompanies,
    ]);
    library.insights.emergingCompanies = Array.from(allCompanies);

    await saveMemory(library);
    return { scoutsAdded, sourcesAdded };
}
