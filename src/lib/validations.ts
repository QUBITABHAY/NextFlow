import { z } from "zod";

// --- Workflow Schemas ---

export const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.string(), z.any()),
}).passthrough();

export const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
}).passthrough();

export const updateWorkflowSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  nodes: z.array(workflowNodeSchema).optional(),
  edges: z.array(workflowEdgeSchema).optional(),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .nullish()
    .optional(),
});

// --- Transloadit Schemas ---

export const transloaditParamsSchema = z.object({
  auth: z.object({
    key: z.string(),
    expires: z.string(),
  }),
  steps: z.record(z.string(), z.any()),
  template_id: z.string().optional(),
  notify_url: z.string().url().optional(),
});

// --- User Schema ---

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullish(),
});

// --- Env Schema ---

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_TRANSLOADIT_KEY: z.string().min(1),
  TRANSLOADIT_SECRET: z.string().min(1),
});

export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type UpdateWorkflow = z.infer<typeof updateWorkflowSchema>;
