// ─── Scouts API ──────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { store, addScout } from "@/lib/store";
import * as yutoriService from "@/lib/services/yutori-service";
import { autoGenerateScouts } from "@/lib/services/orchestrator";
import { Scout } from "@/lib/types";

// GET /api/scouts — list all scouts
export async function GET() {
  const scouts = Array.from(store.scouts.values());
  return NextResponse.json({ success: true, data: scouts });
}

// POST /api/scouts — create a new scout or auto-generate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Auto-generate mode: let the LLM decide
    if (body.action === "auto-generate") {
      const scouts = await autoGenerateScouts();
      return NextResponse.json({
        success: true,
        data: {
          scouts,
          message: `AI autonomously generated ${scouts.length} scouts.`,
        },
      });
    }

    // Manual mode: user provides their own query
    const { query, targetCompanies, interval } = body;

    if (!query) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/yutori`;

    let yutoriScoutId: string | undefined;
    let status: Scout["status"] = "active";

    try {
      const response = await yutoriService.createScout({
        query,
        output_interval: interval || 1800,
        webhook_url: webhookUrl,
        webhook_format: "scout",
        skip_email: true,
      });
      yutoriScoutId = response.id;
    } catch (err) {
      console.warn("[Scouts API] Yutori scout creation failed:", err);
      status = "error";
    }

    const scout: Scout = {
      id: uuid(),
      yutoriScoutId,
      query,
      targetCompanies: targetCompanies || [],
      interval: interval || 1800,
      status,
      jobsFound: 0,
      createdAt: new Date().toISOString(),
    };

    addScout(scout);

    return NextResponse.json({ success: true, data: scout });
  } catch (error) {
    console.error("[Scouts API] Error creating scout:", error);
    return NextResponse.json(
      { error: "Failed to create scout" },
      { status: 500 }
    );
  }
}

