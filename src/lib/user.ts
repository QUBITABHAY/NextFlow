import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/** Extract a display name from first/last name parts. */
export function buildDisplayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  return [firstName, lastName].filter(Boolean).join(" ") || null;
}

/**
 * Ensure the Clerk user exists in our DB. Safe to call on every request.
 * Falls back to fetching from Clerk if the webhook hasn't fired yet.
 */
export async function ensureUser(userId: string) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@unknown.com`;
  const name = buildDisplayName(clerkUser?.firstName, clerkUser?.lastName);

  return prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email, name },
    update: { email, name },
  });
}
