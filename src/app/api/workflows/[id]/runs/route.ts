import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, findOwnedWorkflow, jsonError, jsonSuccess } from "@/lib/api";

// GET /api/workflows/[id]/runs — list runs for a workflow
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;

  const { id } = await params;
  const owned = await findOwnedWorkflow(id, auth.userId);
  if (!owned.ok) return owned.error;

  const runs = await prisma.workflowRun.findMany({
    where: { workflowId: id },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: {
      nodeRuns: {
        orderBy: { startedAt: "asc" },
      },
    },
  });

  return jsonSuccess(runs);
}

// POST /api/workflows/[id]/runs — create a new run
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;

  const { id } = await params;
  const owned = await findOwnedWorkflow(id, auth.userId);
  if (!owned.ok) return owned.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const { scope } = body;
  if (!scope || !["full", "single", "partial"].includes(scope)) {
    return jsonError("Invalid scope", 400);
  }

  const run = await prisma.workflowRun.create({
    data: {
      workflowId: id,
      scope,
      status: "running",
    },
  });

  return jsonSuccess(run, 201);
}
