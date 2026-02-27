// ─── API Route: Resume Auto-Alignment (Pioneer + Gemini) ────────────
// POST /api/resume
//
// Actions:
//   { action: "analyze", resume, jobDescription }
//     → ATS analysis: entity overlap, missing keywords, scores
//
//   { action: "align", resume, jobDescription, jobId }
//     → Full alignment: rewrite resume, re-verify ATS, score
//
//   { action: "training_status" }
//     → How many alignment samples collected for fine-tuning
//
//   { action: "trigger_finetune" }
//     → Manually trigger Pioneer fine-tuning on collected data

import { NextRequest, NextResponse } from "next/server";
import * as resumeAlignment from "@/lib/services/resume-alignment";
import { store } from "@/lib/store";
import { Job } from "@/lib/types";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        switch (action) {
            // ─── Analyze Resume-JD Match ─────────────────────────────
            case "analyze": {
                const { resume, jobDescription } = body;
                if (!resume || !jobDescription) {
                    return NextResponse.json(
                        { success: false, error: "resume and jobDescription are required" },
                        { status: 400 }
                    );
                }

                const analysis = await resumeAlignment.analyzeResumeMatch(
                    resume,
                    jobDescription
                );

                return NextResponse.json({
                    success: true,
                    data: { analysis },
                });
            }

            // ─── Full Resume Alignment ───────────────────────────────
            case "align": {
                const { resume, jobDescription, jobId } = body;
                if (!resume || !jobDescription) {
                    return NextResponse.json(
                        { success: false, error: "resume and jobDescription are required" },
                        { status: 400 }
                    );
                }

                // Resolve job from store or create a minimal one
                let job: Job;
                if (jobId && store.jobs.has(jobId)) {
                    job = store.jobs.get(jobId) as Job;
                } else {
                    job = {
                        id: jobId || `manual-${Date.now()}`,
                        title: body.jobTitle || "Target Role",
                        company: body.company || "Target Company",
                        location: "",
                        url: "",
                        description: jobDescription,
                        requiredSkills: [],
                        preferredSkills: [],
                        techStack: [],
                        postedDate: new Date().toISOString(),
                        discoveredAt: new Date().toISOString(),
                        matchScore: 0,
                        skillGaps: [],
                        interviewReady: false,
                        status: "discovered",
                    };
                }

                const alignment = await resumeAlignment.alignResume(
                    resume,
                    jobDescription,
                    job
                );

                return NextResponse.json({
                    success: true,
                    data: {
                        alignment: {
                            id: alignment.id,
                            alignedResume: alignment.alignedResume,
                            atsScore: alignment.atsScore,
                            humanScore: alignment.humanScore,
                            overallScore: alignment.overallScore,
                            missingKeywords: alignment.missingKeywords,
                            addedKeywords: alignment.addedKeywords,
                            suggestions: alignment.suggestions,
                            resumeEntities: alignment.resumeEntities.length,
                            jdEntities: alignment.jdEntities.length,
                            alignedEntities: alignment.alignedEntities.length,
                            modelVersion: alignment.modelVersion,
                        },
                    },
                });
            }

            // ─── Bulk Align — align resume to all discovered jobs ────
            case "align_all": {
                const { resume } = body;
                if (!resume) {
                    return NextResponse.json(
                        { success: false, error: "resume is required" },
                        { status: 400 }
                    );
                }

                const jobs = Array.from(store.jobs.values()) as Job[];
                const analyzedJobs = jobs.filter(
                    (j) => j.status !== "discovered" && j.description
                );

                if (analyzedJobs.length === 0) {
                    return NextResponse.json({
                        success: true,
                        data: { alignments: [], message: "No analyzed jobs to align to" },
                    });
                }

                // Align to top 5 jobs by match score (avoid overwhelming the API)
                const topJobs = analyzedJobs
                    .sort((a, b) => b.matchScore - a.matchScore)
                    .slice(0, 5);

                const alignments = [];
                for (const job of topJobs) {
                    try {
                        const alignment = await resumeAlignment.alignResume(
                            resume,
                            job.description,
                            job
                        );
                        alignments.push({
                            jobId: job.id,
                            jobTitle: job.title,
                            company: job.company,
                            atsScore: alignment.atsScore,
                            humanScore: alignment.humanScore,
                            overallScore: alignment.overallScore,
                            missingKeywords: alignment.missingKeywords.slice(0, 5),
                        });
                    } catch (err) {
                        console.warn(`[Resume API] Failed to align to ${job.title}:`, err);
                    }
                }

                return NextResponse.json({
                    success: true,
                    data: { alignments },
                });
            }

            // ─── Fine-Tuning Status ──────────────────────────────────
            case "training_status": {
                const status = resumeAlignment.getTrainingStatus();
                return NextResponse.json({
                    success: true,
                    data: { training: status },
                });
            }

            // ─── Manual Fine-Tune Trigger ────────────────────────────
            case "trigger_finetune": {
                const result = await resumeAlignment.manualFineTune();
                return NextResponse.json({
                    success: result.success,
                    data: result,
                });
            }

            default:
                return NextResponse.json(
                    { success: false, error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }
    } catch (err) {
        console.error("[API] Resume alignment error:", err);
        return NextResponse.json(
            { success: false, error: `Resume alignment error: ${err}` },
            { status: 500 }
        );
    }
}
