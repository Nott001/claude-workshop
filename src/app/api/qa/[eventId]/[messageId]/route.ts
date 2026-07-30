import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json({ error: "Use /api/qa/module/[moduleId] instead" }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Use /api/qa/message/[messageId] instead" }, { status: 410 });
}
