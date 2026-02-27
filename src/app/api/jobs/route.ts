// ─── Jobs API ────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import * as orchestrator from "@/lib/services/orchestrator";

// GET /api/jobs — list all discovered jobs
export async function GET() {
  const jobs = Array.from(store.jobs.values()).sort(
    (a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime()
  );

  return NextResponse.json({ success: true, data: jobs });
}

// POST /api/jobs — manually add a job for processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, title, company } = body;

    if (!title || !company) {
      return NextResponse.json(
        { error: "title and company are required" },
        { status: 400 }
      );
    }

    const job = await orchestrator.processManualJob(url || "", title, company);

    return NextResponse.json({ success: true, data: job });
  } catch (error) {
    console.error("[API] Error creating job:", error);
    return NextResponse.json(
      { error: "Failed to process job" },
      { status: 500 }
    );
  }
}
