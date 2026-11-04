import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { owner, apiError, readJSON } from "@/lib/server";
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function GET(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const id = z.uuid().parse(request.nextUrl.searchParams.get("planId"));
    const { data, error } = await db
      .from("subscription_join_requests")
      .select("id,name,email,created_at")
      .eq("owner_id", user.id)
      .eq("plan_id", id)
      .eq("status", "pending")
      .order("created_at");
    if (error) throw error;
    return NextResponse.json(data || [], { headers });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const body = z
      .object({
        planId: z.uuid(),
        requestId: z.uuid().optional(),
        approve: z.boolean().optional(),
      })
      .strict()
      .parse(await readJSON(request));
    if (body.requestId) {
      if (body.approve === undefined)
        return NextResponse.json(
          { error: "Choose approve or decline." },
          { status: 400, headers },
        );
      const { data: existing, error: lookupError } = await db
        .from("subscription_join_requests")
        .select("id")
        .eq("owner_id", user.id)
        .eq("plan_id", body.planId)
        .eq("id", body.requestId)
        .maybeSingle();
      if (lookupError || !existing)
        return NextResponse.json(
          { error: "Request unavailable." },
          { status: 404, headers },
        );
      const { error } = await db.rpc("review_subscription_join", {
        request_id: body.requestId,
        approve: body.approve,
      });
      if (error) throw error;
      return NextResponse.json({ reviewed: true }, { headers });
    }
    const { data: plan, error } = await db
      .from("subscription_plans")
      .select("group_code")
      .eq("id", body.planId)
      .eq("owner_id", user.id)
      .single();
    if (error) throw error;
    if (plan.group_code)
      return NextResponse.json({ code: plan.group_code }, { headers });
    const code = randomBytes(16).toString("base64url");
    const { error: updateError } = await db
      .from("subscription_plans")
      .update({
        group_code: code,
        group_hash: createHash("sha256").update(code).digest("hex"),
      })
      .eq("id", body.planId)
      .eq("owner_id", user.id)
      .is("group_code", null);
    if (updateError) throw updateError;
    const { data: saved, error: savedError } = await db
      .from("subscription_plans")
      .select("group_code")
      .eq("id", body.planId)
      .eq("owner_id", user.id)
      .single();
    if (savedError) throw savedError;
    return NextResponse.json({ code: saved.group_code }, { headers });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Check the request details." },
        { status: 400, headers },
      );
    return apiError(error);
  }
}
function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("CONFIG");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function invitation(request: NextRequest) {
  const code = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{22})$/)?.[1];
  if (!code) throw new Error("Invalid invitation");
  return createHash("sha256").update(code).digest("hex");
}
export async function PUT(request: NextRequest) {
  try {
    const hash = invitation(request);
    const body = z
      .object({
        name: z.string().trim().min(1).max(80),
        email: z.email().max(254),
      })
      .strict()
      .parse(await readJSON(request));
    const { error } = await publicClient().rpc("request_subscription_join", {
      invite_hash: hash,
      request_name: body.name,
      request_email: body.email,
    });
    if (error) throw error;
    return NextResponse.json({ requested: true }, { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not submit the request. Check your details or ask the manager for a fresh invitation.",
      },
      { status: 400, headers },
    );
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const { data, error } = await publicClient().rpc("get_subscription_group", {
      invite_hash: invitation(request),
    });
    if (error || !data)
      return NextResponse.json(
        { error: "This group invitation is unavailable." },
        { status: 404, headers },
      );
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json(
      { error: "This group invitation is unavailable." },
      { status: 404, headers },
    );
  }
}
