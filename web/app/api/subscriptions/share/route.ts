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
      .select("member_id,cycle_id,reported_at")
      .eq("owner_id", user.id)
      .eq(
        "plan_id",
        request.nextUrl.searchParams.get("planId") ||
          "00000000-0000-0000-0000-000000000000",
      )
      .not("reported_at", "is", null);
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
    if (!replace) {
      const { data: existing, error: lookupError } = await db
        .from("subscription_shares")
        .select("owner_token")
        .eq("owner_id", user.id)
        .eq("member_id", memberId)
        .eq("plan_id", planId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing)
        return NextResponse.json(
          existing.owner_token
            ? { token: existing.owner_token }
            : { needsReplacement: true },
          { headers },
        );
    }
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { error: shareError } = await db.from("subscription_shares").upsert(
      {
        owner_id: user.id,
        plan_id: planId,
        member_id: memberId,
        token_hash: tokenHash,
        owner_token: token,
        created_at: new Date().toISOString(),
      },
      { onConflict: "owner_id,member_id", ignoreDuplicates: !replace },
    );
    if (shareError) throw shareError;
    const { data: saved, error: savedError } = await db
      .from("subscription_shares")
      .select("owner_token")
      .eq("owner_id", user.id)
      .eq("member_id", memberId)
      .eq("plan_id", planId)
      .single();
    if (savedError) throw savedError;
    return NextResponse.json(
      saved.owner_token
        ? { token: saved.owner_token }
        : { needsReplacement: true },
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
