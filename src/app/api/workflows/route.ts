import { prisma } from "@/lib/prisma";
import { requireAuth, jsonSuccess } from "@/lib/api";

// GET /api/workflows — list all workflows for the current user
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.error;

  const workflows = await prisma.workflow.findMany({
    where: { userId: auth.userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });

  return jsonSuccess(workflows);
}
