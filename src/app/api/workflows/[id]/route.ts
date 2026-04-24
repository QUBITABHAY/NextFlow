import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  findOwnedWorkflow,
  jsonError,
  jsonSuccess,
} from "@/lib/api";
import { ensureUser } from "@/lib/user";
import { updateWorkflowSchema } from "@/lib/validations";

// GET /api/workflows/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;

  const { id } = await params;
  const owned = await findOwnedWorkflow(id, auth.userId);
  if (!owned.ok) return owned.error;

  return jsonSuccess(owned.workflow);
}

// PATCH /api/workflows/[id] — upsert
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;

  const { id } = await params;

  let rawBody;
  try {
    rawBody = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const validation = updateWorkflowSchema.safeParse(rawBody);
  if (!validation.success) {
    return jsonError("Validation failed", 400);
  }

  const { title, nodes, edges, viewport } = validation.data;

  // Make sure the user row exists before the FK reference
  await ensureUser(auth.userId);

  const toJsonNull = <T>(
    v: T | null | undefined,
  ): T | typeof Prisma.JsonNull | undefined =>
    v === null ? Prisma.JsonNull : v === undefined ? undefined : v;

  const workflow = await prisma.workflow.upsert({
    where: { id },
    create: {
      id,
      title: title ?? "Untitled",
      userId: auth.userId,
      nodes: nodes ?? [],
      edges: edges ?? [],
      viewport: toJsonNull(viewport) ?? Prisma.JsonNull,
    },
    update: {
      ...(title !== undefined && { title }),
      ...(nodes !== undefined && { nodes }),
      ...(edges !== undefined && { edges }),
      ...(viewport !== undefined && { viewport: toJsonNull(viewport) }),
    },
  });

  return jsonSuccess(workflow);
}

// DELETE /api/workflows/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;

  const { id } = await params;
  const owned = await findOwnedWorkflow(id, auth.userId);
  if (!owned.ok) return owned.error;

  await prisma.workflow.delete({ where: { id } });
  return jsonSuccess({ success: true });
}
