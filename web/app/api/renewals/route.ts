import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { owner, apiError, readJSON } from "@/lib/server";
import { renewalDocumentSchema } from "@/lib/renewals";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
function failed(e: unknown) {
  const response = apiError(e);
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}
export async function GET(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const { data, error } = await db
      .from("renewal_trackers")
      .select("document,revision")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(data, { headers });
  } catch (e) {
    return failed(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const { document, revision } = z
      .object({
        document: renewalDocumentSchema,
        revision: z.number().int().min(0).max(2_000_000_000),
      })
      .strict()
      .parse(await readJSON(request));
    const query =
      revision === 0
        ? db
            .from("renewal_trackers")
            .insert({ owner_id: user.id, document, revision: 1 })
        : db
            .from("renewal_trackers")
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
          error: "Renewals changed in another tab. Reload before saving again.",
        },
        { status: 409, headers },
      );
    if (error) throw error;
    return NextResponse.json(data, { headers });
  } catch (e) {
    if (
      e instanceof z.ZodError ||
      e instanceof SyntaxError ||
      (e instanceof Error && e.message === "SIZE")
    )
      return NextResponse.json(
        {
          error:
            e instanceof z.ZodError
              ? e.issues[0]?.message
              : "Invalid or oversized renewal data.",
        },
        { status: 400, headers },
      );
    return failed(e);
  }
}
