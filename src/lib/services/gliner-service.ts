// ─── GLiNER Service — Cloud-First Entity Extraction ──────────────────
// Pioneer GLiNER-2 cloud API is the PRIMARY extraction engine.
// Local GLiNER microservice is the FALLBACK when Pioneer is unreachable.
// Regex-based extraction is the LAST RESORT for offline mode.
//
// Multi-pass extraction pipeline for higher F1:
//   Pass 1: Core tech skills (languages, frameworks, databases)
//   Pass 2: CS concepts (algorithms, data structures, patterns)
//   → Deduplicate + merge → higher recall without precision loss
//
// Cloud endpoint: https://api.pioneer.ai/inference
// Local fallback: http://localhost:8080 (services/gliner/)

import { config } from "../config";
import { ExtractedEntity } from "../types";
import * as pioneerService from "./pioneer-service";

// ─── Entity Label Schemas ───────────────────────────────────────────

const TECH_SKILL_LABELS = [
    "programming_language", "framework", "library",
    "database", "cloud_service", "tool", "platform",
];

const CS_CONCEPT_LABELS = [
    "algorithm", "data_structure", "design_pattern",
    "architecture_pattern", "protocol", "methodology",
];

const INTERVIEW_ENTITY_LABELS = [
    "programming_language", "framework", "algorithm",
    "data_structure", "design_pattern", "technology",
    "database", "cloud_service", "concept", "methodology",
];

const JD_ENTITY_LABELS = [
    "programming_language", "framework", "technology",
    "soft_skill", "certification", "tool",
    "cloud_service", "database", "methodology",
    "domain_knowledge", "experience_level",
];

// ─── Local GLiNER Health Tracking ───────────────────────────────────

let localHealthy: boolean | null = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60_000;

async function isLocalAvailable(): Promise<boolean> {
    if (localHealthy !== null && Date.now() - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
        return localHealthy;
    }
    try {
        const res = await fetch(`${config.gliner.baseUrl}/health`, {
            signal: AbortSignal.timeout(2000),
        });
        const data = await res.json();
        localHealthy = data.ready === true;
    } catch {
        localHealthy = false;
    }
    lastHealthCheck = Date.now();
    return localHealthy ?? false;
}

async function localExtract(
    text: string, labels: string[], threshold: number
): Promise<ExtractedEntity[]> {
    const res = await fetch(`${config.gliner.baseUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, labels, threshold }),
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`GLiNER local error: ${res.status}`);
    const data = await res.json();
    return (data.entities || []).map(
        (e: { text: string; label: string; score: number }) => ({
            text: e.text, label: e.label, score: e.score,
        })
    );
}

// ─── Deduplication ──────────────────────────────────────────────────

function deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const seen = new Map<string, ExtractedEntity>();
    for (const entity of entities) {
        const key = `${entity.text.toLowerCase()}::${entity.label}`;
        const existing = seen.get(key);
        if (!existing || entity.score > existing.score) {
            seen.set(key, entity);
        }
    }
    return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

// ─── Core: Cloud-First Extraction ───────────────────────────────────

/**
 * Extract entities: Pioneer cloud → local GLiNER → regex fallback.
 */
export async function extractEntities(
    text: string,
    labels: string[] = INTERVIEW_ENTITY_LABELS,
    threshold: number = 0.4
): Promise<ExtractedEntity[]> {
    // Try 1: Pioneer cloud (PRIMARY)
    if (config.pioneer.apiKey) {
        try {
            const entities = await pioneerService.inference(text, labels, { threshold });
            console.log(`[GLiNER] Pioneer cloud: ${entities.length} entities`);
            return deduplicateEntities(entities);
        } catch (err) {
            console.warn("[GLiNER] Pioneer cloud failed:", err);
        }
    }

    // Try 2: Local GLiNER microservice (FALLBACK)
    if (await isLocalAvailable()) {
        try {
            const entities = await localExtract(text, labels, threshold);
            console.log(`[GLiNER] Local fallback: ${entities.length} entities`);
            return deduplicateEntities(entities);
        } catch (err) {
            console.warn("[GLiNER] Local extraction failed:", err);
            localHealthy = false;
        }
    }

    // Try 3: Regex (LAST RESORT)
    console.warn("[GLiNER] All backends down — regex fallback");
    return fallbackExtract(text);
}

/**
 * Multi-pass extraction for maximum F1.
 */
export async function extractEntitiesMultiPass(
    text: string,
    options?: { threshold?: number }
): Promise<ExtractedEntity[]> {
    const threshold = options?.threshold ?? 0.35;

    // Pioneer cloud multi-pass (PRIMARY)
    if (config.pioneer.apiKey) {
        try {
            const entities = await pioneerService.multiPassInference(text, [
                { schema: TECH_SKILL_LABELS, threshold },
                { schema: CS_CONCEPT_LABELS, threshold },
            ]);
            console.log(`[GLiNER] Multi-pass cloud: ${entities.length} entities`);
            return entities;
        } catch {
            console.warn("[GLiNER] Pioneer multi-pass failed");
        }
    }

    // Local multi-pass (FALLBACK)
    if (await isLocalAvailable()) {
        try {
            const [tech, concepts] = await Promise.all([
                localExtract(text, TECH_SKILL_LABELS, threshold).catch(() => []),
                localExtract(text, CS_CONCEPT_LABELS, threshold).catch(() => []),
            ]);
            return deduplicateEntities([...tech, ...concepts]);
        } catch {
            // fall through
        }
    }

    return fallbackExtract(text);
}

/**
 * Extract from code content.
 */
export async function extractFromCode(
    code: string,
    language: string
): Promise<ExtractedEntity[]> {
    const codeContext = `Programming language: ${language}. Code content: ${code}`;
    return extractEntities(codeContext, [
        "programming_language", "framework", "algorithm",
        "data_structure", "design_pattern", "library",
    ]);
}

/**
 * Extract skills from a Job Description.
 */
export async function extractJDSkills(
    jobDescription: string
): Promise<ExtractedEntity[]> {
    // Pioneer multi-pass for best JD F1
    if (config.pioneer.apiKey) {
        try {
            const result = await pioneerService.extractJDSkillsCloud(jobDescription);
            if (result.allTech.length > 0) {
                console.log(`[GLiNER] JD via Pioneer: ${result.allTech.length} entities`);
                return deduplicateEntities(result.allTech);
            }
        } catch {
            console.warn("[GLiNER] Pioneer JD extraction failed");
        }
    }
    return extractEntities(jobDescription, JD_ENTITY_LABELS, 0.3);
}

/**
 * Extract skills with required/preferred classification.
 */
export async function extractJDSkillsStructured(
    jobDescription: string
): Promise<{
    required: ExtractedEntity[];
    preferred: ExtractedEntity[];
    allTech: ExtractedEntity[];
}> {
    // Pioneer structured extraction (PRIMARY)
    if (config.pioneer.apiKey) {
        try {
            return await pioneerService.extractJDSkillsCloud(jobDescription);
        } catch {
            console.warn("[GLiNER] Pioneer structured JD failed");
        }
    }

    // Fallback: extract all then classify by context
    const allEntities = await extractEntities(jobDescription, JD_ENTITY_LABELS, 0.3);
    const textLower = jobDescription.toLowerCase();
    const required: ExtractedEntity[] = [];
    const preferred: ExtractedEntity[] = [];

    for (const entity of allEntities) {
        const pos = textLower.indexOf(entity.text.toLowerCase());
        if (pos === -1) { required.push(entity); continue; }
        const ctx = textLower.slice(Math.max(0, pos - 200), pos + 200);
        const isPref = ctx.includes("preferred") || ctx.includes("nice to have") ||
            ctx.includes("bonus") || ctx.includes("plus");
        (isPref ? preferred : required).push(entity);
    }

    return { required, preferred, allTech: allEntities };
}

/**
 * Batch extraction across multiple texts.
 */
export async function extractEntitiesBatch(
    texts: string[],
    labels: string[] = INTERVIEW_ENTITY_LABELS,
    threshold: number = 0.4
): Promise<ExtractedEntity[][]> {
    // Pioneer parallel calls (PRIMARY)
    if (config.pioneer.apiKey) {
        try {
            return await Promise.all(
                texts.map((text) =>
                    pioneerService.inference(text, labels, { threshold }).catch(() => [])
                )
            );
        } catch { /* fall through */ }
    }

    // Local batch endpoint (FALLBACK)
    if (await isLocalAvailable()) {
        try {
            const res = await fetch(`${config.gliner.baseUrl}/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texts, labels, threshold }),
                signal: AbortSignal.timeout(30000),
            });
            if (res.ok) {
                const data = await res.json();
                return (data.results || []).map(
                    (r: { entities: Array<{ text: string; label: string; score: number }> }) =>
                        r.entities.map((e) => ({ text: e.text, label: e.label, score: e.score }))
                );
            }
        } catch { /* fall through */ }
    }

    return texts.map((text) => fallbackExtract(text));
}

/**
 * Extract entities from interview transcript with per-question attribution.
 */
export async function extractFromTranscript(
    transcript: string
): Promise<{
    entities: ExtractedEntity[];
    perQuestion: Array<{ question: string; entities: ExtractedEntity[] }>;
}> {
    const qaParts = transcript.split(/(?=Q\d+:|Question \d+:)/i).filter((p) => p.trim());
    if (qaParts.length <= 1) {
        const entities = await extractEntitiesMultiPass(transcript);
        return { entities, perQuestion: [{ question: transcript.slice(0, 100), entities }] };
    }
    const batchResults = await extractEntitiesBatch(qaParts, INTERVIEW_ENTITY_LABELS, 0.35);
    const perQuestion = qaParts.map((part, i) => ({
        question: part.slice(0, 100).trim(),
        entities: batchResults[i] || [],
    }));
    return { entities: deduplicateEntities(batchResults.flat()), perQuestion };
}

// ─── Health Check ───────────────────────────────────────────────────

export async function checkGlinerHealth(): Promise<{
    status: string;
    model: string;
    ready: boolean;
    backend: "pioneer" | "local" | "fallback";
    pioneerAvailable: boolean;
}> {
    // Check Pioneer (PRIMARY)
    const pioneerHealth = await pioneerService.checkHealth().catch(() => ({ available: false, modelId: "unknown" }));
    if (pioneerHealth.available) {
        const localAvail = await isLocalAvailable();
        return {
            status: "ok",
            model: pioneerHealth.modelId || config.pioneer.modelId,
            ready: true,
            backend: "pioneer",
            pioneerAvailable: true,
        };
    }

    // Check local (FALLBACK)
    try {
        const res = await fetch(`${config.gliner.baseUrl}/health`, {
            signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
            const data = await res.json();
            return { ...data, backend: "local" as const, pioneerAvailable: false };
        }
    } catch { /* fall through */ }

    return {
        status: "fallback",
        model: "regex",
        ready: true,
        backend: "fallback",
        pioneerAvailable: false,
    };
}

// ─── Regex Fallback ─────────────────────────────────────────────────

function fallbackExtract(text: string): ExtractedEntity[] {
    const techTerms = [
        "React", "Vue", "Angular", "Next.js", "Node.js", "Express",
        "Python", "Java", "JavaScript", "TypeScript", "Go", "Rust", "C++", "C#",
        "PostgreSQL", "MongoDB", "Redis", "MySQL", "Neo4j", "SQLite",
        "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Terraform",
        "REST", "GraphQL", "gRPC", "WebSocket",
        "Binary Search", "DFS", "BFS", "Dynamic Programming", "Sorting",
        "Hash Map", "Linked List", "Binary Tree", "Graph", "Stack", "Queue",
        "Microservices", "Load Balancer", "Cache", "Message Queue",
        "CI/CD", "TDD", "Agile", "Scrum",
        "Machine Learning", "Deep Learning", "NLP", "Computer Vision",
        "FastAPI", "Django", "Flask", "Spring Boot", "PyTorch", "TensorFlow",
    ];
    const found: ExtractedEntity[] = [];
    const textLower = text.toLowerCase();
    for (const term of techTerms) {
        if (textLower.includes(term.toLowerCase())) {
            found.push({ text: term, label: categorizeTerm(term), score: 0.7 });
        }
    }
    return found;
}

function categorizeTerm(term: string): string {
    const languages = ["Python", "Java", "JavaScript", "TypeScript", "Go", "Rust", "C++", "C#"];
    const frameworks = ["React", "Vue", "Angular", "Next.js", "Node.js", "Express", "FastAPI", "Django", "Flask", "Spring Boot"];
    const databases = ["PostgreSQL", "MongoDB", "Redis", "MySQL", "Neo4j", "SQLite"];
    const algorithms = ["Binary Search", "DFS", "BFS", "Dynamic Programming", "Sorting"];
    const dataStructures = ["Hash Map", "Linked List", "Binary Tree", "Graph", "Stack", "Queue"];
    if (languages.includes(term)) return "programming_language";
    if (frameworks.includes(term)) return "framework";
    if (databases.includes(term)) return "database";
    if (algorithms.includes(term)) return "algorithm";
    if (dataStructures.includes(term)) return "data_structure";
    return "technology";
}
