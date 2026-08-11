import { NextResponse } from "next/server";
import { ROLES } from "@/shared/lib/roles";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import { getPaymentGateway } from "@/modules/commerce/lib/payment-gateway";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMinRole(ROLES.FACILITATOR);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const paymentId = Number(id);
  const supabase = getServiceClient();

  const payment = await paymentDao.findById(supabase, paymentId);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.status !== "paid") {
    return NextResponse.json({ error: "Only paid payments can be refunded" }, { status: 409 });
  }

  try {
    const result = await getPaymentGateway().refund({ payment_id: paymentId });
    return NextResponse.json({ refunded: result.refunded });
  } catch (err) {
    console.error("Refund failed:", err);
    return NextResponse.json({ error: "Refund failed" }, { status: 500 });
  }
}
