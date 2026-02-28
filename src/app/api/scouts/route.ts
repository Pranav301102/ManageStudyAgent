// ─── Scouts API ──────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { store, addScout } from "@/lib/store";
import * as yutoriService from "@/lib/services/yutori-service";
import { autoGenerateScouts, syncScoutsWithYutori } from "@/lib/services/orchestrator";
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

    // Sync local DB with Yutori
    if (body.action === "sync") {
      const result = await syncScoutsWithYutori();
      const scouts = Array.from(store.scouts.values());
      return NextResponse.json({
        success: true,
        data: {
          scouts,
          sync: result,
          message: `Sync: ${result.synced} linked, ${result.created} created, ${result.orphansRemoved} orphans removed`,
        },
      });
    }

    // Create multiple diverse scouts at once
    if (body.action === "create-diverse") {
      const queries: Array<{ query: string; strategy: string }> = body.queries || [
        {
          query: "Software Engineering Intern positions at top tech companies and AI startups in San Francisco, Remote. Python, TypeScript, React, Node.js required.",
          strategy: "exact_match",
        },
        {
          query: "ML Engineer and AI Research Intern roles at companies like OpenAI, Anthropic, DeepMind, Mistral, Cohere, Databricks. PyTorch, TensorFlow, Python.",
          strategy: "adjacent_role",
        },
        {
          query: "Full Stack Developer and Backend Engineer internship positions at fast-growing startups. React, Next.js, Node.js, PostgreSQL, Docker, AWS.",
          strategy: "skill_based",
        },
        {
          query: "New grad and junior software engineer positions at fintech companies like Stripe, Square, Plaid, Robinhood, Affirm. Python, Java, microservices.",
          strategy: "emerging_company",
        },
        {
          query: "DevOps, Platform Engineer, and Infrastructure roles at tech companies. Kubernetes, Docker, Terraform, CI/CD, AWS, GCP. Entry level and internships.",
          strategy: "growth_role",
        },
      ];

      const createdScouts: Scout[] = [];

      for (const { query, strategy } of queries) {
        try {
          const scoutResponse = await yutoriService.createScout({
            query,
            output_interval: 3600,
            skip_email: true,
          });

          const scout: Scout = {
            id: uuid(),
            yutoriScoutId: scoutResponse.id,
            query,
            targetCompanies: [],
            interval: 3600,
            status: "active",
            strategy,
            jobsFound: 0,
            createdAt: new Date().toISOString(),
          };

          addScout(scout);
          createdScouts.push(scout);
          console.log(`[Scouts API] Created diverse scout (${strategy}): "${query.slice(0, 60)}..."`);
        } catch (err) {
          console.warn(`[Scouts API] Failed to create scout: ${query.slice(0, 60)}`, err);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          scouts: createdScouts,
          message: `Created ${createdScouts.length} diverse scouts on Yutori`,
        },
      });
    }

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

