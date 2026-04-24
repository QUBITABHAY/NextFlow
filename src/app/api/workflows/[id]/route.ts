import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Ensures the Clerk user exists in our DB. Safe to call on every request. */
async function ensureUser(userId: string) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing) return existing;

  // User not in DB yet (webhook may not have fired). Fetch from Clerk and upsert.
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@unknown.com`;
  const name = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || null;

  return prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email, name },
    update: { email, name },
  });
}

// GET /api/workflows/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (workflow.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(workflow);
}

// PATCH /api/workflows/[id] — upsert
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { title, nodes, edges, viewport } = body;

  // Make sure the user row exists before the FK reference
  await ensureUser(userId);

  const workflow = await prisma.workflow.upsert({
    where: { id },
    create: {
      id,
      title: title ?? "Untitled",
      userId,
      nodes: nodes ?? [],
      edges: edges ?? [],
      viewport: viewport ?? null,
    },
    update: {
      ...(title !== undefined && { title }),
      ...(nodes !== undefined && { nodes }),
      ...(edges !== undefined && { edges }),
      ...(viewport !== undefined && { viewport }),
    },
  });

  return NextResponse.json(workflow);
}

// DELETE /api/workflows/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (workflow.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
