// ─── Library API — Memory Library Management ────────────────────────
// GET  /api/library — returns the full memory library
// POST /api/library — imports a library from JSON (merge)
// PUT  /api/library — triggers AI scout auto-generation + optimization

import { NextRequest, NextResponse } from "next/server";
import * as memoryLibrary from "@/lib/services/memory-library";
import * as scoutIntelligence from "@/lib/services/scout-intelligence";
import { store } from "@/lib/store";
import { autoGenerateScouts } from "@/lib/services/orchestrator";

// GET — return the full memory library
export async function GET() {
    try {
        const library = await memoryLibrary.loadMemory();
        return NextResponse.json({ success: true, data: library });
    } catch (err) {
        console.error("[Library API] Load failed:", err);
        return NextResponse.json(
            { success: false, error: "Failed to load library" },
            { status: 500 }
        );
    }
}

// POST — import a library from another user
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { libraryJson } = body;

        if (!libraryJson) {
            return NextResponse.json(
                { success: false, error: "libraryJson is required" },
                { status: 400 }
            );
        }

        const result = await memoryLibrary.importLibrary(
            typeof libraryJson === "string" ? libraryJson : JSON.stringify(libraryJson)
        );

        return NextResponse.json({
            success: true,
            data: {
                scoutsAdded: result.scoutsAdded,
                sourcesAdded: result.sourcesAdded,
                message: `Imported ${result.scoutsAdded} scouts and ${result.sourcesAdded} sources.`,
            },
        });
    } catch (err) {
        console.error("[Library API] Import failed:", err);
        return NextResponse.json(
            { success: false, error: "Failed to import library" },
            { status: 500 }
        );
    }
}

// PUT — trigger AI to auto-generate/optimize scouts
export async function PUT() {
    try {
        const { profile } = store;

        // Generate new smart scouts
        const createdScouts = await autoGenerateScouts();

        // Suggest new sources to monitor
        const existingScouts = Array.from(store.scouts.values());
        const suggestedSources = await scoutIntelligence.suggestNewSources(
            profile,
            existingScouts
        );

        // Update library with suggested sources
        const library = await memoryLibrary.loadMemory();
        for (const source of suggestedSources) {
            const exists = library.discoveredSources.some(
                (s) => s.company.toLowerCase() === source.company.toLowerCase()
            );
            if (!exists) {
                library.discoveredSources.push({
                    company: source.company,
                    careerPageUrl: source.careerPageUrl,
                    jobsFound: 0,
                    relevanceScore: 0,
                    addedAt: new Date().toISOString(),
                });
            }
        }
        library.insights.emergingCompanies = suggestedSources.map((s) => s.company);
        await memoryLibrary.saveMemory(library);

        return NextResponse.json({
            success: true,
            data: {
                scoutsGenerated: createdScouts.length,
                sourceSuggestions: suggestedSources,
                message: `AI generated ${createdScouts.length} scouts and suggested ${suggestedSources.length} new sources.`,
            },
        });
    } catch (err) {
        console.error("[Library API] Auto-generate failed:", err);
        return NextResponse.json(
            { success: false, error: "Failed to auto-generate scouts" },
            { status: 500 }
        );
    }
}
