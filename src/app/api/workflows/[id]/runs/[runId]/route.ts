import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  findOwnedWorkflow,
  jsonError,
  jsonSuccess,
} from "@/lib/api";

// PATCH /api/workflows/[id]/runs/[runId] — update run status, add node runs
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;

  const { id, runId } = await params;
  const owned = await findOwnedWorkflow(id, auth.userId);
  if (!owned.ok) return owned.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const { status, durationMs, error, nodeRuns } = body;

  const updateData: Record<string, any> = {};
  if (status) updateData.status = status;
  if (durationMs !== undefined) updateData.durationMs = durationMs;
  if (error !== undefined) updateData.error = error;
  if (status && status !== "running") updateData.finishedAt = new Date();

  const run = await prisma.workflowRun.update({
    where: { id: runId },
    data: updateData,
  });

  // Upsert node runs if provided
  if (Array.isArray(nodeRuns)) {
    for (const nr of nodeRuns) {
      if (nr.id) {
        await prisma.nodeRun.update({
          where: { id: nr.id },
          data: {
            status: nr.status,
            finishedAt: nr.status !== "running" ? new Date() : undefined,
            durationMs: nr.durationMs,
            output: nr.output,
            error: nr.error,
          },
        });
      } else {
        // Create new node run
        await prisma.nodeRun.create({
          data: {
            workflowRunId: runId,
            nodeId: nr.nodeId,
            nodeType: nr.nodeType,
            nodeLabel: nr.nodeLabel,
            status: nr.status || "running",
            input: nr.input,
            output: nr.output,
            error: nr.error,
            durationMs: nr.durationMs,
          },
        });
      }
    }
  }

  // Re-fetch with node runs
  const updated = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { nodeRuns: { orderBy: { startedAt: "asc" } } },
  });

  return jsonSuccess(updated);
}
