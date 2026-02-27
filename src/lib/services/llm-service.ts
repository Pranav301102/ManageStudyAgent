// ─── LLM Service — Gemini 2.5 Flash for Interview Questions & Evaluation
import OpenAI from "openai";
import { config } from "../config";
import { Job, CompanyIntel, SkillGap, InterviewQuestion } from "../types";
import { v4 as uuid } from "uuid";

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

// ─── Generate Tailored Interview Questions ───────────────────────────

export async function generateInterviewQuestions(
  job: Job,
  companyIntel: CompanyIntel | undefined,
  skillGaps: SkillGap[]
): Promise<InterviewQuestion[]> {
  const prompt = buildQuestionPrompt(job, companyIntel, skillGaps);

  try {
    const response = await getClient().chat.completions.create({
      model: config.gemini.model,
      messages: [
        {
          role: "system",
          content: `You are an expert technical interviewer. Generate interview questions tailored to a specific role.
Return a JSON array of questions. Each question must have:
- "text": the question text
- "type": one of "behavioral", "technical", "situational", "company-specific"
- "category": a short label like "System Design", "Algorithms", "Culture Fit", etc.

Generate exactly 8 questions:
- 2 behavioral (STAR method)
- 3 technical (based on required skills and tech stack)
- 1 situational (work scenario)
- 2 company-specific (using recent news/product knowledge)

Return ONLY the JSON array, no markdown formatting.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || "[]";
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleanContent) as Array<{
      text: string;
      type: string;
      category: string;
    }>;

    return parsed.map((q) => ({
      id: uuid(),
      text: q.text,
      type: q.type as InterviewQuestion["type"],
      category: q.category,
    }));
  } catch (err) {
    console.error("[LLM] Failed to generate questions:", err);
    return getDefaultQuestions(job);
  }
}

// ─── Evaluate Response Content ───────────────────────────────────────

export async function evaluateResponse(
  question: string,
  response: string,
  job: Job
): Promise<{ score: number; feedback: string }> {
  try {
    const result = await getClient().chat.completions.create({
      model: config.gemini.model,
      messages: [
        {
          role: "system",
          content: `You are an expert interview coach evaluating a candidate's response.
Score the response from 1-5 and provide brief, actionable feedback.
Return JSON: {"score": number, "feedback": "string"}
Consider: relevance, depth, use of specific examples, STAR method for behavioral, technical accuracy for technical questions.
Return ONLY the JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Role: ${job.title} at ${job.company}
Question: ${question}
Candidate Response: ${response}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const content = result.choices[0]?.message?.content || '{"score":3,"feedback":"Unable to evaluate"}';
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleanContent);
  } catch (err) {
    console.error("[LLM] Failed to evaluate response:", err);
    return { score: 3, feedback: "Evaluation unavailable. Keep practicing!" };
  }
}

// ─── Extract Skills from JD (when Yutori browsing returns raw text) ──

export async function extractSkillsFromJD(
  description: string
): Promise<{ required: string[]; preferred: string[]; techStack: string[] }> {
  try {
    const result = await getClient().chat.completions.create({
      model: config.gemini.model,
      messages: [
        {
          role: "system",
          content: `Extract skills from this job description. Return JSON:
{"required": ["skill1", ...], "preferred": ["skill1", ...], "techStack": ["tech1", ...]}
- required: must-have skills/qualifications
- preferred: nice-to-have skills
- techStack: specific technologies, languages, frameworks, tools
Return ONLY the JSON, no markdown.`,
        },
        { role: "user", content: description },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const content = result.choices[0]?.message?.content || '{"required":[],"preferred":[],"techStack":[]}';
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleanContent);
  } catch {
    return { required: [], preferred: [], techStack: [] };
  }
}

// ─── Build Prompt ────────────────────────────────────────────────────

function buildQuestionPrompt(
  job: Job,
  intel: CompanyIntel | undefined,
  gaps: SkillGap[]
): string {
  let prompt = `Generate interview questions for this role:

ROLE: ${job.title} at ${job.company}
LOCATION: ${job.location}

JOB DESCRIPTION:
${job.description.slice(0, 1500)}

REQUIRED SKILLS: ${job.requiredSkills.map((s) => s.name).join(", ")}
TECH STACK: ${job.techStack.join(", ")}
`;

  if (intel) {
    prompt += `
COMPANY INTELLIGENCE:
- Recent News: ${intel.recentNews.slice(0, 3).map((n) => n.title).join("; ")}
- Company Tech Stack: ${intel.techStack.join(", ")}
- Culture: ${intel.culture.slice(0, 300)}
- Products: ${intel.products.slice(0, 3).join("; ")}
- Summary: ${intel.summary.slice(0, 300)}
`;
  }

  if (gaps.length > 0) {
    prompt += `
CANDIDATE SKILL GAPS (areas to probe):
${gaps.map((g) => `- ${g.skillName} (${g.importance})`).join("\n")}
`;
  }

  return prompt;
}

// ─── Fallback Questions ──────────────────────────────────────────────

function getDefaultQuestions(job: Job): InterviewQuestion[] {
  return [
    {
      id: uuid(),
      text: `Tell me about a challenging technical project you worked on. What was your role and what was the outcome?`,
      type: "behavioral",
      category: "Experience",
    },
    {
      id: uuid(),
      text: `Why are you interested in the ${job.title} role at ${job.company}?`,
      type: "behavioral",
      category: "Motivation",
    },
    {
      id: uuid(),
      text: `Can you explain how you would design a scalable system for ${job.techStack[0] || "a web application"}?`,
      type: "technical",
      category: "System Design",
    },
    {
      id: uuid(),
      text: `What is your experience with ${job.requiredSkills[0]?.name || "the technologies listed in the job description"}?`,
      type: "technical",
      category: "Technical Skills",
    },
    {
      id: uuid(),
      text: `How would you approach debugging a complex issue in a distributed system?`,
      type: "technical",
      category: "Problem Solving",
    },
    {
      id: uuid(),
      text: `Imagine you disagree with a senior engineer's approach on a project. How would you handle it?`,
      type: "situational",
      category: "Teamwork",
    },
    {
      id: uuid(),
      text: `What do you know about ${job.company} and its products?`,
      type: "company-specific",
      category: "Company Knowledge",
    },
    {
      id: uuid(),
      text: `How do you stay current with developments in ${job.techStack.slice(0, 2).join(" and ") || "technology"}?`,
      type: "company-specific",
      category: "Learning",
    },
  ];
}
