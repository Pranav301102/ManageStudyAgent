// ─── Interview Analyzer — Post-Interview Adaptive Updates ───────────
// After each mock interview, analyzes performance, identifies strengths
// and weaknesses, adjusts skill levels, and triggers study plan updates.

import OpenAI from "openai";
import { config } from "../config";
import { store, addPerformanceSnapshot } from "../store";
import { InterviewSession, InterviewReport, PerformanceSnapshot, SkillDelta } from "../types";
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
   Voice (Modulate Velma-2): confidence=${q.voiceAnalysis?.confidence || "N/A"}%, clarity=${q.voiceAnalysis?.clarity || "N/A"}%, pace=${q.voiceAnalysis?.pace || "N/A"}%
   Sentiment: ${q.voiceAnalysis?.sentiment || "N/A"}, Emotion: ${q.voiceAnalysis?.emotion || "N/A"}, Fillers: ${q.voiceAnalysis?.fillerWordCount || 0}`
                    ).join("\n\n")}

USER CURRENT SKILLS:
${store.profile.skills.map((s) => `${s.name}: level ${s.proficiencyLevel}/5`).join(", ")}

PAST PERFORMANCE TREND:
${store.performanceHistory.length > 0
                            ? store.performanceHistory.slice(-3).map((p) => `  Weaknesses: ${p.weaknesses.join(", ")} | Trend: ${p.overallTrend}`).join("\n")
                            : "  First interview"}

NOTE: Include voice/communication issues (low confidence, excessive fillers, unclear speech) in weaknesses if relevant.`,
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

// ─── Interview Report Generation ────────────────────────────────────

/**
 * Generate a comprehensive post-interview report from all Q&A data,
 * scores, and voice metrics. Uses Gemini to produce a narrative summary
 * and a concrete improvement plan.
 */
export async function generateInterviewReport(
    interview: InterviewSession
): Promise<InterviewReport> {
    const answered = interview.questions.filter((q) => q.response);

    // Build per-question breakdown
    const questionBreakdown = answered.map((q) => ({
        question: q.text,
        type: q.type,
        contentScore: q.contentScore ?? 0,
        deliveryScore: q.deliveryScore ?? 0,
        feedback: q.feedback ?? "No feedback available",
        voiceMetrics: q.voiceAnalysis
            ? {
                  confidence: q.voiceAnalysis.confidence,
                  clarity: q.voiceAnalysis.clarity,
                  pace: q.voiceAnalysis.pace,
                  fillerCount: q.voiceAnalysis.fillerWordCount,
              }
            : undefined,
    }));

    // Compute aggregate scores
    const avgContent =
        answered.length > 0
            ? answered.reduce((s, q) => s + (q.contentScore ?? 0), 0) / answered.length
            : 0;
    const avgDelivery =
        answered.length > 0
            ? answered.reduce((s, q) => s + (q.deliveryScore ?? 0), 0) / answered.length
            : 0;

    // Ask Gemini to produce the narrative pieces
    let summary = "";
    let strengths: string[] = [];
    let weaknesses: string[] = [];
    let recommendedStudyTopics: string[] = [];
    let improvementPlan = "";

    try {
        const reportPrompt = `You are an expert interview coach. A candidate just completed a mock interview for "${interview.job.title}" at "${interview.job.company}".

Here is the question-by-question breakdown:

${questionBreakdown
    .map(
        (q, i) =>
            `Q${i + 1} (${q.type}): "${q.question}"
  Content: ${q.contentScore}/5 | Delivery: ${q.deliveryScore}/5
  Feedback: ${q.feedback}${
                q.voiceMetrics
                    ? `\n  Voice — confidence: ${q.voiceMetrics.confidence}%, clarity: ${q.voiceMetrics.clarity}%, pace: ${q.voiceMetrics.pace}%, fillers: ${q.voiceMetrics.fillerCount}`
                    : ""
            }`
    )
    .join("\n\n")}

Overall content average: ${avgContent.toFixed(1)}/5
Overall delivery average: ${avgDelivery.toFixed(1)}/5
Overall score: ${interview.overallScore ?? "N/A"}/100

Respond in this exact JSON format:
{
  "summary": "2-3 sentence executive summary of performance",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "recommendedStudyTopics": ["topic1", "topic2", "topic3"],
  "improvementPlan": "A detailed 2-3 paragraph plan for how to improve before the next interview"
}`;

        const result = await getClient().chat.completions.create({
            model: config.gemini.model,
            messages: [{ role: "user", content: reportPrompt }],
            response_format: { type: "json_object" },
            temperature: 0.4,
        });

        const parsed = JSON.parse(result.choices[0]?.message?.content ?? "{}");
        summary = parsed.summary ?? "Interview completed.";
        strengths = parsed.strengths ?? [];
        weaknesses = parsed.weaknesses ?? [];
        recommendedStudyTopics = parsed.recommendedStudyTopics ?? [];
        improvementPlan = parsed.improvementPlan ?? "Review weak areas and practice again.";
    } catch (err) {
        console.error("[interview-analyzer] Report generation LLM error:", err);
        summary = `Completed mock interview for ${interview.job.title} at ${interview.job.company}. Scored ${interview.overallScore ?? "N/A"}/100 overall.`;
        strengths = avgContent >= 3 ? ["Solid technical knowledge"] : [];
        weaknesses = avgContent < 3 ? ["Needs deeper technical preparation"] : [];
        recommendedStudyTopics = interview.questions
            .filter((q) => (q.contentScore ?? 0) < 3)
            .map((q) => q.category)
            .filter((v, i, a) => a.indexOf(v) === i);
        improvementPlan = "Focus on weaker question categories and practice with timed sessions.";
    }

    const report: InterviewReport = {
        id: `report-${interview.id}`,
        interviewId: interview.id,
        generatedAt: new Date().toISOString(),
        summary,
        contentScore: Math.round(avgContent * 10) / 10,
        deliveryScore: Math.round(avgDelivery * 10) / 10,
        overallScore: interview.overallScore ?? Math.round(((avgContent + avgDelivery) / 2) * 20),
        strengths,
        weaknesses,
        questionBreakdown,
        recommendedStudyTopics,
        improvementPlan,
    };

    return report;
}
