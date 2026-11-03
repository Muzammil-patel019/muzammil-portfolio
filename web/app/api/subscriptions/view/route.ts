import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
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
    ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
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
