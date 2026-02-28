// ─── SQLite Database Layer ───────────────────────────────────────────
// Persistent storage using better-sqlite3. Creates tables on first run.
// Database file: data/app.db (auto-created).

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
    if (!db) {
        const dataDir = path.join(process.cwd(), "data");
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        db = new Database(path.join(dataDir, "app.db"));
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");

        initSchema(db);
    }
    return db;
}

function initSchema(db: Database.Database) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'User',
      email TEXT DEFAULT '',
      resume_summary TEXT DEFAULT '',
      target_roles TEXT DEFAULT '[]',
      target_companies TEXT DEFAULT '[]',
      skills TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scouts (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS interviews (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS study_schedule (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS performance_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interview_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_challenges (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS resume_alignments (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS training_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      feedback_rating TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS processed_updates (
      update_id TEXT PRIMARY KEY,
      scout_id TEXT,
      jobs_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

    // Seed default user if none exists
    const userCount = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
    if (userCount.cnt === 0) {
        db.prepare(`
      INSERT INTO users (id, name, email, resume_summary, target_roles, target_companies, skills)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
            "user-1",
            "Career Advocate User",
            "",
            "",
            JSON.stringify(["Software Engineering Intern", "ML Engineer Intern", "Backend Engineer"]),
            JSON.stringify(["Parallel", "Modular", "Concora Credit"]),
            JSON.stringify([
                { name: "Python", category: "language", proficiencyLevel: 4, yearsExperience: 3 },
                { name: "TypeScript", category: "language", proficiencyLevel: 4, yearsExperience: 2 },
                { name: "React", category: "framework", proficiencyLevel: 4, yearsExperience: 2 },
                { name: "Node.js", category: "framework", proficiencyLevel: 3, yearsExperience: 2 },
                { name: "FastAPI", category: "framework", proficiencyLevel: 3, yearsExperience: 1 },
                { name: "PostgreSQL", category: "tool", proficiencyLevel: 3, yearsExperience: 2 },
                { name: "Docker", category: "tool", proficiencyLevel: 3, yearsExperience: 1 },
                { name: "Git", category: "tool", proficiencyLevel: 4, yearsExperience: 3 },
                { name: "REST APIs", category: "concept", proficiencyLevel: 4, yearsExperience: 2 },
                { name: "Data Structures", category: "concept", proficiencyLevel: 4, yearsExperience: 3 },
                { name: "Machine Learning", category: "concept", proficiencyLevel: 2, yearsExperience: 1 },
            ])
        );
    }
}

// ─── Generic CRUD helpers ────────────────────────────────────────────

export function upsertJson(table: string, id: string, data: unknown, extraCols?: Record<string, string>) {
    const d = getDb();
    const json = JSON.stringify(data);
    const cols = extraCols ? Object.keys(extraCols) : [];
    const vals = extraCols ? Object.values(extraCols) : [];

    if (cols.length > 0) {
        const colStr = cols.map((c) => `, ${c}`).join("");
        const placeholders = cols.map(() => ", ?").join("");
        d.prepare(
            `INSERT OR REPLACE INTO ${table} (id, data${colStr}) VALUES (?, ?${placeholders})`
        ).run(id, json, ...vals);
    } else {
        d.prepare(
            `INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`
        ).run(id, json);
    }
}

export function getJson<T>(table: string, id: string): T | null {
    const row = getDb().prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) as T : null;
}

export function getAllJson<T>(table: string): T[] {
    const rows = getDb().prepare(`SELECT data FROM ${table} ORDER BY created_at DESC`).all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as T);
}

export function deleteRow(table: string, id: string) {
    getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

// ─── User-specific helpers ───────────────────────────────────────────

export function getUser(userId: string = "user-1") {
    return getDb().prepare("SELECT * FROM users WHERE id = ?").get(userId) as {
        id: string; name: string; email: string; resume_summary: string;
        target_roles: string; target_companies: string; skills: string;
    } | undefined;
}

export function updateUser(userId: string, updates: Record<string, unknown>) {
    const allowed = ["name", "email", "resume_summary", "target_roles", "target_companies", "skills"];
    const cols = Object.keys(updates).filter((k) => allowed.includes(k));
    if (cols.length === 0) return;

    const setStr = cols.map((c) => `${c} = ?`).join(", ");
    const vals = cols.map((c) => {
        const v = updates[c];
        return typeof v === "string" ? v : JSON.stringify(v);
    });

    getDb().prepare(`UPDATE users SET ${setStr} WHERE id = ?`).run(...vals, userId);
}

// ─── Settings helpers ────────────────────────────────────────────────

export function getSetting(key: string): string | null {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
    getDb().prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
}
