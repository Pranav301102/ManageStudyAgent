// ─── Persistent Store (SQLite-backed) ────────────────────────────────
// All data persists in data/app.db. Same API surface as the old in-memory store.

import {
  Job, Scout, InterviewSession, UserProfile, SystemHealth,
  Application, StudySchedule, PerformanceSnapshot, DailyChallenge,
} from "./types";
import { getDb, upsertJson, getJson, getAllJson } from "./db";

// SystemHealth is runtime-only (not persisted — recalculated on read)
let cachedHealth: SystemHealth = {
  orchestratorRunning: false,
  activeScouts: 0,
  neo4jConnected: false,
  lastScanTime: undefined,
  totalJobsFound: 0,
  interviewsReady: 0,
  skillGapsIdentified: 0,
};

// ─── Lazy store facade ───────────────────────────────────────────────
// Provides Map-like access backed by SQLite reads

function makeDbMap<T extends { id: string }>(table: string): Map<string, T> {
  // Return a proxy that reads/writes to SQLite
  return new Proxy(new Map<string, T>(), {
    get(target, prop) {
      if (prop === "get") {
        return (id: string) => getJson<T>(table, id);
      }
      if (prop === "set") {
        return (id: string, value: T) => {
          upsertJson(table, id, value);
          return target;
        };
      }
      if (prop === "has") {
        return (id: string) => getJson(table, id) !== null;
      }
      if (prop === "delete") {
        return (id: string) => {
          getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
          return true;
        };
      }
      if (prop === "values") {
        return () => getAllJson<T>(table)[Symbol.iterator]();
      }
      if (prop === "entries") {
        return () => {
          const items = getAllJson<T>(table);
          return items.map((item) => [item.id, item] as [string, T])[Symbol.iterator]();
        };
      }
      if (prop === "size") {
        const row = getDb().prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
        return row.cnt;
      }
      if (prop === "forEach") {
        return (cb: (value: T, key: string, map: Map<string, T>) => void) => {
          const items = getAllJson<T>(table);
          items.forEach((item) => cb(item, item.id, target));
        };
      }
      if (prop === Symbol.iterator) {
        return () => {
          const items = getAllJson<T>(table);
          return items.map((item) => [item.id, item] as [string, T])[Symbol.iterator]();
        };
      }
      return Reflect.get(target, prop);
    },
  });
}

function loadProfile(): UserProfile {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get("user-1") as {
    id: string; name: string; email: string; resume_summary: string;
    target_roles: string; target_companies: string; skills: string;
  } | undefined;

  if (!row) {
    return {
      id: "user-1",
      name: "User",
      email: "",
      resumeSummary: "",
      targetRoles: [],
      targetCompanies: [],
      skills: [],
    };
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    resumeSummary: row.resume_summary,
    targetRoles: JSON.parse(row.target_roles),
    targetCompanies: JSON.parse(row.target_companies),
    skills: JSON.parse(row.skills),
  };
}

interface Store {
  profile: UserProfile;
  jobs: Map<string, Job>;
  scouts: Map<string, Scout>;
  interviews: Map<string, InterviewSession>;
  applications: Map<string, Application>;
  studySchedule: StudySchedule | null;
  performanceHistory: PerformanceSnapshot[];
  dailyChallenge: DailyChallenge | null;
  systemHealth: SystemHealth;
}

// The store object proxies all reads/writes to SQLite
export const store: Store = {
  get profile() {
    return loadProfile();
  },
  set profile(value: UserProfile) {
    const { updateUser } = require("./db");
    updateUser("user-1", {
      name: value.name,
      email: value.email,
      resume_summary: value.resumeSummary,
      target_roles: value.targetRoles,
      target_companies: value.targetCompanies,
      skills: value.skills,
    });
  },
  jobs: makeDbMap<Job>("jobs"),
  scouts: makeDbMap<Scout>("scouts"),
  interviews: makeDbMap<InterviewSession>("interviews"),
  applications: makeDbMap<Application>("applications"),
  get studySchedule(): StudySchedule | null {
    return getJson<StudySchedule>("study_schedule", "current");
  },
  set studySchedule(value: StudySchedule | null) {
    if (value) {
      upsertJson("study_schedule", "current", value);
    } else {
      getDb().prepare("DELETE FROM study_schedule WHERE id = 'current'").run();
    }
  },
  get performanceHistory(): PerformanceSnapshot[] {
    return getAllJson<PerformanceSnapshot & { id: string }>("performance_snapshots");
  },
  set performanceHistory(value: PerformanceSnapshot[]) {
    // Bulk replace
    const d = getDb();
    d.prepare("DELETE FROM performance_snapshots").run();
    for (const snap of value) {
      d.prepare("INSERT INTO performance_snapshots (interview_id, data) VALUES (?, ?)").run(
        snap.interviewId,
        JSON.stringify(snap)
      );
    }
  },
  get dailyChallenge(): DailyChallenge | null {
    const today = new Date().toISOString().split("T")[0];
    const row = getDb().prepare("SELECT data FROM daily_challenges WHERE date = ?").get(today) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  },
  set dailyChallenge(value: DailyChallenge | null) {
    if (value) {
      const today = new Date().toISOString().split("T")[0];
      getDb().prepare("INSERT OR REPLACE INTO daily_challenges (id, data, date) VALUES (?, ?, ?)").run(
        value.id,
        JSON.stringify(value),
        today
      );
    }
  },
  systemHealth: cachedHealth,
};

// ─── Helper functions (same API as before) ───────────────────────────

export function updateSystemHealth(updates: Partial<SystemHealth>) {
  Object.assign(cachedHealth, updates);
}

export function addJob(job: Job) {
  upsertJson("jobs", job.id, job);
  cachedHealth.totalJobsFound = (getDb().prepare("SELECT COUNT(*) as cnt FROM jobs").get() as { cnt: number }).cnt;
}

export function addScout(scout: Scout) {
  upsertJson("scouts", scout.id, scout);
  const allScouts = getAllJson<Scout>("scouts");
  cachedHealth.activeScouts = allScouts.filter((s) => s.status === "active").length;
}

export function addInterview(interview: InterviewSession) {
  upsertJson("interviews", interview.id, interview, { job_id: interview.jobId });
  const allInterviews = getAllJson<InterviewSession>("interviews");
  cachedHealth.interviewsReady = allInterviews.filter(
    (i) => i.status === "active" || i.status === "preparing"
  ).length;
}

export function addApplication(app: Application) {
  upsertJson("applications", app.id, app, { job_id: app.jobId });
}

export function addPerformanceSnapshot(snapshot: PerformanceSnapshot) {
  getDb().prepare("INSERT INTO performance_snapshots (interview_id, data) VALUES (?, ?)").run(
    snapshot.interviewId,
    JSON.stringify(snapshot)
  );
}
