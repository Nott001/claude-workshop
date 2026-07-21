import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { syncUser } from "@/lib/auth/sync-user";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const user = await syncUser(userId);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user_id: user.user_id, role: user.role });
}
