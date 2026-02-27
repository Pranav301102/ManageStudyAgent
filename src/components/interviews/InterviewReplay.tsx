"use client";

import { useState } from "react";
import { InterviewQuestion } from "@/lib/types";
import {
    RotateCcw,
    MessageSquare,
    Star,
    Mic,
    Loader2,
    ChevronDown,
    ChevronRight,
} from "lucide-react";

interface Props {
    questions: InterviewQuestion[];
    jobTitle: string;
    company: string;
    overallScore?: number;
}

/** Post-interview replay: review each Q&A with AI ideal answer comparison. */
export default function InterviewReplay({ questions, jobTitle, company, overallScore }: Props) {
    const [idealAnswers, setIdealAnswers] = useState<Record<string, string>>({});
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const loadIdealAnswer = async (questionId: string, questionText: string) => {
        if (idealAnswers[questionId]) return;
        setLoadingId(questionId);
        try {
            const res = await fetch("/api/interviews", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "ideal-answer",
                    question: questionText,
                    jobTitle,
                    company,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setIdealAnswers((prev) => ({ ...prev, [questionId]: data.data }));
            }
        } catch (err) {
            console.error("Failed to load ideal answer:", err);
        } finally {
            setLoadingId(null);
        }
    };

    const scoreColor = (score?: number) => {
        if (!score) return "text-slate-500";
        if (score >= 4) return "text-emerald-400";
        if (score >= 3) return "text-amber-400";
        return "text-red-400";
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-purple-400" />
                    Interview Replay
                </h3>
                {overallScore !== undefined && (
                    <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-sm font-bold text-white">{overallScore}/5</span>
                    </div>
                )}
            </div>

            <p className="text-xs text-slate-400 mb-4">
                {jobTitle} at {company} · {questions.length} questions
            </p>

            <div className="space-y-2">
                {questions.map((q, idx) => (
                    <div key={q.id} className="rounded-lg border border-slate-700/50 overflow-hidden">
                        {/* Question header */}
                        <button
                            onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/30 transition-colors text-left"
                        >
                            <span className="text-[10px] text-slate-600 w-5">{idx + 1}</span>
                            {expandedId === q.id ? (
                                <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            ) : (
                                <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            )}
                            <span className="text-xs text-white flex-1 truncate">{q.text}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${q.type === "technical" ? "bg-indigo-500/15 text-indigo-400" :
                                    q.type === "behavioral" ? "bg-amber-500/15 text-amber-400" :
                                        q.type === "coding" ? "bg-cyan-500/15 text-cyan-400" :
                                            "bg-slate-700 text-slate-400"
                                }`}>
                                {q.type}
                            </span>
                            <span className={`text-xs font-medium ${scoreColor(q.contentScore)}`}>
                                {q.contentScore ? `${q.contentScore}/5` : "—"}
                            </span>
                        </button>

                        {/* Expanded content */}
                        {expandedId === q.id && (
                            <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30">
                                {/* Your Answer */}
                                <div className="mt-3">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                                        Your Answer
                                    </p>
                                    <p className="text-xs text-slate-400 leading-relaxed bg-slate-900 rounded p-2">
                                        {q.response || <em className="text-slate-600">No response recorded</em>}
                                    </p>
                                </div>

                                {/* Feedback */}
                                {q.feedback && (
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                                            AI Feedback
                                        </p>
                                        <p className="text-xs text-indigo-400/80 leading-relaxed bg-indigo-500/5 rounded p-2 border border-indigo-500/10">
                                            {q.feedback}
                                        </p>
                                    </div>
                                )}

                                {/* Voice analysis */}
                                {q.voiceAnalysis && (
                                    <div className="flex items-center gap-4">
                                        <Mic className="w-3 h-3 text-slate-500" />
                                        <div className="flex gap-3 text-[10px]">
                                            <span className="text-slate-400">
                                                Confidence: <strong className={scoreColor(Math.round(q.voiceAnalysis.confidence / 20))}>{q.voiceAnalysis.confidence}%</strong>
                                            </span>
                                            <span className="text-slate-400">
                                                Clarity: <strong>{q.voiceAnalysis.clarity}%</strong>
                                            </span>
                                            <span className="text-slate-400">
                                                Fillers: <strong>{q.voiceAnalysis.fillerWordCount}</strong>
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Ideal Answer */}
                                <div>
                                    {idealAnswers[q.id] ? (
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                                                💡 Ideal Answer
                                            </p>
                                            <p className="text-xs text-emerald-400/80 leading-relaxed bg-emerald-500/5 rounded p-2 border border-emerald-500/10">
                                                {idealAnswers[q.id]}
                                            </p>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => loadIdealAnswer(q.id, q.text)}
                                            disabled={loadingId === q.id}
                                            className="flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            {loadingId === q.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <MessageSquare className="w-3 h-3" />
                                            )}
                                            {loadingId === q.id ? "Generating..." : "Show ideal answer"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
