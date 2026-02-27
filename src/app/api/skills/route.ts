// ─── Skills API ──────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { GraphNode } from "@/lib/types";
import * as neo4jService from "@/lib/services/neo4j-service";

// GET /api/skills — get user skills + graph data
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId");
  const profile = store.profile;

  // Try Neo4j graph data first, fallback to local
  let graphData;
  try {
    if (store.systemHealth.neo4jConnected) {
      graphData = await neo4jService.getSkillGraphData(profile.id, jobId || undefined);
    }
  } catch {
    // fallback
  }

  if (!graphData) {
    // Build local graph data
    const nodes: GraphNode[] = profile.skills.map((s) => ({
      id: `skill-${s.name}`,
      name: s.name,
      type: "user-skill" as const,
      category: s.category,
      proficiency: s.proficiencyLevel,
    }));

    // If job specified, add gap nodes
    if (jobId) {
      const job = store.jobs.get(jobId);
      if (job) {
        for (const gap of job.skillGaps) {
          nodes.push({
            id: `gap-${gap.skillName}`,
            name: gap.skillName,
            type: "gap" as const,
            category: undefined,
            proficiency: undefined,
          });
        }
      }
    }

    graphData = { nodes, links: [] };
  }

  return NextResponse.json({
    success: true,
    data: {
      skills: profile.skills,
      graph: graphData,
    },
  });
}

// POST /api/skills — update user skills
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skills } = body;

    store.profile.skills = skills;

    if (store.systemHealth.neo4jConnected) {
      await neo4jService.upsertUserSkills(store.profile.id, skills);
    }

    return NextResponse.json({ success: true, data: store.profile.skills });
  } catch (error) {
    console.error("[Skills API] Error updating skills:", error);
    return NextResponse.json(
      { error: "Failed to update skills" },
      { status: 500 }
    );
  }
}
