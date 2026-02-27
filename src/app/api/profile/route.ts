// ─── Profile API ─────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ success: true, data: store.profile });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    Object.assign(store.profile, body);
    return NextResponse.json({ success: true, data: store.profile });
  } catch (error) {
    console.error("[Profile API] Error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
