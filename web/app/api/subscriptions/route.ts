import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { owner, apiError, readJSON } from "@/lib/server";
import { documentSchema } from "@/lib/subscriptions";

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
      .from("subscription_plans")
      .select("document,revision")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(data, { headers });
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const parsed = z
      .object({
        document: documentSchema,
        revision: z.number().int().nonnegative().max(2_000_000_000),
      })
      .strict()
      .safeParse(await readJSON(request));
    if (!parsed.success)
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Invalid subscription data.",
        },
        { status: 400, headers },
      );
    const { document, revision } = parsed.data;
    const query =
      revision === 0
        ? db
            .from("subscription_plans")
            .insert({ owner_id: user.id, document, revision: 1 })
        : db
            .from("subscription_plans")
            .update({ document, revision: revision + 1 })
            .eq("owner_id", user.id)
            .eq("revision", revision);
    const { data, error } = await query.select("revision").maybeSingle();
    if (error?.code === "23505" || (!error && !data))
      return NextResponse.json(
        {
          error:
            "This plan changed on another device. Load the latest version before saving.",
        },
        { status: 409, headers },
      );
    if (error) throw error;
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "SIZE")
    )
      return NextResponse.json(
        { error: "Invalid or oversized subscription data." },
        { status: 400, headers },
      );
    return failed(error);
  }
}
