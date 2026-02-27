// ─── API Route: Analyze Code (Local Eval + GLiNER) ──────────────────
// POST /api/interviews/analyze-code
// Evaluates code locally and extracts entities via GLiNER microservice.

import { NextRequest, NextResponse } from "next/server";
import { evaluateCodeSnippet } from "@/lib/services/fastino-service";
import { extractFromCode } from "@/lib/services/gliner-service";

export async function POST(req: NextRequest) {
    try {
        const { code, language, problemContext } = await req.json();

        if (!code) {
            return NextResponse.json(
                { success: false, error: "Code is required" },
                { status: 400 }
            );
        }

        // Run both analyses in parallel
        const [codeEval, extractedEntities] = await Promise.all([
            evaluateCodeSnippet(code, language || "python", problemContext || ""),
            extractFromCode(code, language || "python"),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                evaluation: codeEval,
                extractedEntities,
            },
        });
    } catch (err) {
        console.error("[API] analyze-code error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to analyze code" },
            { status: 500 }
        );
    }
}
