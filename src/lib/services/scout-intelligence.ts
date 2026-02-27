// ─── Scout Intelligence — LLM-Driven Autonomous Scout Generation ────
// The brain behind autonomous scouting: analyzes user profile, generates
// optimized queries, evaluates scout performance, and self-improves.

import OpenAI from "openai";
import { config } from "../config";
import { UserProfile, Scout } from "../types";

let client: OpenAI | null = null;

function getClient(): OpenAI {
    if (!client) {
        client = new OpenAI({
            apiKey: config.gemini.apiKey,
            baseURL: config.gemini.baseUrl,
        });
    }
    return client;
}

export interface SmartQuery {
    query: string;
    strategy: string; // why this query was chosen
    tags: string[];
    priority: number; // 1-5
}

export interface ScoutPerformance {
    scoutId: string;
    relevanceScore: number; // 0-1
    totalJobs: number;
    highMatchJobs: number;
    recommendation: "keep" | "optimize" | "retire";
    suggestedImprovement?: string;
}

/**
 * Generate 5-8 diverse scout queries based on user profile.
 * The LLM reasons about role variations, adjacent roles,
 * emerging companies, and industry trends.
 */
export async function generateSmartQueries(
    profile: UserProfile
): Promise<SmartQuery[]> {
    try {
        const result = await getClient().chat.completions.create({
            model: config.gemini.model,
            messages: [
                {
                    role: "system",
                    content: `You are a career intelligence agent. Given a user's profile, generate diverse job scouting queries that a web monitoring tool will use to find relevant opportunities.

Generate 6-8 queries with different strategies:
1. EXACT MATCH — queries matching their stated target roles and companies
2. ADJACENT ROLES — similar roles they'd qualify for but might not think of
3. EMERGING COMPANIES — promising startups/companies in their skill domain
4. SKILL-BASED — queries focused on their strongest technical skills
5. GROWTH ROLES — stretch roles that match 70-80% of their skills
6. INDUSTRY TRENDS — roles in trending areas relevant to their background

Return a JSON array. Each item:
{
  "query": "the full search query for the monitoring tool",
  "strategy": "one of: exact_match, adjacent_role, emerging_company, skill_based, growth_role, industry_trend",
  "tags": ["tag1", "tag2"],
  "priority": 1-5
}

Make queries specific and actionable. Include company names, locations, role variations, and tech stack keywords where relevant.
Return ONLY the JSON array, no markdown.`,
                },
                {
                    role: "user",
                    content: `USER PROFILE:
Name: ${profile.name}
Target Roles: ${profile.targetRoles.join(", ")}
Target Companies: ${profile.targetCompanies.join(", ")}
Skills: ${profile.skills.map((s) => `${s.name} (${s.category}, level ${s.proficiencyLevel}/5, ${s.yearsExperience}y)`).join(", ")}
Resume Summary: ${profile.resumeSummary || "Not provided"}`,
                },
            ],
            temperature: 0.8,
            max_tokens: 2000,
        });

        const content = result.choices[0]?.message?.content || "[]";
        const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(clean) as SmartQuery[];
    } catch (err) {
        console.error("[ScoutIntelligence] Smart query generation failed:", err);
        return getDefaultQueries(profile);
    }
}

/**
 * Evaluate how well a scout's results match the user's profile.
 * Returns a performance score and recommendation.
 */
export async function evaluateScoutPerformance(
    scout: Scout,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentResults: Array<Record<string, any>>,
    profile: UserProfile
): Promise<ScoutPerformance> {
    if (recentResults.length === 0) {
        return {
            scoutId: scout.id,
            relevanceScore: 0,
            totalJobs: 0,
            highMatchJobs: 0,
            recommendation: "optimize",
            suggestedImprovement: "No results yet — consider broadening the query.",
        };
    }

    try {
        const result = await getClient().chat.completions.create({
            model: config.gemini.model,
            messages: [
                {
                    role: "system",
                    content: `Evaluate how relevant these job search results are for the user's profile.
Return JSON:
{
  "relevanceScore": 0.0-1.0,
  "highMatchJobs": number,
  "recommendation": "keep" | "optimize" | "retire",
  "suggestedImprovement": "string or null"
}
- "keep": >70% relevance, good results
- "optimize": 30-70% relevance, needs query refinement
- "retire": <30% relevance, replace entirely
Return ONLY JSON, no markdown.`,
                },
                {
                    role: "user",
                    content: `SCOUT QUERY: ${scout.query}
USER TARGET ROLES: ${profile.targetRoles.join(", ")}
USER SKILLS: ${profile.skills.map((s) => s.name).join(", ")}
RESULTS (${recentResults.length} jobs):
${recentResults.slice(0, 10).map((r, i) => `${i + 1}. ${r.job_title || r.title} at ${r.company} — ${r.brief_description || r.description || "No description"}`).join("\n")}`,
                },
            ],
            temperature: 0.3,
            max_tokens: 300,
        });

        const content = result.choices[0]?.message?.content || "{}";
        const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(clean);

        return {
            scoutId: scout.id,
            relevanceScore: parsed.relevanceScore || 0.5,
            totalJobs: recentResults.length,
            highMatchJobs: parsed.highMatchJobs || 0,
            recommendation: parsed.recommendation || "keep",
            suggestedImprovement: parsed.suggestedImprovement || undefined,
        };
    } catch (err) {
        console.error("[ScoutIntelligence] Performance evaluation failed:", err);
        return {
            scoutId: scout.id,
            relevanceScore: 0.5,
            totalJobs: recentResults.length,
            highMatchJobs: 0,
            recommendation: "keep",
        };
    }
}

/**
 * Suggest new companies/sources to monitor based on the user's
 * profile and what hasn't been covered by existing scouts.
 */
export async function suggestNewSources(
    profile: UserProfile,
    existingScouts: Scout[]
): Promise<Array<{ company: string; reason: string; careerPageUrl: string }>> {
    try {
        const result = await getClient().chat.completions.create({
            model: config.gemini.model,
            messages: [
                {
                    role: "system",
                    content: `You are a career intelligence agent. Suggest 5-10 companies the user should monitor for job openings.
Focus on companies NOT already being monitored. Consider: their skills, industry trends, company growth stage, and culture fit.
Return JSON array: [{"company": "Name", "reason": "why this company", "careerPageUrl": "https://..."}]
Use real, accurate career page URLs. Return ONLY JSON, no markdown.`,
                },
                {
                    role: "user",
                    content: `USER SKILLS: ${profile.skills.map((s) => s.name).join(", ")}
TARGET ROLES: ${profile.targetRoles.join(", ")}
ALREADY MONITORING: ${existingScouts.map((s) => s.targetCompanies.join(", ")).join("; ") || "None"}`,
                },
            ],
            temperature: 0.8,
            max_tokens: 1500,
        });

        const content = result.choices[0]?.message?.content || "[]";
        const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(clean);
    } catch (err) {
        console.error("[ScoutIntelligence] Source suggestion failed:", err);
        return [];
    }
}

/**
 * Build an improved query based on performance feedback.
 */
export async function buildOptimizedQuery(
    originalQuery: string,
    feedback: string,
    profile: UserProfile
): Promise<string> {
    try {
        const result = await getClient().chat.completions.create({
            model: config.gemini.model,
            messages: [
                {
                    role: "system",
                    content: `Improve this job scouting query based on the feedback. Return ONLY the improved query text, nothing else.`,
                },
                {
                    role: "user",
                    content: `ORIGINAL QUERY: ${originalQuery}
FEEDBACK: ${feedback}
USER TARGET ROLES: ${profile.targetRoles.join(", ")}
USER SKILLS: ${profile.skills.map((s) => s.name).join(", ")}`,
                },
            ],
            temperature: 0.5,
            max_tokens: 300,
        });

        return result.choices[0]?.message?.content?.trim() || originalQuery;
    } catch {
        return originalQuery;
    }
}

// ─── Fallback Queries ────────────────────────────────────────────────

function getDefaultQueries(profile: UserProfile): SmartQuery[] {
    const queries: SmartQuery[] = [];

    // Exact match for each target role
    for (const role of profile.targetRoles) {
        queries.push({
            query: `Find new job postings for ${role} positions at ${profile.targetCompanies.join(", ")} and similar companies. Include title, company, location, URL, and posting date.`,
            strategy: "exact_match",
            tags: [role.toLowerCase().replace(/\s+/g, "-")],
            priority: 5,
        });
    }

    // Skill-based query
    const topSkills = profile.skills
        .sort((a, b) => b.proficiencyLevel - a.proficiencyLevel)
        .slice(0, 5)
        .map((s) => s.name);

    queries.push({
        query: `Find engineering roles requiring ${topSkills.join(", ")} at tech companies and startups. Include title, company, location, URL.`,
        strategy: "skill_based",
        tags: topSkills.map((s) => s.toLowerCase()),
        priority: 3,
    });

    return queries;
}
