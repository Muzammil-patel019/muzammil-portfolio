import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { owner, apiError, readJSON } from "@/lib/server";
import { cardsDocumentSchema } from "@/lib/cards";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
function failed(error: unknown) {
  const response = apiError(error);
  for (const [key, value] of Object.entries(headers))
    response.headers.set(key, value);
  return response;
}
export async function GET(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const { data, error } = await db
      .from("card_trackers")
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
        document: cardsDocumentSchema,
        revision: z.number().int().nonnegative().max(2_000_000_000),
      })
      .strict()
      .parse(await readJSON(request));
    const { document, revision } = parsed;
    const query =
      revision === 0
        ? db
            .from("card_trackers")
            .insert({ owner_id: user.id, document, revision: 1 })
        : db
            .from("card_trackers")
            .update({
              document,
              revision: revision + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("owner_id", user.id)
            .eq("revision", revision);
    const { data, error } = await query.select("revision").maybeSingle();
    if (error?.code === "23505" || (!error && !data))
      return NextResponse.json(
        {
          error:
            "This tracker changed in another tab. Reload before saving again.",
        },
        { status: 409, headers },
      );
    if (error) throw error;
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (
      error instanceof z.ZodError ||
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "SIZE")
    )
      return NextResponse.json(
        {
          error:
            error instanceof z.ZodError
              ? error.issues[0]?.message
              : "Invalid or oversized card data.",
        },
        { status: 400, headers },
      );
    return failed(error);
  }
}
