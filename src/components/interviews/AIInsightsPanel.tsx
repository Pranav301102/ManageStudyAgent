"use client";

import { ExtractedEntity } from "@/lib/types";
import { Brain, Sparkles, Code, Pencil } from "lucide-react";

interface Props {
    extractedSkills: ExtractedEntity[];
    codeAnalysis?: string;
    whiteboardAnalysis?: string;
    hint?: string;
}

export default function AIInsightsPanel({
    extractedSkills,
    codeAnalysis,
    whiteboardAnalysis,
    hint,
}: Props) {
    const skillsByLabel = extractedSkills.reduce(
        (acc, entity) => {
            const label = entity.label.replace(/_/g, " ");
            if (!acc[label]) acc[label] = [];
            acc[label].push(entity);
            return acc;
        },
        {} as Record<string, ExtractedEntity[]>
    );

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                AI Insights
                <span className="text-[10px] text-slate-500 font-normal">Live</span>
            </h3>

            <div className="space-y-4">
                {/* Extracted Skills */}
                {extractedSkills.length > 0 && (
                    <div>
                        <div className="flex items-center gap-1 mb-2">
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                                Detected Skills
                            </span>
                        </div>
                        <div className="space-y-2">
                            {Object.entries(skillsByLabel).map(([label, entities]) => (
                                <div key={label}>
                                    <span className="text-[10px] text-slate-500 capitalize">
                                        {label}
                                    </span>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                        {entities.map((e, i) => (
                                            <span
                                                key={i}
                                                className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] border border-emerald-500/20"
                                                title={`Confidence: ${(e.score * 100).toFixed(0)}%`}
                                            >
                                                {e.text}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Code Analysis */}
                {codeAnalysis && (
                    <div>
                        <div className="flex items-center gap-1 mb-1">
                            <Code className="w-3 h-3 text-indigo-400" />
                            <span className="text-[10px] text-indigo-400 font-medium uppercase tracking-wider">
                                Code Analysis
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            {codeAnalysis}
                        </p>
                    </div>
                )}

                {/* Whiteboard Analysis */}
                {whiteboardAnalysis && (
                    <div>
                        <div className="flex items-center gap-1 mb-1">
                            <Pencil className="w-3 h-3 text-cyan-400" />
                            <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">
                                Whiteboard
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            {whiteboardAnalysis}
                        </p>
                    </div>
                )}

                {/* Hint */}
                {hint && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 mt-2">
                        <p className="text-[11px] text-amber-300 leading-relaxed">
                            💡 {hint}
                        </p>
                    </div>
                )}

                {/* Empty state */}
                {extractedSkills.length === 0 && !codeAnalysis && !whiteboardAnalysis && !hint && (
                    <p className="text-xs text-slate-600 italic text-center py-4">
                        AI insights will appear here as you code, draw, and speak...
                    </p>
                )}
            </div>
        </div>
    );
}
