// ─── Orchestrator API — Start/Stop/Poll autonomous pipeline ──────────
import { NextRequest, NextResponse } from "next/server";
import * as orchestrator from "@/lib/services/orchestrator";
import { store, updateSystemHealth } from "@/lib/store";

// POST /api/orchestrator — start the autonomous pipeline
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "start") {
      await orchestrator.initialize();
      return NextResponse.json({
        success: true,
        message: "Orchestrator started",
        data: store.systemHealth,
      });
    }

    if (action === "stop") {
      updateSystemHealth({ orchestratorRunning: false });
      return NextResponse.json({
        success: true,
        message: "Orchestrator stopped",
      });
    }

    // Sync local DB scouts with live Yutori scouts
    if (action === "sync") {
      const result = await orchestrator.syncScoutsWithYutori();
      return NextResponse.json({
        success: true,
        message: `Synced: ${result.synced} linked, ${result.created} created, ${result.orphansRemoved} orphans removed`,
        data: result,
      });
    }

    // Poll Yutori scouts for new results (lightweight ingest only)
    if (action === "poll") {
      const result = await orchestrator.pollAllScouts();
      return NextResponse.json({
        success: true,
        message: `Polled: ${result.newUpdates} new updates, ${result.newJobs} jobs ingested`,
        data: {
          newUpdates: result.newUpdates,
          newJobs: result.newJobs,
          jobs: result.ingestedJobs.map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company,
            status: j.status,
          })),
        },
      });
    }

    // Enrich discovered jobs through the heavy pipeline (browsing, NER, gaps)
    if (action === "enrich") {
      const limit = body.limit || 5;
      const result = await orchestrator.enrichDiscoveredJobs(limit);
      return NextResponse.json({
        success: true,
        message: `Enriched ${result.enriched} jobs (${result.errors} errors)`,
        data: result,
      });
    }

    // Sync + Poll in one shot (most useful action)
    if (action === "sync-and-poll") {
      const syncResult = await orchestrator.syncScoutsWithYutori();
      const pollResult = await orchestrator.pollAllScouts();
      return NextResponse.json({
        success: true,
        message: `Synced ${syncResult.created} scouts, ingested ${pollResult.newJobs} new jobs`,
        data: {
          sync: syncResult,
          poll: {
            newUpdates: pollResult.newUpdates,
            newJobs: pollResult.newJobs,
            jobs: pollResult.ingestedJobs.map((j) => ({
              id: j.id,
              title: j.title,
              company: j.company,
            })),
          },
        },
      });
    }

    // Simulate: inject a test job for demo purposes
    if (action === "demo") {
      const demoJobs = await orchestrator.processJobDiscovery([
        {
          job_title: "Software Engineering Intern",
          company: "Parallel",
          location: "San Francisco, CA",
          url: "https://parallel.ai/careers",
          posted_date: new Date().toISOString(),
          brief_description:
            "Join Parallel as a Software Engineering Intern. Work on distributed systems, build scalable APIs with Python and TypeScript, and contribute to our AI infrastructure. Experience with React, Node.js, and cloud platforms preferred.",
        },
        {
          job_title: "ML Platform Engineer Intern",
          company: "Modular",
          location: "Remote",
          url: "https://modular.com/careers",
          posted_date: new Date().toISOString(),
          brief_description:
            "Build next-gen ML infrastructure at Modular. Work with Mojo, MLIR, and LLVM. Strong Python required, experience with PyTorch, CUDA, and compiler design preferred.",
        },
        {
          job_title: "Backend Developer Intern",
          company: "Concora Credit",
          location: "New York, NY",
          url: "https://concoracredit.com/careers",
          posted_date: new Date().toISOString(),
          brief_description:
            "Join the engineering team at Concora Credit building financial APIs. Experience with Java, Spring Boot, PostgreSQL, and microservices required. Knowledge of fintech regulations preferred.",
        },
      ]);

      updateSystemHealth({
        orchestratorRunning: true,
        lastScanTime: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: `Demo: processed ${demoJobs.length} jobs`,
        data: demoJobs,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Orchestrator API] Error:", error);
    return NextResponse.json(
      { error: "Failed to execute orchestrator action" },
      { status: 500 }
    );
  }
}
