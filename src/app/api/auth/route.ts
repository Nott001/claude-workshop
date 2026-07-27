import { Webhook } from "svix";
import { headers } from "next/headers";
import { type WebhookEvent } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db";
import { userDao } from "@/lib/db/dao";
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

    const result = await userDao.upsertFromClerk(supabase, {
      auth_user_id: id,
      email: primaryEmail,
      full_name: fullName,
      ...(role ? { role } : {}),
    });

    if (!result) {
      return new NextResponse("Failed to sync user", { status: 500 });
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;
    if (!id) {
      return new NextResponse("Missing user id", { status: 400 });
    }

    const user = await userDao.findByAuthId(supabase, id);
    if (user) {
      const paths = await listStorageFolder("profile_images", `users/${user.id}`);
      await deleteFromStorage("profile_images", paths);
    }

    const success = await userDao.deleteByAuthId(supabase, id);
    if (!success) {
      return new NextResponse("Failed to delete user", { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
