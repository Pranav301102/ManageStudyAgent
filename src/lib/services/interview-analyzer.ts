// ─── Interview Analyzer — Post-Interview Adaptive Updates ───────────
// After each mock interview, analyzes performance, identifies strengths
// and weaknesses, adjusts skill levels, and triggers study plan updates.

import OpenAI from "openai";
import { config } from "../config";
import { store, addPerformanceSnapshot } from "../store";
import { InterviewSession, PerformanceSnapshot, SkillDelta } from "../types";
import * as studyPlanner from "./study-planner";

let client: OpenAI | null = null;
function getClient(): OpenAI {
    if (!client) client = new OpenAI({
        apiKey: config.gemini.apiKey,
        baseURL: config.gemini.baseUrl,
    });
    return client;
}

/**
 * Analyze a completed interview and produce a performance snapshot.
 * Updates skill levels and triggers study plan adaptation.
 */
export async function analyzePerformance(
    interview: InterviewSession
): Promise<PerformanceSnapshot> {
    const answeredQuestions = interview.questions.filter((q) => q.response);

    try {
        const result = await getClient().chat.completions.create({
            model: config.gemini.model,
            messages: [
                {
                    role: "system",
                    content: `Analyze this mock interview performance. Identify strengths, weaknesses, and recommended focus areas.

Return JSON:
{
  "strengths": ["category or skill that was strong"],
  "weaknesses": ["category or skill that needs work"],
  "recommendedFocus": ["specific topics to study next"],
  "skillDeltas": [
    {"skillName": "string", "previousLevel": 1-5, "newLevel": 1-5, "reason": "why the change"}
  ],
  "overallTrend": "improving" | "stable" | "declining"
}

Base the trend on whether scores improved vs past patterns (assume first interview is "stable").
Return ONLY JSON, no markdown.`,
                },
                {
                    role: "user",
                    content: `ROLE: ${interview.job.title} at ${interview.job.company}
OVERALL SCORE: ${interview.overallScore || "N/A"}

QUESTIONS & PERFORMANCE:
${answeredQuestions.map((q, i) => `${i + 1}. [${q.type}/${q.category}] ${q.text}
   Score: ${q.contentScore || "N/A"}/5
   Feedback: ${q.feedback || "None"}
   Voice: confidence=${q.voiceAnalysis?.confidence || "N/A"}, clarity=${q.voiceAnalysis?.clarity || "N/A"}`
                    ).join("\n\n")}

USER CURRENT SKILLS:
${store.profile.skills.map((s) => `${s.name}: level ${s.proficiencyLevel}/5`).join(", ")}

PAST PERFORMANCE TREND:
${store.performanceHistory.length > 0
                            ? store.performanceHistory.slice(-3).map((p) => `  Weaknesses: ${p.weaknesses.join(", ")} | Trend: ${p.overallTrend}`).join("\n")
                            : "  First interview"}`,
                },
            ],
            temperature: 0.3,
            max_tokens: 1000,
        });

        const content = result.choices[0]?.message?.content || "{}";
        const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(clean);

        const snapshot: PerformanceSnapshot = {
            interviewId: interview.id,
            date: new Date().toISOString(),
            strengths: parsed.strengths || [],
            weaknesses: parsed.weaknesses || [],
            recommendedFocus: parsed.recommendedFocus || [],
            skillDeltas: (parsed.skillDeltas || []) as SkillDelta[],
            overallTrend: parsed.overallTrend || "stable",
        };

        // Save to store
        addPerformanceSnapshot(snapshot);

        // Apply skill level adjustments
        applySkillDeltas(snapshot.skillDeltas);

        // Trigger study plan adaptation
        if (store.studySchedule) {
            await studyPlanner.adaptPlan(snapshot);
        }

        return snapshot;
    } catch (err) {
        console.error("[InterviewAnalyzer] Analysis failed:", err);

        const fallback: PerformanceSnapshot = {
            interviewId: interview.id,
            date: new Date().toISOString(),
            strengths: [],
            weaknesses: [],
            recommendedFocus: ["General interview practice"],
            skillDeltas: [],
            overallTrend: "stable",
        };
        addPerformanceSnapshot(fallback);
        return fallback;
    }
}

/**
 * Generate an ideal answer for a given interview question (for replay).
 */
export async function generateIdealAnswer(
    question: string,
    jobTitle: string,
    company: string
): Promise<string> {
    try {
        const result = await getClient().chat.completions.create({
            model: config.gemini.model,
            messages: [
                {
                    role: "system",
                    content: `You are an expert interview coach. Generate an ideal, concise answer (150-250 words) for this interview question. Use the STAR method for behavioral questions. Be specific and actionable.`,
                },
                {
                    role: "user",
                    content: `Role: ${jobTitle} at ${company}\nQuestion: ${question}`,
                },
            ],
            temperature: 0.7,
            max_tokens: 400,
        });

        return result.choices[0]?.message?.content?.trim() || "Ideal answer unavailable.";
    } catch {
        return "Ideal answer generation failed. Try again later.";
    }
}

/**
 * Generate a daily challenge based on weakest skill areas.
 */
export async function generateDailyChallenge(): Promise<{
    type: "coding" | "behavioral" | "system-design";
    question: string;
    difficulty: "easy" | "medium" | "hard";
    targetSkill: string;
}> {
    const weaknesses = store.performanceHistory
        .slice(-5)
        .flatMap((p) => p.weaknesses);

    const weakestSkills = weaknesses.length > 0
        ? [...new Set(weaknesses)].slice(0, 3)
        : store.profile.skills
            .filter((s) => s.proficiencyLevel <= 3)
            .map((s) => s.name)
            .slice(0, 3);

    try {
        const result = await getClient().chat.completions.create({
            model: config.gemini.model,
            messages: [
                {
                    role: "system",
                    content: `Generate a daily practice challenge.
Return JSON: {"type": "coding"|"behavioral"|"system-design", "question": "the challenge question", "difficulty": "easy"|"medium"|"hard", "targetSkill": "the skill this targets"}
Return ONLY the JSON, no markdown.`,
                },
                {
                    role: "user",
                    content: `Target weak areas: ${weakestSkills.join(", ")}
User level: ${store.profile.targetRoles.join(", ")}`,
                },
            ],
            temperature: 0.9,
            max_tokens: 300,
        });

        const content = result.choices[0]?.message?.content || "{}";
        const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(clean);
    } catch {
        return {
            type: "coding",
            question: "Implement a function to reverse a linked list in-place.",
            difficulty: "medium",
            targetSkill: weakestSkills[0] || "Data Structures",
        };
    }
}

// ─── Internal ────────────────────────────────────────────────────────

function applySkillDeltas(deltas: SkillDelta[]) {
    for (const delta of deltas) {
        const skill = store.profile.skills.find(
            (s) => s.name.toLowerCase() === delta.skillName.toLowerCase()
        );
        if (skill) {
            skill.proficiencyLevel = Math.max(1, Math.min(5, delta.newLevel));
        }
    }
}
