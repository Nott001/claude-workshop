import { Webhook } from "svix";
import { headers } from "next/headers";
import { type WebhookEvent } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db";
import { deleteFromStorage, listStorageFolder } from "@/lib/storage";

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!SIGNING_SECRET) {
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt: WebhookEvent;

  try {
    const wh = new Webhook(SIGNING_SECRET);
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new NextResponse("Invalid webhook signature", { status: 400 });
  }

  const supabase = getServiceClient();
  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, public_metadata } = evt.data;
    const primaryEmail = email_addresses?.[0]?.email_address ?? "";
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || primaryEmail;
    const role = typeof public_metadata?.role === "string" ? public_metadata.role : undefined;

    const upsertPayload: Record<string, unknown> = {
      clerk_id: id,
      email: primaryEmail,
      full_name: fullName,
    };
    if (role) {
      upsertPayload.role = role;
    }

    const { error } = await supabase.from("USERS").upsert(upsertPayload, { onConflict: "clerk_id" });

    if (error) {
      return new NextResponse(`Failed to sync user: ${error.message}`, { status: 500 });
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;

    const { data: user } = await supabase.from("USERS").select("user_id").eq("clerk_id", id).single();
    if (user) {
      const paths = await listStorageFolder("profile_images", `users/${user.user_id}`);
      await deleteFromStorage("profile_images", paths);
    }

    const { error } = await supabase.from("USERS").delete().eq("clerk_id", id);

    if (error) {
      return new NextResponse(`Failed to delete user: ${error.message}`, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
