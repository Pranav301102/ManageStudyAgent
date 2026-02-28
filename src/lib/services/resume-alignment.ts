// ─── Resume Alignment Service — Pioneer-Powered Auto-ATS Optimizer ──
// Automatically aligns a user's resume to each discovered job description
// using Pioneer's full model stack (no external LLM dependencies):
//
//   1. Pioneer GLiNER-2 extracts entities from BOTH the resume & JD
//   2. Computes entity overlap → identifies missing keywords/skills
//   3. Pioneer Llama-3.1-8B-Instruct rewrites resume sections naturally
//   4. Pioneer GLiNER-2 re-extracts from aligned resume → verifies ATS match
//   5. Pioneer LLM scores ATS pass probability + human-readability
//   6. Collects (resume, JD, aligned_resume, score) pairs for fine-tuning
//   7. Periodically fine-tunes a Pioneer GLiNER model on alignment data
//      → better ATS-optimized entity extraction over time
//
// The entire flow runs in the background when a new job is discovered.
// All inference runs through Pioneer API — GLiNER-2 for NER, Llama for generation.

import { config } from "../config";
import { ExtractedEntity, Job, UserProfile, ResumeFeedback, AlignedResumeRecord } from "../types";
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

// ─── Default resume + alignment history (SQLite-persisted) ──────────

import { getSetting, setSetting, getDb } from "../db";

let defaultResume: string = "";
let alignmentHistory: AlignedResumeRecord[] | null = null; // lazy-loaded
const feedbackLog: ResumeFeedback[] = [];

export function saveDefaultResume(resume: string): void {
    defaultResume = resume;
    setSetting("default_resume", resume);
    console.log(`[ResumeAlign] Default resume saved (${resume.length} chars)`);
}

export function getDefaultResume(): string {
    if (!defaultResume) {
        const persisted = getSetting("default_resume");
        if (persisted) {
            defaultResume = persisted;
        }
    }
    return defaultResume;
}

function loadAlignmentHistory(): AlignedResumeRecord[] {
    if (alignmentHistory !== null) return alignmentHistory;
    try {
        const rows = getDb()
            .prepare("SELECT data FROM resume_alignments ORDER BY created_at DESC")
            .all() as { data: string }[];
        alignmentHistory = rows.map((r) => JSON.parse(r.data) as AlignedResumeRecord);
    } catch {
        alignmentHistory = [];
    }
    return alignmentHistory;
}

function persistAlignment(record: AlignedResumeRecord): void {
    try {
        getDb().prepare(
            "INSERT OR REPLACE INTO resume_alignments (id, job_id, data) VALUES (?, ?, ?)"
        ).run(record.alignment.id, record.alignment.jobId, JSON.stringify(record));
    } catch (err) {
        console.warn("[ResumeAlign] Failed to persist alignment:", err);
    }
}

function persistAlignmentUpdate(record: AlignedResumeRecord): void {
    try {
        getDb().prepare(
            "UPDATE resume_alignments SET data = ? WHERE id = ?"
        ).run(JSON.stringify(record), record.alignment.id);
    } catch (err) {
        console.warn("[ResumeAlign] Failed to update alignment:", err);
    }
}

export function getAlignmentHistory(): AlignedResumeRecord[] {
    return loadAlignmentHistory();
}

export function getAlignmentById(id: string): AlignedResumeRecord | undefined {
    return loadAlignmentHistory().find((r) => r.alignment.id === id);
}

/**
 * Submit feedback on an alignment — feeds into Pioneer fine-tuning loop.
 * If status is "bad" and a preferredVersion is supplied, we treat the user's
 * version as a GOLD STANDARD label for training.
 */
export function submitFeedback(feedback: ResumeFeedback): {
    accepted: boolean;
    trainingSamplesCollected: number;
} {
    feedbackLog.push(feedback);

    const history = loadAlignmentHistory();
    const record = history.find(
        (r) => r.alignment.id === feedback.alignmentId
    );
    if (record) {
        record.feedback = feedback;
        persistAlignmentUpdate(record);
    }

    // Use feedback to enrich training data:
    // - "good" → alignment is correct, use as positive sample
    // - "needs_improvement" / "bad" → alignment needs refinement
    // - If user provides preferredVersion → gold-standard label pair
    if (record) {
        const goldResume = feedback.preferredVersion || record.alignment.alignedResume;
        const isPositive = feedback.rating === "good";

        const sample: AlignmentTrainingSample = {
            resume: record.alignment.originalResume,
            jobDescription: record.alignment.jobDescription,
            alignedResume: goldResume,
            atsScore: isPositive ? record.alignment.atsScore : Math.max(0, record.alignment.atsScore - 20),
            entities: [
                ...record.alignment.resumeEntities,
                ...record.alignment.jdEntities,
            ],
            timestamp: feedback.timestamp,
            feedbackRating: feedback.rating,
        };
        const samples = loadTrainingData();
        samples.push(sample);
        persistTrainingSample(sample);

        console.log(
            `[ResumeAlign] Feedback received: ${feedback.rating} for ${feedback.alignmentId}` +
            ` | Training samples: ${samples.length}/${FINE_TUNE_THRESHOLD}`
        );

        // Auto-trigger fine-tuning when threshold is reached
        if (samples.length >= FINE_TUNE_THRESHOLD) {
            triggerAutoFineTune().catch((err) =>
                console.error("[ResumeAlign] Auto fine-tune failed:", err)
            );
        }
    }

    return {
        accepted: true,
        trainingSamplesCollected: loadTrainingData().length,
    };
}

export function getFeedbackStats(): {
    total: number;
    good: number;
    needsImprovement: number;
    bad: number;
    feedbackLog: ResumeFeedback[];
} {
    return {
        total: feedbackLog.length,
        good: feedbackLog.filter((f) => f.rating === "good").length,
        needsImprovement: feedbackLog.filter((f) => f.rating === "needs_improvement").length,
        bad: feedbackLog.filter((f) => f.rating === "bad").length,
        feedbackLog: feedbackLog.slice(-20), // last 20
    };
}

// ─── Training data collector for Pioneer fine-tuning ────────────────

interface AlignmentTrainingSample {
    resume: string;
    jobDescription: string;
    alignedResume: string;
    atsScore: number;
    entities: ExtractedEntity[];
    timestamp: string;
    feedbackRating?: string;  // user feedback enriches training signal
}

// SQLite-backed collector — persists across restarts
let trainingDataCollector: AlignmentTrainingSample[] | null = null; // lazy-loaded
const FINE_TUNE_THRESHOLD = 50; // collect N samples before auto-fine-tuning

function loadTrainingData(): AlignmentTrainingSample[] {
    if (trainingDataCollector !== null) return trainingDataCollector;
    try {
        const rows = getDb()
            .prepare("SELECT data FROM training_samples ORDER BY created_at ASC")
            .all() as { data: string }[];
        trainingDataCollector = rows.map((r) => JSON.parse(r.data) as AlignmentTrainingSample);
        console.log(`[ResumeAlign] Loaded ${trainingDataCollector.length} training samples from DB`);
    } catch {
        trainingDataCollector = [];
    }
    return trainingDataCollector;
}

function persistTrainingSample(sample: AlignmentTrainingSample): void {
    try {
        getDb().prepare(
            "INSERT INTO training_samples (data, feedback_rating) VALUES (?, ?)"
        ).run(JSON.stringify(sample), sample.feedbackRating || null);
    } catch (err) {
        console.warn("[ResumeAlign] Failed to persist training sample:", err);
    }
}

function clearPersistedTrainingData(): void {
    try {
        getDb().prepare("DELETE FROM training_samples").run();
    } catch (err) {
        console.warn("[ResumeAlign] Failed to clear training samples:", err);
    }
}

// (Pioneer LLM is accessed via pioneerService.generate() — no separate client needed)

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
    const humanScore = 80; // placeholder — overridden by Pioneer LLM scoring below
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
 * Use Pioneer LLM to rewrite the resume, weaving in missing JD keywords
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

    // Step 3: Use Pioneer LLM to rewrite resume sections
    const alignedResume = await rewriteWithPioneer(
        resume,
        jobDescription,
        job,
        analysis.missingKeywords,
        jdEntities
    );

    // Step 4: Re-extract entities from aligned resume using Pioneer GLiNER-2
    const alignedEntities = await extractResumeEntities(alignedResume);

    // Step 5: Compute new ATS score
    const postAnalysis = await analyzeResumeMatch(alignedResume, jobDescription);

    // Step 6: Score human readability via Pioneer LLM
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

    // Step 8: Store in alignment history (memory + SQLite)
    const record: AlignedResumeRecord = {
        alignment,
        jobTitle: job.title,
        company: job.company,
    };
    loadAlignmentHistory().unshift(record);
    persistAlignment(record);

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

// ─── Pioneer LLM Rewrite ────────────────────────────────────────────

/**
 * Use Pioneer's Llama-3.1-8B-Instruct to intelligently rewrite resume
 * sections, incorporating missing JD keywords naturally.
 * Combined with GLiNER-2 entity verification for robust ATS optimization.
 */
async function rewriteWithPioneer(
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
        const systemPrompt = `You are an expert ATS resume optimizer. Rewrite the resume to better align with the job description while maintaining truthfulness.

RULES:
1. NEVER fabricate experience or skills the candidate doesn't have
2. Reframe existing experience using JD terminology where applicable
3. Add relevant keywords from the JD into existing bullet points naturally
4. Prioritize the most important missing keywords (required skills first)
5. Maintain professional tone and readability
6. Keep the same overall structure and length (±10%)
7. Use action verbs and quantifiable achievements
8. Ensure ATS-friendly formatting (no tables, graphics, special characters)

Return ONLY the complete rewritten resume text. No explanation or commentary.`;

        const userPrompt = `ORIGINAL RESUME:
${resume}

TARGET JOB: ${job.title} at ${job.company}

JOB DESCRIPTION:
${jobDescription.slice(0, 1500)}

MISSING KEYWORDS TO INCORPORATE (if truthful):
${missingKeywords.slice(0, 15).join(", ")}

KEY JD ENTITIES BY CATEGORY:
${jdEntities
    .slice(0, 20)
    .map((e) => `- ${e.label}: ${e.text}`)
    .join("\n")}

Rewrite the resume to maximize ATS keyword match while keeping it truthful and readable.`;

        const completion = await pioneerService.generate(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            { maxTokens: 3000 }
        );

        const result = completion.trim();
        if (result.length < 100) {
            console.warn("[ResumeAlign] Pioneer LLM returned short response, keeping original");
            return resume;
        }

        // Verify with GLiNER-2: does the rewrite actually contain more JD entities?
        const postEntities = await pioneerService.inference(
            result,
            ["programming_language", "framework", "tool", "methodology", "cloud_service"],
            { threshold: 0.35 }
        ).catch(() => []);

        const preEntities = await pioneerService.inference(
            resume,
            ["programming_language", "framework", "tool", "methodology", "cloud_service"],
            { threshold: 0.35 }
        ).catch(() => []);

        if (postEntities.length < preEntities.length * 0.5) {
            console.warn(
                `[ResumeAlign] Rewrite lost entities (${preEntities.length}→${postEntities.length}), keeping original`
            );
            return resume;
        }

        console.log(
            `[ResumeAlign] Pioneer LLM rewrite: ${preEntities.length}→${postEntities.length} entities`
        );
        return result;
    } catch (err) {
        console.error("[ResumeAlign] Pioneer LLM rewrite failed:", err);
        return resume; // Return original on failure
    }
}

/**
 * Score the human readability of a resume using Pioneer's LLM.
 * GLiNER-2 cross-validates by checking entity density (over-stuffed = low readability).
 */
async function scoreHumanReadability(resume: string): Promise<number> {
    try {
        // Dual scoring: LLM qualitative + GLiNER-2 entity-density heuristic
        const [llmScore, entities] = await Promise.all([
            // LLM readability assessment
            pioneerService.generate(
                [
                    {
                        role: "system",
                        content: `Score this resume's readability for a human recruiter on a scale of 0-100.
Consider: clarity, professional tone, logical flow, concrete achievements, brevity.
Return ONLY a JSON object: {"score": <number>, "reason": "<brief explanation>"}`,
                    },
                    { role: "user", content: resume.slice(0, 1500) },
                ],
                { maxTokens: 150 }
            ).catch(() => '{"score":75}'),
            // Entity density check — over-stuffed resumes score lower
            pioneerService.inference(
                resume.slice(0, 1500),
                ["programming_language", "framework", "tool", "methodology"],
                { threshold: 0.3 }
            ).catch(() => []),
        ]);

        // Parse LLM score
        const clean = llmScore.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        // Try to extract JSON from response, handle cases where LLM adds extra text
        const jsonMatch = clean.match(/\{[^}]*"score"\s*:\s*(\d+)[^}]*\}/);
        let score = 75;
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                score = parsed.score || 75;
            } catch {
                score = parseInt(jsonMatch[1]) || 75;
            }
        }

        // Entity density penalty: if >40 entities per 1000 chars, resume is keyword-stuffed
        const wordCount = resume.split(/\s+/).length;
        const entityDensity = entities.length / Math.max(1, wordCount / 100);
        const densityPenalty = entityDensity > 8 ? Math.min(15, (entityDensity - 8) * 3) : 0;

        const finalScore = Math.min(100, Math.max(0, Math.round(score - densityPenalty)));
        console.log(
            `[ResumeAlign] Readability: LLM=${score}, entities=${entities.length}, ` +
            `density=${entityDensity.toFixed(1)}, penalty=${densityPenalty.toFixed(0)}, final=${finalScore}`
        );
        return finalScore;
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
    const sample: AlignmentTrainingSample = {
        resume: alignment.originalResume,
        jobDescription: alignment.jobDescription,
        alignedResume: alignment.alignedResume,
        atsScore: alignment.atsScore,
        entities: [...alignment.resumeEntities, ...alignment.jdEntities],
        timestamp: alignment.createdAt,
    };
    const samples = loadTrainingData();
    samples.push(sample);
    persistTrainingSample(sample);

    console.log(
        `[ResumeAlign] Training data: ${samples.length}/${FINE_TUNE_THRESHOLD} samples collected`
    );

    // Auto-trigger fine-tuning when threshold is reached
    if (samples.length >= FINE_TUNE_THRESHOLD) {
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
    const samples = loadTrainingData();
    if (samples.length < FINE_TUNE_THRESHOLD) return;

    console.log(
        `[ResumeAlign] Auto fine-tuning Pioneer model with ${samples.length} samples`
    );

    // Build training samples from alignment data
    // Each sample: the aligned resume text + the entities Pioneer should extract
    const trainingData = samples.map((sample) => ({
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

        // Clear collected data after successful upload (memory + DB)
        samples.length = 0;
        trainingDataCollector = [];
        clearPersistedTrainingData();
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
    const samples = loadTrainingData();
    return {
        samplesCollected: samples.length,
        threshold: FINE_TUNE_THRESHOLD,
        readyForFineTune: samples.length >= FINE_TUNE_THRESHOLD,
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
    const samples = loadTrainingData();
    if (samples.length < 10) {
        return {
            success: false,
            message: `Need at least 10 samples (have ${samples.length})`,
        };
    }

    const trainingData = samples.map((sample) => ({
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

        // Clear collected data after successful upload (memory + DB)
        trainingDataCollector = [];
        clearPersistedTrainingData();
        return {
            success: true,
            message: result.message,
            jobId: result.trainingJobId,
        };
    } catch (err) {
        return { success: false, message: `Fine-tune failed: ${err}` };
    }
}
