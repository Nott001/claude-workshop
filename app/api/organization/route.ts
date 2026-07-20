import { NextResponse } from "next/server";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

const PAGE_SIZE = 10;

const inviteSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["attendee", "speaker", "facilitator"]),
});

export async function GET(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const search = searchParams.get("search")?.trim() || "";

  const supabase = getServiceClient();

  let query = supabase
    .from("USERS")
    .select("user_id, full_name, email, role", { count: "exact" })
    .in("role", ["facilitator", "speaker"])
    .order("full_name", { ascending: true });

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data: users, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    users: users ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}

export async function POST(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: existing } = await supabase.from("USERS").select("user_id").eq("email", parsed.data.email).maybeSingle();

  if (existing) {
    return NextResponse.json({ error: { message: "A user with this email already exists" } }, { status: 409 });
  }

  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: parsed.data.email,
      publicMetadata: { role: parsed.data.role },
      notify: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send invitation";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }

  return NextResponse.json({ email: parsed.data.email, role: parsed.data.role }, { status: 201 });
}
