import { NextResponse } from "next/server";
import { getServiceClient } from "@/shared/db/client";
import { getSurveyByToken } from "@/modules/surveys/lib/survey-service";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await getSurveyByToken(getServiceClient(), token);
  if (!state) return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  return NextResponse.json(state);
}
