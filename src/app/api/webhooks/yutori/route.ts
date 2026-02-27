// ─── Yutori Webhook Receiver ─────────────────────────────────────────
// Receives job discovery events from Yutori Scouting API.
// Each webhook fires the full autonomous pipeline AND feeds results
// back to the scout lifecycle for self-optimization and replication.

import { NextRequest, NextResponse } from "next/server";
import * as orchestrator from "@/lib/services/orchestrator";
import * as scoutLifecycle from "@/lib/services/scout-lifecycle";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Webhook] Received Yutori webhook:", JSON.stringify(body).slice(0, 200));

    // Yutori sends structured results based on our output_schema
    // The payload varies by webhook_format; for "scout" format:
    const jobs = Array.isArray(body) ? body : body.data || body.results || [body];

    // Extract the scout ID from the webhook payload (Yutori includes it)
    const scoutId = body.scout_id || body.task_id || undefined;

    if (jobs.length === 0) {
      return NextResponse.json({ message: "No jobs in payload" }, { status: 200 });
    }

    // Process through the autonomous pipeline (tag jobs with source scout)
    const processed = await orchestrator.processJobDiscovery(jobs, scoutId);

    // Feed results back to the scout lifecycle for learning + replication
    await scoutLifecycle.feedbackFromWebhook(scoutId, processed);

    return NextResponse.json({
      success: true,
      message: `Processed ${processed.length} jobs`,
      jobIds: processed.map((j) => j.id),
    });
  } catch (error) {
    console.error("[Webhook] Error processing Yutori webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
