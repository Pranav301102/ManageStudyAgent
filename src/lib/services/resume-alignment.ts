// ─── Resume Alignment Service — Pioneer + Gemini Auto-ATS Optimizer ──
// Automatically aligns a user's resume to each discovered job description:
//
//   1. Pioneer GLiNER-2 extracts entities from BOTH the resume & JD
//   2. Computes entity overlap → identifies missing keywords/skills
//   3. Gemini rewrites resume sections to weave in missing JD terms
//   4. Pioneer re-extracts from the aligned resume → verifies ATS match
//   5. Scores ATS pass probability + human-readability
//   6. Collects (resume, JD, aligned_resume, score) pairs for fine-tuning
//   7. Periodically fine-tunes a Pioneer model on real-world alignment data
//      → better ATS-optimized suggestions over time
//
// The entire flow runs in the background when a new job is discovered.

import OpenAI from "openai";
import { config } from "../config";
import { ExtractedEntity, Job, UserProfile } from "../types";
import * as pioneerService from "./pioneer-service";
import * as glinerService from "./gliner-service";

// ─── Types ──────────────────────────────────────────────────────────

export interface ResumeAlignment {
    id: string;
    jobId: string;
    originalResume: string;
    alignedResume: string;
    jobDescription: string;
    resumeEntities: ExtractedEntity[];
    jdEntities: ExtractedEntity[];
    alignedEntities: ExtractedEntity[];
    missingKeywords: string[];
    addedKeywords: string[];
    atsScore: number;          // 0-100 — estimated ATS pass rate
    humanScore: number;        // 0-100 — readability score
    overallScore: number;      // 0-100 — weighted combination
    suggestions: string[];
    createdAt: string;
    modelVersion?: string;     // Pioneer model used for extraction
}

export interface ATSAnalysis {
    atsScore: number;
    humanScore: number;
    overallScore: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    suggestions: string[];
    entityOverlap: number;     // 0-1 — ratio of JD entities found in resume
    categoryBreakdown: Record<string, {
        jdCount: number;
        resumeCount: number;
        overlap: number;
    }>;
}

// ─── Training data collector for Pioneer fine-tuning ────────────────

interface AlignmentTrainingSample {
    resume: string;
    jobDescription: string;
    alignedResume: string;
    atsScore: number;
    entities: ExtractedEntity[];
    timestamp: string;
}

// In-memory collector — persists within server lifetime
const trainingDataCollector: AlignmentTrainingSample[] = [];
const FINE_TUNE_THRESHOLD = 50; // collect N samples before auto-fine-tuning

// ─── Gemini Client ──────────────────────────────────────────────────

let geminiClient: OpenAI | null = null;

function getGemini(): OpenAI {
    if (!geminiClient) {
        geminiClient = new OpenAI({
            apiKey: config.gemini.apiKey,
            baseURL: config.gemini.baseUrl,
        });
    }
    return geminiClient;
}

// ─── Step 1: Analyze Resume-JD Match ────────────────────────────────

/**
 * Extract entities from both resume and JD using Pioneer cloud,
 * compute overlap, and identify exactly what's missing.
 */
export async function analyzeResumeMatch(
    resume: string,
    jobDescription: string
): Promise<ATSAnalysis> {
    // Run Pioneer extraction in parallel on resume & JD
    const [resumeEntities, jdEntities] = await Promise.all([
        extractResumeEntities(resume),
        extractJDEntities(jobDescription),
    ]);

    // Compute entity overlap
    const resumeEntitySet = new Set(
        resumeEntities.map((e) => e.text.toLowerCase())
    );
    const jdEntityTexts = jdEntities.map((e) => e.text.toLowerCase());

    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];

    for (const jdEntity of jdEntities) {
        const jdText = jdEntity.text.toLowerCase();
        if (resumeEntitySet.has(jdText)) {
            matchedKeywords.push(jdEntity.text);
        } else {
            // Check for partial/synonym match
            const partialMatch = resumeEntities.some(
                (re) =>
                    re.text.toLowerCase().includes(jdText) ||
                    jdText.includes(re.text.toLowerCase())
            );
            if (partialMatch) {
                matchedKeywords.push(jdEntity.text);
            } else {
                missingKeywords.push(jdEntity.text);
            }
        }
    }

    // Category breakdown
    const categoryBreakdown: ATSAnalysis["categoryBreakdown"] = {};
    const allLabels = new Set([
        ...resumeEntities.map((e) => e.label),
        ...jdEntities.map((e) => e.label),
    ]);

    for (const label of allLabels) {
        const jdInLabel = jdEntities.filter((e) => e.label === label);
        const resumeInLabel = resumeEntities.filter((e) => e.label === label);
        const jdTexts = new Set(jdInLabel.map((e) => e.text.toLowerCase()));
        const resumeTexts = new Set(resumeInLabel.map((e) => e.text.toLowerCase()));
        const overlap = [...jdTexts].filter((t) => resumeTexts.has(t)).length;

        categoryBreakdown[label] = {
            jdCount: jdInLabel.length,
            resumeCount: resumeInLabel.length,
            overlap,
        };
    }

    const entityOverlap = jdEntityTexts.length > 0
        ? matchedKeywords.length / jdEntityTexts.length
        : 0;

    // Compute scores
    const atsScore = Math.round(entityOverlap * 85 + 15); // base 15, max 100
    const humanScore = 80; // placeholder — later: Gemini evaluates readability
    const overallScore = Math.round(atsScore * 0.6 + humanScore * 0.4);

    // Generate suggestions
    const suggestions: string[] = [];
    if (missingKeywords.length > 0) {
        suggestions.push(
            `Add these missing keywords: ${missingKeywords.slice(0, 8).join(", ")}`
        );
    }
    if (entityOverlap < 0.5) {
        suggestions.push(
            "Resume covers less than 50% of JD requirements — significant rewrite recommended"
        );
    }
    for (const [label, data] of Object.entries(categoryBreakdown)) {
        if (data.jdCount > 0 && data.overlap === 0) {
            suggestions.push(`No ${label.replace(/_/g, " ")} mentioned — JD requires ${data.jdCount}`);
        }
    }

    return {
        atsScore,
        humanScore,
        overallScore,
        matchedKeywords,
        missingKeywords,
        suggestions,
        entityOverlap,
        categoryBreakdown,
    };
}

// ─── Step 2: Auto-Align Resume ──────────────────────────────────────

/**
 * Use Gemini to rewrite the resume, weaving in missing JD keywords
 * while maintaining natural language and truthfulness.
 * Then re-verify with Pioneer to confirm ATS alignment improved.
 */
export async function alignResume(
    resume: string,
    jobDescription: string,
    job: Job
): Promise<ResumeAlignment> {
    console.log(`[ResumeAlign] Aligning resume for: ${job.title} at ${job.company}`);

    // Step 1: Analyze current match
    const analysis = await analyzeResumeMatch(resume, jobDescription);

    // Step 2: Extract entities for context
    const [resumeEntities, jdEntities] = await Promise.all([
        extractResumeEntities(resume),
        extractJDEntities(jobDescription),
    ]);

    // Step 3: Use Gemini to rewrite resume sections
    const alignedResume = await rewriteWithGemini(
        resume,
        jobDescription,
        job,
        analysis.missingKeywords,
        jdEntities
    );

    // Step 4: Re-extract entities from aligned resume using Pioneer
    const alignedEntities = await extractResumeEntities(alignedResume);

    // Step 5: Compute new ATS score
    const postAnalysis = await analyzeResumeMatch(alignedResume, jobDescription);

    // Step 6: Score human readability via Gemini
    const humanScore = await scoreHumanReadability(alignedResume);

    const overallScore = Math.round(postAnalysis.atsScore * 0.6 + humanScore * 0.4);

    const alignment: ResumeAlignment = {
        id: `align-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        jobId: job.id,
        originalResume: resume,
        alignedResume,
        jobDescription,
        resumeEntities,
        jdEntities,
        alignedEntities,
        missingKeywords: analysis.missingKeywords,
        addedKeywords: postAnalysis.matchedKeywords.filter(
            (k) => !analysis.matchedKeywords.includes(k)
        ),
        atsScore: postAnalysis.atsScore,
        humanScore,
        overallScore,
        suggestions: postAnalysis.suggestions,
        createdAt: new Date().toISOString(),
        modelVersion: config.pioneer.modelId,
    };

    console.log(
        `[ResumeAlign] Done: ATS ${analysis.atsScore}→${postAnalysis.atsScore}, ` +
        `Human ${humanScore}, Overall ${overallScore}`
    );

    // Step 7: Collect training data for Pioneer fine-tuning
    collectTrainingData(alignment);

    return alignment;
}

// ─── Entity Extraction Helpers ──────────────────────────────────────

/**
 * Extract entities from resume text using Pioneer cloud (primary)
 * or local GLiNER (fallback).
 */
async function extractResumeEntities(resume: string): Promise<ExtractedEntity[]> {
    // Pioneer multi-pass for maximum recall on resumes
    try {
        return await pioneerService.multiPassInference(resume, [
            {
                schema: [
                    "programming_language", "framework", "library",
                    "database", "cloud_service", "tool", "platform",
                ],
                threshold: 0.3,
            },
            {
                schema: [
                    "algorithm", "data_structure", "design_pattern",
                    "methodology", "architecture_pattern",
                ],
                threshold: 0.35,
            },
            {
                schema: [
                    "soft_skill", "certification", "degree",
                    "job_title", "company", "domain_knowledge",
                ],
                threshold: 0.3,
            },
        ]);
    } catch {
        // Fallback to local GLiNER
        return glinerService.extractEntities(resume, [
            "programming_language", "framework", "technology",
            "database", "cloud_service", "tool", "methodology",
        ], 0.3);
    }
}

/**
 * Extract entities from JD using Pioneer cloud.
 */
async function extractJDEntities(jd: string): Promise<ExtractedEntity[]> {
    try {
        const result = await pioneerService.extractJDSkillsCloud(jd);
        return result.allTech;
    } catch {
        return glinerService.extractJDSkills(jd);
    }
}

// ─── Gemini Rewrite ─────────────────────────────────────────────────

/**
 * Use Gemini to intelligently rewrite resume sections,
 * incorporating missing JD keywords naturally.
 */
async function rewriteWithGemini(
    resume: string,
    jobDescription: string,
    job: Job,
    missingKeywords: string[],
    jdEntities: ExtractedEntity[]
): Promise<string> {
    if (missingKeywords.length === 0) {
        return resume; // Already well-aligned
    }

    try {
        const response = await getGemini().chat.completions.create({
            model: config.gemini.model,
            messages: [
                {
                    role: "system",
                    content: `You are an expert ATS resume optimizer. Your task is to rewrite a resume to better align with a specific job description while maintaining truthfulness and natural language.

RULES:
1. NEVER fabricate experience or skills the candidate doesn't have
2. Reframe existing experience using JD terminology where applicable
3. Add relevant keywords from the JD into existing bullet points naturally
4. Prioritize the most important missing keywords (required skills first)
5. Maintain professional tone and readability
6. Keep the same overall structure and length (±10%)
7. Use action verbs and quantifiable achievements
8. Ensure ATS-friendly formatting (no tables, graphics, special characters)

Return the complete rewritten resume text. Do NOT include any explanation or commentary.`,
                },
                {
                    role: "user",
                    content: `ORIGINAL RESUME:
${resume}

TARGET JOB: ${job.title} at ${job.company}

JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

MISSING KEYWORDS TO INCORPORATE (if truthful):
${missingKeywords.slice(0, 15).join(", ")}

KEY JD ENTITIES BY CATEGORY:
${jdEntities
    .slice(0, 20)
    .map((e) => `- ${e.label}: ${e.text} (confidence: ${e.score.toFixed(2)})`)
    .join("\n")}

Rewrite the resume to maximize ATS keyword match while keeping it truthful and readable.`,
                },
            ],
            temperature: 0.4,
            max_tokens: 3000,
        });

        const content = response.choices[0]?.message?.content;
        return content?.trim() || resume;
    } catch (err) {
        console.error("[ResumeAlign] Gemini rewrite failed:", err);
        return resume; // Return original on failure
    }
}

/**
 * Score the human readability of a resume using Gemini.
 */
async function scoreHumanReadability(resume: string): Promise<number> {
    try {
        const response = await getGemini().chat.completions.create({
            model: config.gemini.model,
            messages: [
                {
                    role: "system",
                    content: `Score this resume's readability for a human recruiter on a scale of 0-100.
Consider: clarity, professional tone, logical flow, concrete achievements, brevity.
Return ONLY a JSON object: {"score": number, "reason": "brief explanation"}`,
                },
                { role: "user", content: resume.slice(0, 2000) },
            ],
            temperature: 0.2,
            max_tokens: 100,
        });

        const content = response.choices[0]?.message?.content || '{"score":75}';
        const clean = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(clean);
        return Math.min(100, Math.max(0, parsed.score || 75));
    } catch {
        return 75; // Default score on failure
    }
}

// ─── Fine-Tuning Feedback Loop ──────────────────────────────────────

/**
 * Collect successful alignment data for Pioneer fine-tuning.
 * Once we have enough samples, automatically triggers a
 * fine-tuning job to improve future ATS entity extraction.
 */
function collectTrainingData(alignment: ResumeAlignment): void {
    trainingDataCollector.push({
        resume: alignment.originalResume,
        jobDescription: alignment.jobDescription,
        alignedResume: alignment.alignedResume,
        atsScore: alignment.atsScore,
        entities: [...alignment.resumeEntities, ...alignment.jdEntities],
        timestamp: alignment.createdAt,
    });

    console.log(
        `[ResumeAlign] Training data: ${trainingDataCollector.length}/${FINE_TUNE_THRESHOLD} samples collected`
    );

    // Auto-trigger fine-tuning when threshold is reached
    if (trainingDataCollector.length >= FINE_TUNE_THRESHOLD) {
        triggerAutoFineTune().catch((err) =>
            console.error("[ResumeAlign] Auto fine-tune failed:", err)
        );
    }
}

/**
 * Automatically fine-tune a Pioneer model on collected alignment data.
 * This creates a domain-specific model that gets better at extracting
 * ATS-relevant entities from resumes and JDs over time.
 *
 * The fine-tuned model is then used for future resume alignments,
 * creating a self-improving loop:
 *   User data → Training → Better extraction → Better alignment → More data
 */
async function triggerAutoFineTune(): Promise<void> {
    if (trainingDataCollector.length < FINE_TUNE_THRESHOLD) return;

    console.log(
        `[ResumeAlign] Auto fine-tuning Pioneer model with ${trainingDataCollector.length} samples`
    );

    // Build training samples from alignment data
    // Each sample: the aligned resume text + the entities Pioneer should extract
    const trainingData = trainingDataCollector.map((sample) => ({
        text: sample.alignedResume,
        entities: sample.entities.filter((e) => e.score >= 0.5),
    }));

    try {
        const result = await pioneerService.runFineTuningPipeline({
            datasetName: `ats-resume-alignment-${Date.now()}`,
            modelName: `ats-aligner-v${Math.floor(Date.now() / 86400000)}`,
            trainingData,
            epochs: 5,
        });

        console.log(
            `[ResumeAlign] Fine-tuning job created: ${result.trainingJobId} ` +
            `(status: ${result.status})`
        );

        // Clear collected data after successful upload
        trainingDataCollector.length = 0;
    } catch (err) {
        console.error("[ResumeAlign] Fine-tuning pipeline failed:", err);
    }
}

/**
 * Get the current training data collection status.
 */
export function getTrainingStatus(): {
    samplesCollected: number;
    threshold: number;
    readyForFineTune: boolean;
} {
    return {
        samplesCollected: trainingDataCollector.length,
        threshold: FINE_TUNE_THRESHOLD,
        readyForFineTune: trainingDataCollector.length >= FINE_TUNE_THRESHOLD,
    };
}

/**
 * Manually trigger fine-tuning (from API route).
 */
export async function manualFineTune(): Promise<{
    success: boolean;
    message: string;
    jobId?: string;
}> {
    if (trainingDataCollector.length < 10) {
        return {
            success: false,
            message: `Need at least 10 samples (have ${trainingDataCollector.length})`,
        };
    }

    const trainingData = trainingDataCollector.map((sample) => ({
        text: sample.alignedResume,
        entities: sample.entities.filter((e) => e.score >= 0.5),
    }));

    try {
        const result = await pioneerService.runFineTuningPipeline({
            datasetName: `ats-resume-manual-${Date.now()}`,
            modelName: `ats-aligner-manual-v${Math.floor(Date.now() / 86400000)}`,
            trainingData,
            epochs: 5,
        });

        trainingDataCollector.length = 0;
        return {
            success: true,
            message: result.message,
            jobId: result.trainingJobId,
        };
    } catch (err) {
        return { success: false, message: `Fine-tune failed: ${err}` };
    }
}
