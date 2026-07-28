import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";

export async function GET() {
  const user = await requireAuth();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  return NextResponse.json({ id: user.id, role: user.role, full_name: user.full_name, email: user.email });
}
