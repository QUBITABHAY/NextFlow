import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonSuccess } from "@/lib/api";
import { buildDisplayName } from "@/lib/user";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return jsonError("Webhook secret not configured", 500);
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return jsonError("Missing svix headers", 400);
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let event: WebhookEvent;
  try {
    event = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch {
    return jsonError("Invalid signature", 400);
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, email_addresses, first_name, last_name } = event.data;
    const email = email_addresses?.[0]?.email_address ?? "";
    const name = buildDisplayName(first_name, last_name);

    await prisma.user.upsert({
      where: { id },
      create: { id, email, name },
      update: { email, name },
    });
  }

  if (event.type === "user.deleted") {
    const { id } = event.data;
    if (id) {
      await prisma.user.delete({ where: { id } }).catch(() => null);
    }
  }

  return jsonSuccess({ received: true });
}
