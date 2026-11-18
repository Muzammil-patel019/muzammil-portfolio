import "server-only";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import {
  workspaceSchema,
  initialWorkspace,
  LabError,
  fail,
  type Workspace,
} from "./commerce";
import { hashToken } from "./session";
type RecordValue = { document: Workspace; revision: number; expiresAt: string };
const memory = new Map<string, RecordValue>();
export const memoryEnabled = () =>
  process.env.LAB_STORE_MODE === "memory" && !process.env.VERCEL;
export const signingSecret = () => process.env.LAB_SESSION_SECRET || "";
export function tokenFrom(request: Request) {
  const token = request.headers.get("X-Lab-Workspace") || "";
  if (!/^[a-f0-9]{48}$/.test(token))
    fail(
      "WORKSPACE_REQUIRED",
      401,
      "Create a practice workspace first, then send X-Lab-Workspace.",
    );
  return token;
}
export async function storage(
  operation: string,
  token: string,
  document?: Workspace,
  revision?: number,
): Promise<RecordValue> {
  const key = hashToken(token);
  if (memoryEnabled()) {
    for (const [key, row] of memory)
      if (row.expiresAt < new Date().toISOString()) memory.delete(key);
    if (operation === "create") {
      if (memory.size >= 200)
        fail("LAB_CAPACITY", 429, "Practice workspace capacity reached.");
      const row = {
        document: document!,
        revision: 1,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      memory.set(key, structuredClone(row));
      return row;
    }
    if (operation === "delete") {
      memory.delete(key);
      return {
        document: initialWorkspace(randomBytes(32).toString("hex")),
        revision: 0,
        expiresAt: "",
      };
    }
    const row = memory.get(key);
    if (!row)
      fail(
        "WORKSPACE_EXPIRED",
        404,
        "Practice workspace expired or was deleted.",
      );
    if (operation === "save") {
      if (row.revision !== revision)
        fail(
          "REVISION_CONFLICT",
          409,
          "Another request changed this workspace. Read it again before retrying.",
        );
      row.document = structuredClone(document!);
      row.revision++;
    }
    return structuredClone(row);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) fail("CONFIG", 503, "Practice storage is not configured.");
  const db = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  const { data, error } = await db.rpc("lab_workspace_gateway", {
    operation,
    capability_hash: key,
    new_document: document || null,
    expected_revision: revision ?? null,
  });
  if (error) {
    const code = error.message.includes("LAB_CONFLICT")
      ? "REVISION_CONFLICT"
      : error.message.includes("LAB_NOT_FOUND")
        ? "WORKSPACE_EXPIRED"
        : error.message.includes("LAB_CAPACITY")
          ? "LAB_CAPACITY"
          : "DATABASE_UNAVAILABLE";
    throw new LabError(
      code,
      code === "REVISION_CONFLICT"
        ? 409
        : code === "WORKSPACE_EXPIRED"
          ? 404
          : code === "LAB_CAPACITY"
            ? 429
            : 503,
      "Practice storage request failed: " + code,
    );
  }
  if (operation === "delete") return data;
  return { ...data, document: workspaceSchema.parse(data.document) };
}
export async function createWorkspace() {
  if (signingSecret().length < 32)
    fail("CONFIG", 503, "Practice sessions are not configured.");
  const token = randomBytes(24).toString("hex"),
    row = await storage(
      "create",
      token,
      initialWorkspace(randomBytes(32).toString("hex")),
    );
  return {
    workspaceToken: token,
    revision: row.revision,
    expiresAt: row.expiresAt,
    storage: memoryEnabled() ? "ephemeral-test-memory" : "postgres",
  };
}
