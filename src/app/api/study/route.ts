// ─── Study API — Study Schedule Management ──────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import * as studyPlanner from "@/lib/services/study-planner";
import * as interviewAnalyzer from "@/lib/services/interview-analyzer";
import { v4 as uuid } from "uuid";

// GET — return current study plan + daily challenge
export async function GET() {
    try {
        // Generate daily challenge if none exists for today
        const today = new Date().toISOString().split("T")[0];
        if (!store.dailyChallenge || store.dailyChallenge.date !== today) {
            const challenge = await interviewAnalyzer.generateDailyChallenge();
            store.dailyChallenge = {
                id: uuid(),
                date: today,
                ...challenge,
                completed: false,
                streak: (store.dailyChallenge?.streak || 0) + (store.dailyChallenge?.completed ? 1 : 0),
            };
        }

        return NextResponse.json({
            success: true,
            data: {
                schedule: store.studySchedule,
                dailyChallenge: store.dailyChallenge,
                performanceHistory: store.performanceHistory,
            },
        });
    } catch (err) {
        console.error("[Study API] GET error:", err);
        return NextResponse.json({ success: true, data: { schedule: null, dailyChallenge: null, performanceHistory: [] } });
    }
}

// POST — generate/regenerate study plan
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { availability } = body;

        if (!availability || !Array.isArray(availability)) {
            return NextResponse.json(
                { success: false, error: "availability array is required" },
                { status: 400 }
            );
        }

        const schedule = await studyPlanner.generateStudyPlan(availability);

        return NextResponse.json({ success: true, data: schedule });
    } catch (err) {
        console.error("[Study API] POST error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to generate study plan" },
            { status: 500 }
        );
    }
}

// PUT — update: mark block complete, update availability
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        if (body.action === "complete-block") {
            const success = studyPlanner.completeBlock(body.blockId);
            return NextResponse.json({ success, data: store.studySchedule });
        }

        if (body.action === "complete-challenge") {
            if (store.dailyChallenge) {
                store.dailyChallenge.completed = true;
                store.dailyChallenge.streak++;
            }
            return NextResponse.json({ success: true, data: store.dailyChallenge });
        }

        return NextResponse.json(
            { success: false, error: "Unknown action" },
            { status: 400 }
        );
    } catch (err) {
        console.error("[Study API] PUT error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to update" },
            { status: 500 }
        );
    }
}
