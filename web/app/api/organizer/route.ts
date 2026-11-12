import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { owner, apiError } from "@/lib/server";
import { organizerSchema } from "@/lib/organizer";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
function failed(e: unknown) {
  const r = apiError(e);
  Object.entries(headers).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}
export async function GET(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const [tracker, versions] = await Promise.allSettled([
      db
        .from("personal_organizers")
        .select("document,revision")
        .eq("owner_id", user.id)
        .maybeSingle(),
      db
        .from("resume_versions")
        .select("id,name,kind")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false }),
    ]);
    if (tracker.status === "rejected" || tracker.value.error)
      throw new Error("DATABASE");
    return NextResponse.json(
      {
        ...(tracker.value.data || {}),
        resumeVersions:
          versions.status === "fulfilled" && !versions.value.error
            ? versions.value.data
            : [],
        versionsAvailable:
          versions.status === "fulfilled" && !versions.value.error,
      },
      { headers },
    );
  } catch (e) {
    return failed(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const raw = await request.text();
    if (raw.length > 2_000_000) throw new Error("SIZE");
    const { document, revision } = z
      .object({
        document: organizerSchema,
        revision: z.number().int().min(0).max(2_000_000_000),
      })
      .strict()
      .parse(JSON.parse(raw));
    const query =
      revision === 0
        ? db
            .from("personal_organizers")
            .insert({ owner_id: user.id, document, revision: 1 })
        : db
            .from("personal_organizers")
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
            "Your organizer changed on another device. Reload before saving again.",
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
              : "Invalid or oversized organizer data.",
        },
        { status: 400, headers },
      );
    return failed(e);
  }
}
