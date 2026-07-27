import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { userDao, ticketDao } from "@/lib/db/dao";

export async function GET() {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const supabase = getServiceClient();
  const dbUser = await userDao.findByAuthIdWithRole(supabase, (await auth()).userId!);

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let tickets;
  if (dbUser.role === "attendee") {
    tickets = await ticketDao.listByUser(supabase, dbUser.id);
  } else {
    tickets = await ticketDao.listAll(supabase);
  }

  return NextResponse.json(tickets);
}
