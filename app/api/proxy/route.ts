import { NextResponse } from "next/server";

const BLOCKED_HEADERS = ["x-frame-options", "content-security-policy", "x-content-type-options"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Only http and https URLs are allowed" }, { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EventRoomProxy/1.0)" },
    });

    const body = await response.arrayBuffer();

    const headers = new Headers();
    for (const [key, value] of response.headers.entries()) {
      if (!BLOCKED_HEADERS.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    headers.set("X-Frame-Options", "ALLOWALL");

    return new NextResponse(body, {
      status: response.status,
      headers,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch URL" }, { status: 502 });
  }
}
