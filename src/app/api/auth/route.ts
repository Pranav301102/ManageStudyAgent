// ─── Auth API (MVP — simple session cookie) ─────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const { action, name, email, password } = await req.json();
        const db = getDb();

        if (action === "signup") {
            // Check if user exists
            const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
            if (existing) {
                return NextResponse.json({ success: false, error: "Account already exists" });
            }

            // Create user (MVP: store password as-is — no bcrypt for hackathon)
            const id = `user-${Date.now()}`;
            db.prepare(`
        INSERT INTO users (id, name, email, resume_summary, target_roles, target_companies, skills)
        VALUES (?, ?, ?, '', '[]', '[]', '[]')
      `).run(id, name || "User", email);

            // Store password in a simple auth table
            db.exec(`CREATE TABLE IF NOT EXISTS auth (email TEXT PRIMARY KEY, password TEXT, user_id TEXT)`);
            db.prepare("INSERT OR REPLACE INTO auth (email, password, user_id) VALUES (?, ?, ?)").run(
                email, password, id
            );

            const res = NextResponse.json({ success: true, data: { userId: id } });
            res.cookies.set("session", id, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7 });
            return res;
        }

        if (action === "login") {
            // Check auth
            db.exec(`CREATE TABLE IF NOT EXISTS auth (email TEXT PRIMARY KEY, password TEXT, user_id TEXT)`);
            const auth = db.prepare("SELECT * FROM auth WHERE email = ?").get(email) as {
                email: string; password: string; user_id: string;
            } | undefined;

            if (!auth || auth.password !== password) {
                return NextResponse.json({ success: false, error: "Invalid email or password" });
            }

            const res = NextResponse.json({ success: true, data: { userId: auth.user_id } });
            res.cookies.set("session", auth.user_id, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7 });
            return res;
        }

        return NextResponse.json({ success: false, error: "Invalid action" });
    } catch (err) {
        console.error("[Auth API] Error:", err);
        return NextResponse.json({ success: false, error: "Auth failed" }, { status: 500 });
    }
}

export async function DELETE() {
    const res = NextResponse.json({ success: true });
    res.cookies.delete("session");
    return res;
}

// GET — check current session
export async function GET(req: NextRequest) {
    const session = req.cookies.get("session")?.value;
    if (!session) {
        return NextResponse.json({ success: false, authenticated: false });
    }

    const db = getDb();
    const user = db.prepare("SELECT id, name, email FROM users WHERE id = ?").get(session) as {
        id: string; name: string; email: string;
    } | undefined;

    if (!user) {
        return NextResponse.json({ success: false, authenticated: false });
    }

    return NextResponse.json({ success: true, authenticated: true, data: user });
}
