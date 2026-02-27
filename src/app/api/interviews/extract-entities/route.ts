// ─── API Route: Extract Entities (GLiNER) ───────────────────────────
// POST /api/interviews/extract-entities
// Runs GLiNER on transcript or code text for real-time skill extraction.

import { NextRequest, NextResponse } from "next/server";
import { extractEntities, extractJDSkills } from "@/lib/services/gliner-service";

export async function POST(req: NextRequest) {
    try {
        const { text, source } = await req.json();

        if (!text) {
            return NextResponse.json(
                { success: false, error: "Text is required" },
                { status: 400 }
            );
        }

        // Use JD-optimized extraction for job descriptions
        const entities = source === "jd"
            ? await extractJDSkills(text)
            : await extractEntities(text);

        return NextResponse.json({
            success: true,
            data: { entities },
        });
    } catch (err) {
        console.error("[API] extract-entities error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to extract entities" },
            { status: 500 }
        );
    }
}
