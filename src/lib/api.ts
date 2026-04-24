import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Standard JSON error response. */
export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Standard JSON success response. */
export function jsonSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

type AuthSuccess = { ok: true; userId: string };
type AuthFailure = { ok: false; error: NextResponse };

/**
 * Require Clerk authentication.
 * Check `result.ok` to discriminate the union.
 */
export async function requireAuth(): Promise<AuthSuccess | AuthFailure> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: jsonError("Unauthorized", 401) };
  return { ok: true, userId };
}

type WorkflowResult = Awaited<ReturnType<typeof prisma.workflow.findUnique>>;
type OwnedSuccess = { ok: true; workflow: NonNullable<WorkflowResult> };
type OwnedFailure = { ok: false; error: NextResponse };

/**
 * Find a workflow by ID and verify the requesting user owns it.
 * Check `result.ok` to discriminate the union.
 */
export async function findOwnedWorkflow(
  id: string,
  userId: string,
): Promise<OwnedSuccess | OwnedFailure> {
  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) return { ok: false, error: jsonError("Not found", 404) };
  if (workflow.userId !== userId)
    return { ok: false, error: jsonError("Forbidden", 403) };
  return { ok: true, workflow };
}
