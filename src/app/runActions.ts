"use server";

import { prisma } from "@/lib/prisma";

export async function createWorkflowRun(
  workflowId: string,
  scope: "full" | "single" | "partial",
) {
  const run = await prisma.workflowRun.create({
    data: { workflowId, scope, status: "running" },
  });
  return run.id;
}

export async function createNodeRun(
  workflowRunId: string,
  nodeId: string,
  nodeType: string,
  nodeLabel: string,
  input?: string,
) {
  const nr = await prisma.nodeRun.create({
    data: {
      workflowRunId,
      nodeId,
      nodeType,
      nodeLabel,
      status: "running",
      input: input ? input.slice(0, 2000) : undefined,
    },
  });
  return nr.id;
}

export async function finishNodeRun(
  nodeRunId: string,
  status: "success" | "failed",
  durationMs: number,
  output?: string,
  error?: string,
) {
  await prisma.nodeRun.update({
    where: { id: nodeRunId },
    data: {
      status,
      finishedAt: new Date(),
      durationMs,
      output: output ? output.slice(0, 2000) : undefined,
      error: error ? error.slice(0, 1000) : undefined,
    },
  });
}

export async function finishWorkflowRun(
  runId: string,
  status: "success" | "failed" | "partial",
  durationMs: number,
  error?: string,
) {
  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      status,
      finishedAt: new Date(),
      durationMs,
      error: error ? error.slice(0, 1000) : undefined,
    },
  });
}
