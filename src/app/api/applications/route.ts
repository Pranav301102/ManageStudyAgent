// ─── Applications API — Application Tracker ─────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { store, addApplication } from "@/lib/store";
import { Application, ApplicationStatus, ApplicationEvent } from "@/lib/types";

// GET — list all applications
export async function GET() {
    const apps = Array.from(store.applications.values());
    return NextResponse.json({ success: true, data: apps });
}

// POST — create application from a job
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId, notes, interviewDate } = body;

        const job = store.jobs.get(jobId);
        if (!job) {
            return NextResponse.json(
                { success: false, error: "Job not found" },
                { status: 404 }
            );
        }

        const app: Application = {
            id: uuid(),
            jobId,
            job,
            status: "applied",
            appliedAt: new Date().toISOString(),
            timeline: [
                {
                    status: "applied",
                    date: new Date().toISOString(),
                    notes: notes || "Application submitted",
                },
            ],
            notes: notes || "",
            interviewDate,
        };

        addApplication(app);
        job.status = "applied";

        return NextResponse.json({ success: true, data: app });
    } catch (err) {
        console.error("[Applications API] Error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to create application" },
            { status: 500 }
        );
    }
}

// PUT — update application status
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { applicationId, status, notes, nextAction, nextActionDate, interviewDate } = body;

        const app = store.applications.get(applicationId);
        if (!app) {
            return NextResponse.json(
                { success: false, error: "Application not found" },
                { status: 404 }
            );
        }

        if (status) {
            app.status = status as ApplicationStatus;
            const event: ApplicationEvent = {
                status: status as ApplicationStatus,
                date: new Date().toISOString(),
                notes: notes || undefined,
            };
            app.timeline.push(event);
        }

        if (nextAction !== undefined) app.nextAction = nextAction;
        if (nextActionDate !== undefined) app.nextActionDate = nextActionDate;
        if (interviewDate !== undefined) app.interviewDate = interviewDate;
        if (notes !== undefined) app.notes = notes;

        return NextResponse.json({ success: true, data: app });
    } catch (err) {
        console.error("[Applications API] Update error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to update application" },
            { status: 500 }
        );
    }
}
