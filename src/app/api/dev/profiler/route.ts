import { NextResponse } from "next/server";

// Dev-only stdout sink for the browser profiler. `next dev` serves this on Node
// and prints the line to its terminal; a production build returns 404, which is
// also why the middleware lets it through unauthenticated.
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { summary?: string } | null;
  console.log(`[profiler] ${body?.summary ?? "sample"}`);
  return NextResponse.json({ ok: true });
}
