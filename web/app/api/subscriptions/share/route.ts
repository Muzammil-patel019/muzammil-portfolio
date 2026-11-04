import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { owner, apiError, readJSON } from "@/lib/server";
import { documentSchema } from "@/lib/subscriptions";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
function failed(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : "";
  if (code === "42P01" || code === "PGRST205")
    return NextResponse.json(
      {
        error:
          "Subscription storage needs its one-time database setup. Your existing site data is unchanged.",
      },
      { status: 503, headers },
    );
  const response = apiError(error);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const { data, error } = await db
      .from("subscription_shares")
      .select("member_id,created_at")
      .eq("owner_id", user.id)
      .eq(
        "plan_id",
        request.nextUrl.searchParams.get("planId") ||
          "00000000-0000-0000-0000-000000000000",
      );
    if (error) throw error;
    const { data: reports, error: reportsError } = await db
      .from("subscription_payment_reports")
      .select(
        "member_id,cycle_id,reported_at,term_months,amount_minor,coverage_end,preference_at,approved_months",
      )
      .eq("owner_id", user.id)
      .eq(
        "plan_id",
        request.nextUrl.searchParams.get("planId") ||
          "00000000-0000-0000-0000-000000000000",
      )
      .is("confirmed_at", null);
    if (reportsError) throw reportsError;
    return NextResponse.json(
      {
        reports: reports || [],
        shares: (data ?? []).map((share) => ({
          memberId: share.member_id,
          createdAt: share.created_at,
        })),
      },
      { headers },
    );
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const parsed = z
      .object({
        planId: z.uuid(),
        memberId: z.uuid().transform((value) => value.toLowerCase()),
        revoke: z.boolean().optional(),
        replace: z.boolean().optional(),
        approveMonths: z
          .number()
          .int()
          .refine((n) => [1, 3, 6, 12].includes(n))
          .optional(),
        cycleId: z.uuid().optional(),
      })
      .strict()
      .safeParse(await readJSON(request));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Choose a valid member." },
        { status: 400, headers },
      );
    const { memberId, revoke, replace, planId } = parsed.data;
    if (revoke) {
      const { error } = await db
        .from("subscription_shares")
        .delete()
        .eq("owner_id", user.id)
        .eq("member_id", memberId)
        .eq("plan_id", planId);
      if (error) throw error;
      return NextResponse.json({ revoked: true }, { headers });
    }
    const { data, error } = await db
      .from("subscription_plans")
      .select("document")
      .eq("owner_id", user.id)
      .eq("id", planId)
      .maybeSingle();
    if (error) throw error;
    const document = documentSchema.safeParse(data?.document);
    if (
      !document.success ||
      !document.data.members.some((member) => member.id === memberId)
    )
      return NextResponse.json(
        { error: "Save this member before creating a link." },
        { status: 400, headers },
      );
    if (parsed.data.approveMonths) {
      if (!parsed.data.cycleId)
        return NextResponse.json(
          { error: "Choose a period." },
          { status: 400, headers },
        );
      const {data:approved,error:approvalError}=await db.rpc("approve_subscription_coverage",{plan_id:planId,member_id:memberId,cycle_id:parsed.data.cycleId,months:parsed.data.approveMonths});
      if (approvalError) throw approvalError;
      if (!approved)
        return NextResponse.json(
          { error: "Preference changed. Reload and try again." },
          { status: 409, headers },
        );
      return NextResponse.json({ approved: true }, { headers });
    }
    if (!replace) {
      const { data: existing, error: lookupError } = await db
        .from("subscription_shares")
        .select("owner_token,owner_code")
        .eq("owner_id", user.id)
        .eq("member_id", memberId)
        .eq("plan_id", planId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        if (existing.owner_code)
          return NextResponse.json({ code: existing.owner_code }, { headers });
        const code = randomBytes(16).toString("base64url");
        const { error: aliasError } = await db
          .from("subscription_shares")
          .update({
            owner_code: code,
            code_hash: createHash("sha256").update(code).digest("hex"),
          })
          .eq("owner_id", user.id)
          .eq("plan_id", planId)
          .eq("member_id", memberId)
          .is("owner_code", null);
        if (aliasError) throw aliasError;
        const { data: alias, error: aliasReadError } = await db
          .from("subscription_shares")
          .select("owner_code")
          .eq("owner_id", user.id)
          .eq("plan_id", planId)
          .eq("member_id", memberId)
          .single();
        if (aliasReadError) throw aliasReadError;
        return NextResponse.json({ code: alias.owner_code }, { headers });
      }
    }
    const token = randomBytes(32).toString("base64url");
    const code = randomBytes(16).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { error: shareError } = await db.from("subscription_shares").upsert(
      {
        owner_id: user.id,
        plan_id: planId,
        member_id: memberId,
        token_hash: tokenHash,
        owner_token: token,
        owner_code: code,
        code_hash: createHash("sha256").update(code).digest("hex"),
        created_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,member_id", ignoreDuplicates: !replace },
    );
    if (shareError) throw shareError;
    const { data: saved, error: savedError } = await db
      .from("subscription_shares")
      .select("owner_token,owner_code")
      .eq("owner_id", user.id)
      .eq("member_id", memberId)
      .eq("plan_id", planId)
      .single();
    if (savedError) throw savedError;
    return NextResponse.json(
      { code: saved.owner_code, token: saved.owner_token },
      { headers },
    );
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "SIZE")
    )
      return NextResponse.json(
        { error: "Invalid sharing request." },
        { status: 400, headers },
      );
    return failed(error);
  }
}
