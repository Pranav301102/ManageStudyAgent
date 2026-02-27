// ─── API Route: Analyze Whiteboard (Reka Vision) ────────────────────
// POST /api/interviews/analyze-whiteboard
// Sends a whiteboard snapshot to Reka Vision for architectural analysis.

import { NextRequest, NextResponse } from "next/server";
import { analyzeWhiteboard } from "@/lib/services/reka-service";

export async function POST(req: NextRequest) {
    try {
        const { imageBase64, context } = await req.json();

        if (!imageBase64) {
            return NextResponse.json(
                { success: false, error: "Image data is required" },
                { status: 400 }
            );
        }

        const analysis = await analyzeWhiteboard(
            imageBase64,
            context || "System design interview whiteboard"
        );

        return NextResponse.json({
            success: true,
            data: analysis,
        });
    } catch (err) {
        console.error("[API] analyze-whiteboard error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to analyze whiteboard" },
            { status: 500 }
        );
    }
}
