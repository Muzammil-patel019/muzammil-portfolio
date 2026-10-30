import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resumeSchema } from "./resume";
import seed from "./seed.json";
export async function owner(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    id = process.env.RESUME_OWNER_ID;
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("AUTH");
  if (!url || !key || !id) throw new Error("CONFIG");
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH");
  if (data.user.id !== id) throw new Error("FORBIDDEN");
  return { db, user: data.user };
}
export function apiError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return NextResponse.json(
    {
      error:
        code === "CONFIG"
          ? "Owner login is not configured."
          : code === "AUTH"
            ? "Please sign in again."
            : code === "FORBIDDEN"
              ? "This account is not the portfolio owner."
              : "The operation failed. Please try again.",
    },
    {
      status:
        code === "CONFIG"
          ? 503
          : code === "AUTH"
            ? 401
            : code === "FORBIDDEN"
              ? 403
              : 500,
    },
  );
}
export async function publicResume() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return resumeSchema.parse(seed);
  const db = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  const { data, error } = await db
    .from("published_resume")
    .select("document")
    .eq("id", 1)
    .maybeSingle();
  if (error) console.error("Published resume unavailable:", error.code);
  const parsed = resumeSchema.safeParse(data?.document);
  return parsed.success ? parsed.data : resumeSchema.parse(seed);
}
export async function readJSON(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 200000) throw new Error("SIZE");
  return JSON.parse(raw);
}
