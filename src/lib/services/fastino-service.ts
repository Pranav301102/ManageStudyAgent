// ─── Local Memory Service — Interview Session Persistence ───────────
// Replaces Fastino's cloud memory API with a local implementation.
// Stores per-user interview memory, learning patterns, and skill progression.
// Uses in-memory store with JSON persistence for hackathon speed.

import { store } from "../store";

interface MemoryEntry {
    id: string;
    userId: string;
    content: string;
    metadata: Record<string, unknown>;
    timestamp: string;
    type: "interview" | "skill" | "feedback" | "pattern";
}

// In-memory session memory (persists across requests within same server lifetime)
const memoryStore = new Map<string, MemoryEntry[]>();

/**
 * Store a memory entry for the user. Remembers mistakes,
 * strengths, and patterns across interview sessions.
 */
export async function storeMemory(
    userId: string,
    content: string,
    metadata?: Record<string, unknown>
): Promise<void> {
    const entries = memoryStore.get(userId) || [];
    entries.push({
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        content,
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
        type: (metadata?.type as MemoryEntry["type"]) || "interview",
    });
    // Keep last 100 entries per user
    if (entries.length > 100) entries.splice(0, entries.length - 100);
    memoryStore.set(userId, entries);
}

/**
 * Retrieve relevant memory context for a user — used to personalize
 * the interview experience and avoid repeating the same topics.
 */
export async function retrieveMemory(
    userId: string,
    query: string
): Promise<{ entries: MemoryEntry[]; summary: string } | null> {
    const entries = memoryStore.get(userId);
    if (!entries || entries.length === 0) return null;

    // Simple keyword relevance scoring
    const queryWords = query.toLowerCase().split(/\s+/);
    const scored = entries.map((entry) => {
        const text = entry.content.toLowerCase();
        const score = queryWords.filter((w) => text.includes(w)).length;
        return { entry, score };
    });

    const relevant = scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((s) => s.entry);

    // If no keyword matches, return most recent
    const results = relevant.length > 0 ? relevant : entries.slice(-5);

    return {
        entries: results,
        summary: results.map((e) => e.content).join(" | "),
    };
}

/**
 * Classify a user response as correct, incorrect, or partial.
 * Uses simple heuristic matching against expected concepts.
 */
export async function classifyResponse(
    userAnswer: string,
    expectedConcepts: string[]
): Promise<{ classification: string; confidence: number; feedback: string }> {
    const answerLower = userAnswer.toLowerCase();
    const matched = expectedConcepts.filter((c) =>
        answerLower.includes(c.toLowerCase())
    );

    const ratio = matched.length / Math.max(1, expectedConcepts.length);

    if (ratio >= 0.7) {
        return {
            classification: "correct",
            confidence: ratio,
            feedback: `Good coverage — mentioned ${matched.length}/${expectedConcepts.length} key concepts.`,
        };
    } else if (ratio >= 0.3) {
        const missing = expectedConcepts.filter(
            (c) => !answerLower.includes(c.toLowerCase())
        );
        return {
            classification: "partially_correct",
            confidence: ratio,
            feedback: `Partial — consider also mentioning: ${missing.slice(0, 3).join(", ")}`,
        };
    } else {
        return {
            classification: "incorrect",
            confidence: ratio,
            feedback: `Missing key concepts: ${expectedConcepts.slice(0, 3).join(", ")}`,
        };
    }
}

/**
 * Evaluate a code snippet for correctness and quality.
 * Uses pattern-based analysis (no external API needed).
 */
export async function evaluateCodeSnippet(
    code: string,
    language: string,
    problemContext: string
): Promise<{
    isCorrect: boolean;
    issues: string[];
    suggestions: string[];
    complexity: string;
}> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Basic code quality checks
    const lines = code.split("\n");

    if (lines.length < 3) {
        issues.push("Code seems too short — may be incomplete");
    }

    // Check for common patterns
    if (language === "python" || language === "javascript" || language === "typescript") {
        if (!code.includes("return") && !code.includes("print") && !code.includes("console.log")) {
            issues.push("No return statement or output found");
        }

        // Check for edge case handling
        if (!code.includes("if") && !code.includes("?")) {
            suggestions.push("Consider adding edge case handling (null/empty checks)");
        }

        // Detect potential infinite loops
        if ((code.includes("while") || code.includes("for")) && !code.includes("break") && !code.includes("return")) {
            suggestions.push("Verify loop termination conditions");
        }
    }

    // Complexity estimation (very rough)
    const nestedLoops = (code.match(/for|while/g) || []).length;
    let complexity = "O(n)";
    if (nestedLoops >= 2) complexity = "O(n²)";
    else if (nestedLoops >= 3) complexity = "O(n³)";
    else if (code.includes("sort")) complexity = "O(n log n)";
    else if (nestedLoops === 0) complexity = "O(1)";

    if (complexity === "O(n²)" || complexity === "O(n³)") {
        suggestions.push(`Estimated ${complexity} — consider optimizing if possible`);
    }

    return {
        isCorrect: issues.length === 0,
        issues,
        suggestions,
        complexity,
    };
}

/**
 * Get user's known weaknesses from performance history.
 */
export function getKnownWeaknesses(userId: string): string[] {
    return store.performanceHistory
        .flatMap((p) => p.weaknesses)
        .filter((w, i, arr) => arr.indexOf(w) === i)
        .slice(0, 10);
}

/**
 * Get user's session history summary.
 */
export function getSessionHistory(userId: string): string[] {
    const entries = memoryStore.get(userId) || [];
    return entries
        .filter((e) => e.type === "interview")
        .slice(-10)
        .map((e) => e.content);
}
