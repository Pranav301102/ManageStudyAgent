// ─── Orchestrator API — Start/Stop autonomous pipeline ───────────────
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
