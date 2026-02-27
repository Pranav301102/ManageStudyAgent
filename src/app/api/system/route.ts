// ─── System Health API ───────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import * as neo4jService from "@/lib/services/neo4j-service";
import * as glinerService from "@/lib/services/gliner-service";
import { getJson } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // If ?lifecycle=true, return lifecycle events for the scout graph
  if (searchParams.get("lifecycle") === "true") {
    try {
      const lcData = getJson<{ events: unknown[]; lastCycleReport: unknown }>("study_schedule", "lifecycle_events");
      if (lcData) {
        return NextResponse.json({ success: true, data: lcData });
      }
      return NextResponse.json({ success: true, data: { events: [], lastCycleReport: null } });
    } catch {
      return NextResponse.json({ success: true, data: { events: [], lastCycleReport: null } });
    }
  }

  // Live-check Neo4j connection (overrides cached value)
  let neo4jConnected = store.systemHealth.neo4jConnected;
  try {
    neo4jConnected = await neo4jService.testConnection();
  } catch {
    neo4jConnected = false;
  }

  // Live-check Pioneer/GLiNER backend
  let pioneerConnected = false;
  let pioneerModel = "unknown";
  let glinerBackend: "pioneer" | "local" | "fallback" = "fallback";
  try {
    const gh = await glinerService.checkGlinerHealth();
    pioneerConnected = gh.pioneerAvailable;
    pioneerModel = gh.model;
    glinerBackend = gh.backend;
  } catch {
    // keep defaults
  }

  return NextResponse.json({
    success: true,
    data: {
      ...store.systemHealth,
      neo4jConnected,
      pioneerConnected,
      pioneerModel,
      glinerBackend,
    },
  });
}
