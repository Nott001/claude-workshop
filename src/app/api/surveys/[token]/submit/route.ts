import { NextResponse } from "next/server";
import { getServiceClient } from "@/shared/db/client";
import { submitSurvey } from "@/modules/surveys/lib/survey-service";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let body: { rating?: unknown; comment?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await submitSurvey(getServiceClient(), token, {
    rating: body.rating,
    comment: body.comment,
  });

  switch (result.ok ? "ok" : result.reason) {
    case "ok":
      return NextResponse.json({ ok: true });
    case "not_found":
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    case "already_submitted":
      return NextResponse.json({ error: "Survey already submitted" }, { status: 409 });
    case "expired":
      return NextResponse.json({ error: "This survey link has expired" }, { status: 410 });
    default:
      return NextResponse.json({ error: "Rating must be a number from 1 to 5" }, { status: 400 });
  }
}
