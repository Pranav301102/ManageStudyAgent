// ─── Study Planner — AI-Generated Study Schedules ───────────────────
// Generates optimized study plans based on user availability, skill gaps,
// upcoming interview dates, and post-interview weakness analysis.

import OpenAI from "openai";
import { config } from "../config";
import { store } from "../store";
import {
    StudySchedule,
    StudyBlock,
    AvailabilitySlot,
    Application,
    PerformanceSnapshot,
} from "../types";
import { v4 as uuid } from "uuid";

let client: OpenAI | null = null;
function getClient(): OpenAI {
    if (!client) client = new OpenAI({
        apiKey: config.gemini.apiKey,
        baseURL: config.gemini.baseUrl,
    });
    return client;
}

/**
 * Generate a full weekly study plan, considering:
 * - User's available time windows
 * - Known skill gaps (from Neo4j/local analysis)
 * - Upcoming interview dates (from applications)
 * - Weaknesses from past interviews
 */
export async function generateStudyPlan(
    availability: AvailabilitySlot[]
): Promise<StudySchedule> {
    const { profile, performanceHistory } = store;
    const applications = Array.from(store.applications.values());

    // Gather context
    const upcomingInterviews = applications
        .filter((a) => a.interviewDate && a.status !== "rejected" && a.status !== "withdrawn")
        .sort((a, b) => new Date(a.interviewDate!).getTime() - new Date(b.interviewDate!).getTime());

    const recentWeaknesses = performanceHistory
        .slice(-3)
        .flatMap((p) => p.weaknesses);

    const skillGapsList = applications
        .flatMap((a) => a.job.skillGaps.map((g) => g.skillName));

    const uniqueWeaknesses = [...new Set([...recentWeaknesses, ...skillGapsList])];

    try {
        const result = await getClient().chat.completions.create({
            model: config.gemini.model,
            messages: [
                {
                    role: "system",
                    content: `You are a study planning AI. Create an optimized 7-day study plan.

Given: user availability, skill gaps, upcoming interviews, and weaknesses.

Rules:
1. Prioritize skills needed for the SOONEST interview
2. Allocate more time to "critical" weaknesses
3. Mix coding practice + behavioral prep + system design
4. Include breaks — never schedule more than 2 hours continuously
5. Include at least one mock interview session if an interview is within 5 days

Return JSON array of study blocks:
[{
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "topic": "specific topic to study",
  "type": "skill-gap" | "mock-interview" | "coding-practice" | "system-design" | "behavioral",
  "priority": "critical" | "high" | "medium",
  "linkedJobId": "job ID if related to specific interview, or null"
}]

Return ONLY the JSON array, no markdown.`,
                },
                {
                    role: "user",
                    content: `TODAY: ${new Date().toISOString().split("T")[0]}

AVAILABILITY (weekly slots):
${availability.map((s) => `  Day ${s.dayOfWeek} (${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.dayOfWeek]}): ${s.startHour}:00 - ${s.endHour}:00`).join("\n")}

UPCOMING INTERVIEWS:
${upcomingInterviews.length > 0
                            ? upcomingInterviews.map((a) => `  ${a.job.title} at ${a.job.company} — ${a.interviewDate} (skills: ${a.job.techStack.slice(0, 5).join(", ")})`).join("\n")
                            : "  None scheduled yet"}

SKILL GAPS / WEAKNESSES TO FOCUS ON:
${uniqueWeaknesses.length > 0 ? uniqueWeaknesses.map((w) => `  - ${w}`).join("\n") : "  No specific weaknesses identified yet"}

USER SKILLS: ${profile.skills.map((s) => `${s.name} (level ${s.proficiencyLevel}/5)`).join(", ")}
TARGET ROLES: ${profile.targetRoles.join(", ")}`,
                },
            ],
            temperature: 0.7,
            max_tokens: 3000,
        });

        const content = result.choices[0]?.message?.content || "[]";
        const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const blocks = JSON.parse(clean) as Array<{
            date: string;
            startTime: string;
            endTime: string;
            topic: string;
            type: StudyBlock["type"];
            priority: StudyBlock["priority"];
            linkedJobId?: string;
        }>;

        const studyPlan: StudyBlock[] = blocks.map((b) => ({
            id: uuid(),
            date: b.date,
            startTime: b.startTime,
            endTime: b.endTime,
            topic: b.topic,
            type: b.type,
            priority: b.priority,
            linkedJobId: b.linkedJobId || undefined,
            completed: false,
        }));

        const schedule: StudySchedule = {
            id: uuid(),
            availability,
            studyPlan,
            generatedAt: new Date().toISOString(),
        };

        store.studySchedule = schedule;
        return schedule;
    } catch (err) {
        console.error("[StudyPlanner] Plan generation failed:", err);
        return getDefaultPlan(availability);
    }
}

/**
 * Adapt the study plan after an interview — shift focus based on results.
 * Adds failure-triggered blocks for specific weaknesses identified.
 */
export async function adaptPlan(
    snapshot: PerformanceSnapshot
): Promise<StudySchedule | null> {
    if (!store.studySchedule) return null;

    const { availability } = store.studySchedule;

    // Re-generate with updated weakness info already in store
    const newSchedule = await generateStudyPlan(availability);

    // Mark blocks that correspond to interview weaknesses as failure-triggered
    if (newSchedule && snapshot.weaknesses.length > 0) {
        for (const block of newSchedule.studyPlan) {
            // Check if this block's topic matches any weakness
            const matchedWeakness = snapshot.weaknesses.find(
                (w) =>
                    block.topic.toLowerCase().includes(w.toLowerCase()) ||
                    w.toLowerCase().includes(block.topic.toLowerCase().split(" ")[0])
            );
            if (matchedWeakness) {
                block.triggeredBy = "interview-failure";
                block.failureReason = matchedWeakness;
                // Upgrade priority for failure-driven blocks
                if (block.priority !== "critical") block.priority = "high";
            }
        }

        // If no blocks matched weaknesses directly, inject explicit blocks
        const covered = new Set(
            newSchedule.studyPlan
                .filter((b) => b.triggeredBy === "interview-failure")
                .map((b) => b.failureReason)
        );
        const uncoveredWeaknesses = snapshot.weaknesses.filter(
            (w) => !covered.has(w)
        );
        for (const weakness of uncoveredWeaknesses.slice(0, 3)) {
            newSchedule.studyPlan.push({
                id: uuid(),
                date: new Date().toISOString().split("T")[0],
                startTime: "18:00",
                endTime: "19:30",
                topic: `Focus: ${weakness}`,
                type: "skill-gap",
                priority: "critical",
                completed: false,
                triggeredBy: "interview-failure",
                failureReason: weakness,
            });
        }

        store.studySchedule = newSchedule;
        console.log(
            `[StudyPlanner] Adapted plan: ${snapshot.weaknesses.length} weaknesses → ` +
            `${newSchedule.studyPlan.filter((b) => b.triggeredBy === "interview-failure").length} failure blocks added`
        );
    }

    return newSchedule;
}

/** Mark a study block as completed. */
export function completeBlock(blockId: string): boolean {
    if (!store.studySchedule) return false;
    const block = store.studySchedule.studyPlan.find((b) => b.id === blockId);
    if (block) {
        block.completed = true;
        return true;
    }
    return false;
}

// ─── Fallback plan ───────────────────────────────────────────────────

function getDefaultPlan(availability: AvailabilitySlot[]): StudySchedule {
    const today = new Date();
    const blocks: StudyBlock[] = [];
    const topics = [
        { topic: "Data Structures Review", type: "coding-practice" as const, priority: "high" as const },
        { topic: "Behavioral Questions (STAR)", type: "behavioral" as const, priority: "medium" as const },
        { topic: "System Design Fundamentals", type: "system-design" as const, priority: "high" as const },
        { topic: "Algorithm Practice", type: "coding-practice" as const, priority: "critical" as const },
        { topic: "Mock Interview Session", type: "mock-interview" as const, priority: "critical" as const },
    ];

    for (let d = 0; d < 7; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() + d);
        const dayOfWeek = date.getDay();

        const slot = availability.find((s) => s.dayOfWeek === dayOfWeek);
        if (!slot) continue;

        const topic = topics[d % topics.length];
        blocks.push({
            id: uuid(),
            date: date.toISOString().split("T")[0],
            startTime: `${slot.startHour.toString().padStart(2, "0")}:00`,
            endTime: `${Math.min(slot.startHour + 2, slot.endHour).toString().padStart(2, "0")}:00`,
            topic: topic.topic,
            type: topic.type,
            priority: topic.priority,
            completed: false,
        });
    }

    const schedule: StudySchedule = {
        id: uuid(),
        availability,
        studyPlan: blocks,
        generatedAt: new Date().toISOString(),
    };

    store.studySchedule = schedule;
    return schedule;
}
