import { NextResponse } from "next/server";
import { getServiceClient } from "@/shared/db/client";

export async function GET(_req: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path } = await params;
  const filePath = path.join("/");

  const supabase = getServiceClient();
  const { data, error } = await supabase.storage.from(bucket).download(filePath);

  if (error || !data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Content-Type": data.type || "application/octet-stream",
  };

  return new NextResponse(data, { status: 200, headers });
}
