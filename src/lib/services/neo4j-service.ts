// ─── Neo4j Service — Skill Knowledge Graph ──────────────────────────
import neo4j, { Driver, Session } from "neo4j-driver";
import { config } from "../config";
import {
  UserSkill,
  SkillGap,
  SkillGraphData,
  GraphNode,
  GraphLink,
  RequiredSkill,
} from "../types";

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    const isAura = config.neo4j.uri.startsWith("neo4j+s://") || config.neo4j.uri.startsWith("neo4j+ssc://");
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.username, config.neo4j.password),
      {
        // Aura requires encrypted; local bolt does not
        ...(isAura ? {} : { encrypted: "ENCRYPTION_OFF" as const }),
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
        connectionTimeout: 30000,
      }
    );
  }
  return driver;
}

/** Get a session scoped to the configured database (Aura uses named DBs). */
function getSession(): Session {
  return getDriver().session({ database: config.neo4j.database });
}

export async function testConnection(): Promise<boolean> {
  try {
    const d = getDriver();
    const info = await d.getServerInfo();
    console.log("[Neo4j] Connected to", info.address);
    return true;
  } catch (err) {
    console.error("[Neo4j] Connection failed:", err);
    return false;
  }
}

export async function initializeSchema(): Promise<void> {
  const session = getSession();
  try {
    await session.run(
      "CREATE CONSTRAINT IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE"
    );
    await session.run(
      "CREATE CONSTRAINT IF NOT EXISTS FOR (j:Job) REQUIRE j.id IS UNIQUE"
    );
    await session.run(
      "CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE"
    );
    await session.run(
      "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Company) REQUIRE c.name IS UNIQUE"
    );
    await session.run(
      "CREATE CONSTRAINT IF NOT EXISTS FOR (co:Concept) REQUIRE co.name IS UNIQUE"
    );
    console.log("[Neo4j] Schema initialized");
  } finally {
    await session.close();
  }
}

// ─── User Skills ─────────────────────────────────────────────────────

export async function upsertUserSkills(
  userId: string,
  skills: UserSkill[]
): Promise<void> {
  const session = getSession();
  try {
    await session.run("MERGE (u:User {id: $userId})", { userId });

    for (const skill of skills) {
      await session.run(
        `
        MERGE (s:Skill {name: $name})
        SET s.category = $category
        WITH s
        MATCH (u:User {id: $userId})
        MERGE (u)-[r:HAS_SKILL]->(s)
        SET r.level = $level, r.years = $years
        `,
        {
          userId,
          name: skill.name,
          category: skill.category,
          level: skill.proficiencyLevel,
          years: skill.yearsExperience,
        }
      );
    }
    console.log(`[Neo4j] Upserted ${skills.length} skills for user ${userId}`);
  } finally {
    await session.close();
  }
}

// ─── Job Skills ──────────────────────────────────────────────────────

export async function upsertJobSkills(
  jobId: string,
  company: string,
  title: string,
  requiredSkills: RequiredSkill[],
  preferredSkills: RequiredSkill[]
): Promise<void> {
  const session = getSession();
  try {
    await session.run(
      `
      MERGE (j:Job {id: $jobId})
      SET j.title = $title
      MERGE (c:Company {name: $company})
      MERGE (j)-[:AT_COMPANY]->(c)
      `,
      { jobId, title, company }
    );

    const allSkills = [
      ...requiredSkills.map((s) => ({ ...s, importance: "required" })),
      ...preferredSkills.map((s) => ({ ...s, importance: "preferred" })),
    ];

    for (const skill of allSkills) {
      await session.run(
        `
        MERGE (s:Skill {name: $name})
        WITH s
        MATCH (j:Job {id: $jobId})
        MERGE (j)-[r:REQUIRES_SKILL]->(s)
        SET r.importance = $importance
        `,
        { jobId, name: skill.name, importance: skill.importance }
      );
    }
    console.log(`[Neo4j] Upserted skills for job ${jobId}`);
  } finally {
    await session.close();
  }
}

// ─── Skill Gap Analysis ─────────────────────────────────────────────

export async function computeSkillGaps(
  userId: string,
  jobId: string
): Promise<SkillGap[]> {
  const session = getSession();
  try {
    const result = await session.run(
      `
      MATCH (j:Job {id: $jobId})-[req:REQUIRES_SKILL]->(reqSkill:Skill)
      OPTIONAL MATCH (u:User {id: $userId})-[has:HAS_SKILL]->(reqSkill)
      WHERE has IS NULL
      RETURN reqSkill.name AS skillName, req.importance AS importance
      `,
      { userId, jobId }
    );

    const gaps: SkillGap[] = result.records.map((record) => ({
      skillName: record.get("skillName"),
      importance: record.get("importance") || "required",
      learningResources: [],
      bridgePath: [],
    }));

    // Find bridge paths for each gap
    for (const gap of gaps) {
      const bridgeResult = await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS_SKILL]->(userSkill:Skill)
        WHERE userSkill.category = 'concept' OR userSkill.category = 'framework'
        OPTIONAL MATCH (userSkill)-[:BRIDGES_TO]->(:Concept)-[:TEACHES]->(gapSkill:Skill {name: $gapName})
        RETURN userSkill.name AS bridgeSkill, gapSkill IS NOT NULL AS hasBridge
        LIMIT 3
        `,
        { userId, gapName: gap.skillName }
      );
      gap.bridgePath = bridgeResult.records
        .filter((r) => r.get("hasBridge"))
        .map((r) => r.get("bridgeSkill"));
    }

    return gaps;
  } finally {
    await session.close();
  }
}

// ─── Match Score ─────────────────────────────────────────────────────

export async function computeMatchScore(
  userId: string,
  jobId: string
): Promise<number> {
  const session = getSession();
  try {
    const result = await session.run(
      `
      MATCH (j:Job {id: $jobId})-[req:REQUIRES_SKILL]->(reqSkill:Skill)
      OPTIONAL MATCH (u:User {id: $userId})-[has:HAS_SKILL]->(reqSkill)
      WITH count(reqSkill) AS totalRequired,
           count(has) AS matched
      RETURN CASE WHEN totalRequired = 0 THEN 0.0
                  ELSE toFloat(matched) / toFloat(totalRequired) * 100
             END AS matchScore
      `,
      { userId, jobId }
    );

    return Math.round(result.records[0]?.get("matchScore") || 0);
  } finally {
    await session.close();
  }
}

// ─── Graph Visualization Data ────────────────────────────────────────

export async function getSkillGraphData(
  userId: string,
  jobId?: string
): Promise<SkillGraphData> {
  const session = getSession();
  try {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeIds = new Set<string>();

    // Get user skills
    const userSkills = await session.run(
      `
      MATCH (u:User {id: $userId})-[r:HAS_SKILL]->(s:Skill)
      RETURN s.name AS name, s.category AS category, r.level AS proficiency
      `,
      { userId }
    );

    for (const record of userSkills.records) {
      const name = record.get("name");
      const id = `skill-${name}`;
      if (!nodeIds.has(id)) {
        nodes.push({
          id,
          name,
          type: "user-skill",
          category: record.get("category"),
          proficiency: record.get("proficiency")?.toNumber?.() ?? record.get("proficiency"),
        });
        nodeIds.add(id);
      }
    }

    // If a job is specified, get required/gap skills
    if (jobId) {
      const jobSkills = await session.run(
        `
        MATCH (j:Job {id: $jobId})-[req:REQUIRES_SKILL]->(s:Skill)
        OPTIONAL MATCH (u:User {id: $userId})-[has:HAS_SKILL]->(s)
        RETURN s.name AS name, req.importance AS importance, has IS NOT NULL AS userHas
        `,
        { userId, jobId }
      );

      for (const record of jobSkills.records) {
        const name = record.get("name");
        const id = `skill-${name}`;
        const userHas = record.get("userHas");

        if (!nodeIds.has(id)) {
          nodes.push({
            id,
            name,
            type: userHas ? "required-skill" : "gap",
            importance: record.get("importance"),
          });
          nodeIds.add(id);
        }

        // Link to a virtual job node
        const jobNodeId = `job-${jobId}`;
        if (!nodeIds.has(jobNodeId)) {
          nodes.push({
            id: jobNodeId,
            name: "Target Job",
            type: "concept",
          });
          nodeIds.add(jobNodeId);
        }
        links.push({
          source: jobNodeId,
          target: id,
          type: userHas ? "requires" : "gap",
        });
      }
    }

    return { nodes, links };
  } finally {
    await session.close();
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

// ─── Fallback for when Neo4j is not available ────────────────────────

export function computeSkillGapsLocal(
  userSkills: UserSkill[],
  requiredSkills: RequiredSkill[],
  preferredSkills: RequiredSkill[]
): SkillGap[] {
  const userSkillNames = new Set(
    userSkills.map((s) => s.name.toLowerCase())
  );

  const allRequired = [
    ...requiredSkills.map((s) => ({ ...s, importance: "required" as const })),
    ...preferredSkills.map((s) => ({ ...s, importance: "preferred" as const })),
  ];

  return allRequired
    .filter((s) => !userSkillNames.has(s.name.toLowerCase()))
    .map((s) => ({
      skillName: s.name,
      importance: s.importance,
      learningResources: [],
      bridgePath: [],
    }));
}

export function computeMatchScoreLocal(
  userSkills: UserSkill[],
  requiredSkills: RequiredSkill[]
): number {
  if (requiredSkills.length === 0) return 0;
  const userSkillNames = new Set(
    userSkills.map((s) => s.name.toLowerCase())
  );
  const matched = requiredSkills.filter((s) =>
    userSkillNames.has(s.name.toLowerCase())
  ).length;
  return Math.round((matched / requiredSkills.length) * 100);
}
