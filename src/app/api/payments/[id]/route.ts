import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const payment = await paymentDao.findById(supabase, Number(id));

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Anyone below facilitator — attendee and speaker alike — may only read their
  // own payment. A literal "attendee" test let speakers read everyone's.
  if (!hasMinRole(guard.user.role, "facilitator") && payment.user_id !== guard.user.id) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  return NextResponse.json(payment);
}
