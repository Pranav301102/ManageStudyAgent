// ─── Interviews API ──────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { store, addInterview } from "@/lib/store";
import * as llmService from "@/lib/services/llm-service";
import * as modulateService from "@/lib/services/modulate-service";
import * as interviewAnalyzer from "@/lib/services/interview-analyzer";
import { InterviewSession } from "@/lib/types";

// GET /api/interviews — list all interviews
export async function GET() {
  const interviews = Array.from(store.interviews.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  return NextResponse.json({ success: true, data: interviews });
}

// POST /api/interviews — start a new interview session for a job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;

    const job = store.jobs.get(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Check if there's already a prepared interview for this job
    const existing = Array.from(store.interviews.values()).find(
      (i) => i.jobId === jobId && (i.status === "preparing" || i.status === "active")
    );

    if (existing) {
      existing.status = "active";
      return NextResponse.json({ success: true, data: existing });
    }

    // Generate questions
    const questions = await llmService.generateInterviewQuestions(
      job,
      job.companyIntel,
      job.skillGaps
    );

    const interview: InterviewSession = {
      id: uuid(),
      jobId: job.id,
      job,
      questions,
      currentQuestionIndex: 0,
      status: "active",
      startedAt: new Date().toISOString(),
    };

    addInterview(interview);

    return NextResponse.json({ success: true, data: interview });
  } catch (error) {
    console.error("[Interviews API] Error creating interview:", error);
    return NextResponse.json(
      { error: "Failed to create interview" },
      { status: 500 }
    );
  }
}

// PUT /api/interviews — submit a response to current question
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { interviewId, questionId, transcript, audioBase64, action } = body;

    // Handle ideal answer generation for replay
    if (action === "ideal-answer") {
      const { question, jobTitle, company } = body;
      const ideal = await interviewAnalyzer.generateIdealAnswer(question, jobTitle, company);
      return NextResponse.json({ success: true, data: ideal });
    }

    // Return the stored report for a completed interview
    if (action === "get-report") {
      const interview = store.interviews.get(interviewId);
      if (!interview) {
        return NextResponse.json({ error: "Interview not found" }, { status: 404 });
      }
      if (interview.report) {
        return NextResponse.json({ success: true, data: interview.report });
      }
      return NextResponse.json({ error: "No report available yet" }, { status: 404 });
    }

    // Regenerate a report for a completed interview
    if (action === "regenerate-report") {
      const interview = store.interviews.get(interviewId);
      if (!interview) {
        return NextResponse.json({ error: "Interview not found" }, { status: 404 });
      }
      if (interview.status !== "completed") {
        return NextResponse.json({ error: "Interview not completed" }, { status: 400 });
      }
      const report = await interviewAnalyzer.generateInterviewReport(interview);
      interview.report = report;
      store.interviews.set(interview.id, interview);
      return NextResponse.json({ success: true, data: report });
    }

    const interview = store.interviews.get(interviewId);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const question = interview.questions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    question.response = transcript;

    // Evaluate content via LLM
    const evaluation = await llmService.evaluateResponse(
      question.text,
      transcript,
      interview.job
    );
    question.contentScore = evaluation.score;
    question.feedback = evaluation.feedback;

    // Analyze voice via Modulate
    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, "base64");
      question.voiceAnalysis = await modulateService.analyzeVoice(
        audioBuffer,
        `Interview question: ${question.text}`
      );
      question.deliveryScore = modulateService.computeVoiceScore(question.voiceAnalysis) / 20; // normalize to 1-5
    } else {
      // Analyze transcript for filler words at minimum
      const fillerAnalysis = modulateService.analyzeTranscriptFillers(transcript);
      question.voiceAnalysis = {
        confidence: 70,
        clarity: 75,
        pace: 65,
        sentiment: "neutral",
        emotion: "engaged",
        fillerWordCount: fillerAnalysis.fillerCount,
        duration: 0,
      };
      question.deliveryScore = modulateService.computeVoiceScore(question.voiceAnalysis) / 20;
    }

    // Advance to next question
    interview.currentQuestionIndex++;

    // Check if interview is complete
    if (interview.currentQuestionIndex >= interview.questions.length) {
      interview.status = "completed";
      interview.completedAt = new Date().toISOString();

      // Compute overall score
      const answeredQuestions = interview.questions.filter((q) => q.contentScore);
      if (answeredQuestions.length > 0) {
        const avgContent =
          answeredQuestions.reduce((sum, q) => sum + (q.contentScore || 0), 0) /
          answeredQuestions.length;
        const avgDelivery =
          answeredQuestions.reduce((sum, q) => sum + (q.deliveryScore || 0), 0) /
          answeredQuestions.length;
        interview.overallScore = Math.round(((avgContent + avgDelivery) / 2) * 20);
        interview.overallFeedback = `Content: ${avgContent.toFixed(1)}/5, Delivery: ${avgDelivery.toFixed(1)}/5`;
      }

      // Post-interview: auto-analyze performance, update skills & study plan
      interviewAnalyzer.analyzePerformance(interview).catch((err) =>
        console.error("[Interviews API] Post-interview analysis failed:", err)
      );

      // Auto-generate comprehensive interview report
      interviewAnalyzer.generateInterviewReport(interview).then((report) => {
        interview.report = report;
        store.interviews.set(interview.id, interview);
        console.log(`[Interviews API] Report generated for interview ${interview.id}`);
      }).catch((err) =>
        console.error("[Interviews API] Report generation failed:", err)
      );
    }

    store.interviews.set(interview.id, interview);

    return NextResponse.json({
      success: true,
      data: {
        question,
        nextQuestionIndex: interview.currentQuestionIndex,
        isComplete: interview.status === "completed",
        overallScore: interview.overallScore,
      },
    });
  } catch (error) {
    console.error("[Interviews API] Error submitting response:", error);
    return NextResponse.json(
      { error: "Failed to process response" },
      { status: 500 }
    );
  }
}
