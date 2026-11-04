import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readJSON } from "@/lib/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export async function GET(request: NextRequest) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{22}|[A-Za-z0-9_-]{43})$/)?.[1];
  if (!token)
    return NextResponse.json(
      { error: "This link is invalid or has been revoked." },
      { status: 404, headers },
    );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    return NextResponse.json(
      { error: "Shared plans are not configured yet." },
      { status: 503, headers },
    );
  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    });
    const { data, error } = await db.rpc("get_subscription_share", {
      token_hash: createHash("sha256").update(token).digest("hex"),
    });
    if (error)
      return NextResponse.json(
        { error: "The shared plan could not be loaded. Try again shortly." },
        { status: 503, headers },
      );
    if (!data)
      return NextResponse.json(
        { error: "This link is invalid or has been revoked." },
        { status: 404, headers },
      );
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json(
      { error: "The shared plan could not be loaded. Try again shortly." },
      { status: 503, headers },
    );
  }
}

export async function POST(request: NextRequest) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{22}|[A-Za-z0-9_-]{43})$/)?.[1];
  if (!token)
    return NextResponse.json(
      { error: "Invalid personal link." },
      { status: 404, headers },
    );
  try {
    const parsed = z
      .object({
        cycleId: z.uuid(),
        action: z.enum(["opened", "paid", "preference"]),
        months: z
          .number()
          .int()
          .refine((n) => [1, 3, 6, 12].includes(n))
          .optional(),
      })
      .strict()
      .safeParse(await readJSON(request));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Choose a valid billing period." },
        { status: 400, headers },
      );
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key)
      return NextResponse.json(
        { error: "Payments are not configured." },
        { status: 503, headers },
      );
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.rpc(
      parsed.data.months
        ? "report_subscription_coverage"
        : "report_subscription_payment",
      {
        token_hash: createHash("sha256").update(token).digest("hex"),
        cycle_id: parsed.data.cycleId,
        report_action: parsed.data.action,
        ...(parsed.data.months ? { months: parsed.data.months } : {}),
      },
    );
    if (error)
      return NextResponse.json(
        {
          error:
            "Open the payment link first, wait 10 seconds, then try again. Your link or balance may have changed.",
        },
        { status: 400, headers },
      );
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json(
      { error: "Could not send the payment update. Try again." },
      { status: 400, headers },
    );
  }
}
