# NextFlow — Visual AI Workflow Builder

> A node-based visual pipeline editor that lets you connect AI models, media processing tools, and LLMs into automated workflows — built with Next.js, React Flow, Trigger.dev, and Prisma.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Node Types](#node-types)
5. [Trigger.dev Tasks](#triggerdev-tasks)
6. [Workflow Execution Engine](#workflow-execution-engine)
7. [Database Schema](#database-schema)
8. [API Routes](#api-routes)
9. [State Management](#state-management)
10. [Workflow Templates](#workflow-templates)
11. [Project Structure](#project-structure)
12. [Environment Variables](#environment-variables)
13. [Getting Started](#getting-started)
14. [Key Features](#key-features)

---

## Overview

NextFlow is a visual workflow builder inspired by node-editor tools like Krea.ai. It lets users compose AI pipelines by dragging and connecting nodes on a canvas. Nodes represent operations — image cropping, video frame extraction, LLM calls, media inputs, and text prompts. Connections between nodes define data flow. When you click **Run**, the engine executes each node in topological order, passing outputs from one to the next.

Each workflow is persisted to a PostgreSQL database (via Prisma + Neon) and associated with the authenticated user (via Clerk). The heavy processing tasks (image crop, video frame extraction, LLM calls) run as **Trigger.dev** background tasks so they don't block the browser and can retry on failure.

---

## Tech Stack

| Layer            | Technology                                         |
| ---------------- | -------------------------------------------------- |
| Framework        | Next.js 16 (App Router)                            |
| Canvas           | React Flow (`@xyflow/react`)                       |
| State            | Zustand                                            |
| Auth             | Clerk (`@clerk/nextjs`)                            |
| Database         | PostgreSQL via Neon                                |
| ORM              | Prisma (`@prisma/client` + `@prisma/adapter-neon`) |
| Background Tasks | Trigger.dev v4 (`@trigger.dev/sdk`)                |
| Media Processing | ffmpeg (via `@trigger.dev/build/extensions/core`)  |
| File Hosting     | Transloadit                                        |
| LLM              | Google Gemini (`@google/genai`)                    |
| Styling          | Tailwind CSS                                       |
| Language         | TypeScript                                         |

---

## Architecture

```
Browser (React Flow canvas)
        │
        │  drag / drop / connect
        ▼
  Zustand Store (useFlowStore)
        │
        │  auto-save (debounced PATCH)
        ▼
  Next.js API Routes (/api/workflows/[id])
        │
        │  Prisma
        ▼
  PostgreSQL (Neon)

  [Run Workflow]
        │
        ▼
  workflowExecutor.ts  (ASAP DAG scheduler)
        │
        │  triggerNodeAction (Server Action)
        ▼
  Trigger.dev Cloud
        │  ┌─────────────────────────────────┐
        │  │  Tasks                          │
        │  │  • llm-call   (Google Gemini)   │
        │  │  • crop-image (ffmpeg + TLI)    │
        │  │  • extract-frame (ffmpeg + TLI) │
        │  └─────────────────────────────────┘
        │
        │  polling (pollRunStatus every 2s)
        ▼
  Node result written back → Zustand → React Flow node re-renders
```

---

## Node Types

### 1. `workflowCard` — Processing Node

The main executable node. Wraps operations like **Crop Image** and **Extract Frame**. Each card has:

- An input handle (accepts image or video URLs from connected media/workflow nodes)
- A configurable prompt or parameter panel
- A result display area that shows output after execution
- A **Run Node** button to run just this one node independently

**Subtypes (by `data.model` field):**

| Model value     | What it does                                                                     |
| --------------- | -------------------------------------------------------------------------------- |
| `Crop Image`    | Crops an image using configurable X/Y/Width/Height (percentage-based) via ffmpeg |
| `Extract Frame` | Extracts a single frame from a video at a specified timestamp via ffmpeg         |

### 2. `llmNode` — LLM Call Node

A specialized node for calling Google Gemini. Has dedicated input handles for:

- **System Prompt** (yellow handle, top) — connects from a Text Node
- **User Message** (yellow handle, middle) — connects from a Text Node
- **Image input** (blue handle) — connects from a Media Node or a WorkflowCard output

Supports multiple image inputs by accumulating all connected image URLs.

### 3. `textNode` — Text Input Node

A simple textarea node. The text content is passed as a prompt to any connected WorkflowCard or LLM node. Renders with a yellow accent.

### 4. `mediaNode` — Media Input Node

Allows uploading an image or video file directly from your computer (using Transloadit for upload). The uploaded URL is then available as an output handle for downstream nodes.

- **Image** node → outputs on blue handle
- **Video** node → outputs on green handle

### 5. `groupNode` — Container Node

An organizational node that visually groups other nodes together. Supports:

- Dragging children as a unit
- Running all children as a sub-workflow
- Renaming and recoloring
- Ungrouping back to flat canvas

---

## Trigger.dev Tasks

All compute-heavy work runs as Trigger.dev background tasks. The task definitions live in `src/trigger/`.

### `llm-call` (`src/trigger/llmCall.ts`)

**Task ID:** `llm-call`

Calls the Google Gemini API with optional image inputs.

**Payload:**

```ts
{
  nodeId: string;         // Canvas node ID (for logging)
  systemPrompt?: string;  // Optional system instruction
  userMessage: string;    // Required user prompt
  imageUrl?: string;      // Single image (backwards compat)
  imageUrls?: string[];   // Multiple images
  model: string;          // e.g. "gemini-2.5-flash"
}
```

**Returns:**

```ts
{
  success: boolean;
  result: string;
  timestamp: string;
}
```

**Supported models:** `gemini-2.5-flash`, `gemini-2.5-flash-lite`. Falls back to `gemini-2.0-flash` for unknown models.

**Retry:** 2 attempts, 10s min backoff. Rate limit errors (`429`, `resource_exhausted`) are re-thrown to trigger retry.

---

### `crop-image` (`src/trigger/cropImage.ts`)

**Task ID:** `crop-image`

Downloads an image (or decodes a base64 data URL), crops it using ffmpeg, and uploads the result to Transloadit.

**Payload:**

```ts
{
  nodeId: string;
  imageUrl: string; // Remote URL or data: URI
  cropX: number; // Left offset (% of image width)
  cropY: number; // Top offset (% of image height)
  cropWidth: number; // Width of crop region (%)
  cropHeight: number; // Height of crop region (%)
}
```

**Returns:**

```ts
{
  success: boolean;
  result: string;
  timestamp: string;
}
// result = public Transloadit CDN URL of the cropped image
```

**Steps:**

1. Download/decode input image to `/tmp`
2. Use `ffprobe` to get actual pixel dimensions
3. Convert percentage crop params → pixel values
4. Run `ffmpeg -vf crop=W:H:X:Y` to produce output PNG
5. Upload via `transloadit.createAssembly()` with `/upload/handle` robot
6. Return the `ssl_url` from the assembly result

**Retry:** 3 attempts.

---

### `extract-frame` (`src/trigger/extractFrame.ts`)

**Task ID:** `extract-frame`

Downloads a video, determines its duration, seeks to a timestamp, and extracts a single PNG frame — then uploads it to Transloadit.

**Payload:**

```ts
{
  nodeId: string;
  videoUrl: string;
  frameTimestamp: number;
  frameTimestampMode: "seconds" | "percentage";
}
```

**Returns:**

```ts
{
  success: boolean;
  result: string;
  timestamp: string;
}
// result = public Transloadit CDN URL of the extracted frame
```

**Steps:**

1. Stream-download video to `/tmp` via Node.js `pipeline()`
2. `ffprobe` to get duration
3. Convert percentage → seconds if needed, clamp to valid range
4. `ffmpeg -ss <time> -frames:v 1` to extract PNG
5. Upload to Transloadit, return URL

**Machine preset:** `large-1x` (memory-intensive for video processing)  
**Max duration:** 120 seconds  
**Retry:** 2 attempts.

---

### `execute-node-action` (`src/trigger/nodeAction.ts`)

A fallback generic task (`execute-node-action`) used for node types that don't map to a dedicated task. It simulates processing with a short wait and returns a mock result. The actual routing to the correct task (`crop-image`, `extract-frame`, `llm-call`) is handled in the `triggerNodeAction` server action in `src/app/actions.ts` — NOT by this task.

---

## Workflow Execution Engine

The execution engine lives in `src/lib/workflowExecutor.ts`. It implements an **ASAP (As Soon As Possible) DAG scheduler** — more efficient than level-by-level execution.

### DAG Validation — Cycle Detection

Before running, Kahn's algorithm checks for cycles. If a cycle is detected, the run is rejected with a descriptive error listing the involved nodes.

```
detectCycle(nodes, edges) → string[] | null
```

### ASAP Scheduler

Unlike naive level-based execution (where all nodes at the same depth run before any node at the next depth), the ASAP scheduler starts each node **as soon as all of its direct dependencies are complete**.

**Example:**  
Given `A → B → C` and independent `D → E`:

- Level-based: `[A, D]` → wait → `[B, E]` → wait → `[C]`
- ASAP: A starts, D starts. When A finishes → B starts immediately. When D finishes → E starts. C starts when B finishes.

This eliminates unnecessary waiting between independent branches.

### Execution Flow

1. Validate DAG (cycle check)
2. Build dependency map: `deps[nodeId] = Set<nodeIds that must finish first>`
3. Seed ready queue with nodes that have no dependencies
4. Launch all ready nodes in parallel
5. When a node finishes successfully → check if any of its dependents now have all deps satisfied → add to ready queue
6. When a node fails → mark all downstream dependents as failed (they won't run)
7. Resolve when no more nodes are running or ready

### Abort/Cancellation

Each run gets an `AbortController`. The abort signal is checked:

- At the top of the polling loop (every 2s)
- After each sleep, before the next poll

When aborted, any in-flight Trigger.dev runs are cancelled via `cancelRun(runId)`, and all running nodes get their status set to `"Stopped by user."`.

### Run Tracking

Every workflow run is persisted to the database:

- A `WorkflowRun` record is created on start with status `running`
- A `NodeRun` record is created for each node as it starts
- Each `NodeRun` is updated with duration, output/error, and final status when the node finishes
- The `WorkflowRun` is finalized with overall status and duration

---

## Database Schema

Managed by Prisma, hosted on Neon (PostgreSQL).

### `User`

Stores Clerk user identities. The `id` field is the Clerk user ID directly (no auto-generated PK).

```prisma
model User {
  id        String     @id      // Clerk user ID
  email     String     @unique
  name      String?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  workflows Workflow[]
}
```

### `Workflow`

Stores the canvas state (nodes and edges as JSON blobs) plus viewport.

```prisma
model Workflow {
  id        String   @id @default(cuid())
  title     String   @default("Untitled")
  userId    String
  user      User     @relation(...)
  nodes     Json     @default("[]")
  edges     Json     @default("[]")
  viewport  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  runs      WorkflowRun[]
}
```

### `WorkflowRun`

A single execution of a workflow (or partial/group execution).

```prisma
model WorkflowRun {
  id         String    @id @default(cuid())
  workflowId String
  scope      String    // "full" | "single" | "partial"
  status     String    // "running" | "success" | "failed" | "partial"
  startedAt  DateTime  @default(now())
  finishedAt DateTime?
  durationMs Int?
  error      String?
  nodeRuns   NodeRun[]
}
```

### `NodeRun`

Per-node execution record within a workflow run.

```prisma
model NodeRun {
  id            String      @id @default(cuid())
  workflowRunId String
  nodeId        String
  nodeType      String
  nodeLabel     String
  status        String      // "running" | "success" | "failed"
  startedAt     DateTime    @default(now())
  finishedAt    DateTime?
  durationMs    Int?
  input         String?
  output        String?
  error         String?
}
```

---

## API Routes

### `GET /api/workflows`

Returns all workflows belonging to the authenticated user, ordered by most recently updated.

### `PATCH /api/workflows/[id]`

Creates or updates a workflow. Accepts `{ title, nodes, edges, viewport }` (all optional). Uses upsert so you can create a workflow by ID before navigating to the editor.

### `DELETE /api/workflows/[id]`

Deletes the workflow (and all runs/nodeRuns via cascade).

### `GET /api/workflows/[id]`

Returns a single workflow with full node/edge data.

### `POST /api/transloadit-sign`

Generates a signed Transloadit authentication token for client-side uploads from the canvas.

### `POST /api/webhooks/clerk`

Clerk webhook endpoint — upserts a `User` record on `user.created` and `user.updated` events, and deletes the record on `user.deleted`.

---

## State Management

The entire canvas state lives in a single Zustand store: `src/store/useFlowStore.ts`.

### Key State Fields

| Field               | Type                                  | Description                                |
| ------------------- | ------------------------------------- | ------------------------------------------ |
| `nodes`             | `Node[]`                              | All canvas nodes                           |
| `edges`             | `Edge[]`                              | All canvas edges                           |
| `interactionMode`   | `"pan" \| "select" \| "add" \| "cut"` | Current canvas tool                        |
| `theme`             | `"light" \| "dark"`                   | UI theme                                   |
| `past / future`     | `Snapshot[]`                          | Undo/redo history stacks (max 100 entries) |
| `workflowId`        | `string \| null`                      | ID of the current workflow                 |
| `workflowTitle`     | `string`                              | Editable title                             |
| `isWorkflowRunning` | `boolean`                             | Execution in progress                      |
| `workflowError`     | `string \| null`                      | Last execution error message               |

### Undo / Redo

Snapshots are created automatically before every significant mutation (node moves, connects, deletes). History is capped at 100 entries. Undo restores the previous snapshot; redo restores a future snapshot.

### Export / Import

- **Export** (`exportWorkflow`): Serializes nodes, edges, and metadata to a JSON file and triggers a browser download. The file includes a `version: 1` field for forward compatibility.
- **Import** (`importWorkflow`): Reads a `.json` file, validates its structure, and loads it onto the canvas.

### Auto-Save

The canvas editor (`src/app/node/[id]/page.tsx`) watches `nodes`, `edges`, and `workflowTitle` via a `useEffect`. Any change triggers a **1.5-second debounce** (`AUTOSAVE_DELAY = 1500`) before issuing a `PATCH /api/workflows/[id]` request. A `saveStatus` indicator (`idle` | `saving` | `saved` | `error`) is reflected in the toolbar.

---

## Workflow Templates

Four pre-built templates are available from the home screen's **Templates** tab:

| Template                  | Description                                        |
| ------------------------- | -------------------------------------------------- |
| **Image Crop Pipeline**   | Media Node → Crop Image node                       |
| **Video Frame Extractor** | Media Node (video) → Extract Frame node            |
| **LLM Vision Chat**       | Text + Image → LLM node for vision-based responses |
| **Full Pipeline**         | Image Crop + Video Frame → Chained LLM #1 → LLM #2 |

Templates are defined in `src/lib/templates.ts` as static node/edge configurations. Selecting a template creates a real workflow in the database and navigates to the editor, so you can immediately run and modify it.

---

## Project Structure

```
nextflow/
├── prisma/
│   ├── schema.prisma          # Database models
│   └── migrations/            # Prisma migration history
│
├── src/
│   ├── app/
│   │   ├── page.tsx           # Home page (workflow gallery)
│   │   ├── layout.tsx         # Root layout (Clerk provider)
│   │   ├── globals.css        # Global styles
│   │   ├── actions.ts         # Server Actions (triggerNodeAction, pollRunStatus, cancelRun)
│   │   ├── runActions.ts      # Server Actions (createWorkflowRun, createNodeRun, finishNodeRun...)
│   │   ├── node/[id]/         # Canvas editor page (per-workflow)
│   │   ├── sign-in/           # Clerk sign-in page
│   │   ├── sign-up/           # Clerk sign-up page
│   │   └── api/
│   │       ├── workflows/     # CRUD routes for workflows
│   │       ├── transloadit-sign/  # Signed upload token
│   │       └── webhooks/      # Clerk webhook handler
│   │
│   ├── component/
│   │   ├── Sidebar.tsx        # Left navigation sidebar
│   │   └── flow/
│   │       ├── WorkflowCardNode.tsx  # workflowCard node component
│   │       ├── LLMNode.tsx          # llmNode component
│   │       ├── MediaNode.tsx        # mediaNode component
│   │       ├── TextNode.tsx         # textNode component
│   │       ├── GroupNode.tsx        # groupNode component
│   │       ├── CustomEdge.tsx       # Styled edge with delete button
│   │       ├── CutLine.tsx          # Cut-mode line for severing edges
│   │       ├── TopActions.tsx       # Canvas toolbar (run, stop, export, import...)
│   │       ├── BottomActions.tsx    # Bottom dock (add nodes, undo/redo, tidy...)
│   │       ├── Dock.tsx             # Floating action dock
│   │       ├── SidePanel.tsx        # Right panel for node configuration
│   │       ├── HistorySidebar.tsx   # Run history sidebar
│   │       ├── SelectionOverlay.tsx # Multi-select action overlay
│   │       ├── TemplateOverlay.tsx  # Template picker overlay
│   │       ├── constants.ts         # Edge colors, node palette items
│   │       └── types.ts             # Shared TypeScript types
│   │
│   ├── store/
│   │   └── useFlowStore.ts    # Zustand store (all canvas + execution state)
│   │
│   ├── lib/
│   │   ├── workflowExecutor.ts  # ASAP DAG execution engine
│   │   ├── templates.ts         # Pre-built workflow templates
│   │   ├── prisma.ts            # Prisma client singleton
│   │   ├── user.ts              # User creation helper
│   │   ├── api.ts               # Shared API utilities
│   │   └── validations.ts       # Zod schemas for API validation
│   │
│   ├── hooks/
│   │   └── useTheme.ts          # Theme hook
│   │
│   ├── trigger/
│   │   ├── llmCall.ts           # Gemini LLM task
│   │   ├── cropImage.ts         # Image crop task (ffmpeg + Transloadit)
│   │   ├── extractFrame.ts      # Video frame extraction task (ffmpeg + Transloadit)
│   │   └── nodeAction.ts        # Router task (dispatches to the above)
│   │
│   └── proxy.ts                 # Middleware proxy config
│
├── trigger.config.ts            # Trigger.dev project config (ffmpeg extension, retries)
├── next.config.ts               # Next.js config
├── tailwind.config.ts           # Tailwind design tokens
└── package.json
```

---

## Environment Variables

Create a `.env.local` file at the project root with the following values:

```bash
# ── Clerk Authentication ─────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# ── Database (Neon PostgreSQL) ───────────────────────────
DATABASE_URL=postgresql://...
# Neon serverless connection string (for Prisma adapter)

# ── Trigger.dev ──────────────────────────────────────────
TRIGGER_SECRET_KEY=tr_...

# ── Google Gemini ─────────────────────────────────────────
GEMINI_API_KEY=AIza...

# ── Transloadit (file hosting for cropped images/frames) ─
NEXT_PUBLIC_TRANSLOADIT_KEY=...
TRANSLOADIT_SECRET=...
```

> **Note:** `NEXT_PUBLIC_TRANSLOADIT_KEY` is exposed to the browser for client-side upload signing. All other secrets must remain server-side only.

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- A PostgreSQL database (Neon recommended)
- A Clerk account and application
- A Trigger.dev account and project
- A Google AI Studio API key (for Gemini)
- A Transloadit account

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in all values (see [Environment Variables](#environment-variables)).

### 3. Set up the database

```bash
npx prisma migrate deploy
# or for local development:
npx prisma db push
```

### 4. Start the Trigger.dev dev worker

```bash
npx trigger dev
```

This runs your tasks locally so that workflow executions can actually process images and call the LLM.

### 5. Start the Next.js dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Clerk, create a workflow, and start building pipelines.

### Production Build

```bash
npm run build   # runs prisma generate + next build
npm run start
```

Deploy your Trigger.dev tasks separately:

```bash
npx trigger deploy
```

---

## Key Features

| Feature                     | Details                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Visual node editor**      | Drag-and-drop canvas powered by React Flow with custom node types                                        |
| **ASAP parallel execution** | Independent branches run in parallel; nodes start the moment their dependencies complete                 |
| **Cycle detection**         | Workflows with circular connections are rejected before execution                                        |
| **Graceful cancellation**   | Stop button immediately aborts browser polling and cancels all in-flight Trigger.dev cloud runs          |
| **Run history**             | Every execution (full, partial, group) is logged to the database with per-node timing, input, and output |
| **Undo / Redo**             | 100-entry history stack for all canvas mutations                                                         |
| **Group nodes**             | Select multiple nodes → group them into a container; run, recolor, or ungroup                            |
| **Tidy up**                 | Arrange selected nodes into a clean grid layout                                                          |
| **Cut mode**                | Draw a line across edges to delete multiple connections at once                                          |
| **Export / Import**         | Save any workflow as a portable JSON file; load it back on any account                                   |
| **Workflow templates**      | Four built-in templates to get started quickly                                                           |
| **Auto-save**               | Workflow changes are debounced and synced to the database automatically                                  |
| **Light / Dark mode**       | Full theme support across all UI components                                                              |
| **Per-user isolation**      | Clerk auth ensures every user sees only their own workflows                                              |
