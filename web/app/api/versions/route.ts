import { NextRequest, NextResponse } from "next/server";
import { owner, apiError, readJSON } from "@/lib/server";
import { saveSchema } from "@/lib/resume";
export async function GET(req: NextRequest) {
  try {
    const { db, user } = await owner(req);
    const { data, error } = await db
      .from("resume_versions")
      .select("id,name,kind,document,updated_at")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const { db, user } = await owner(req);
    const parsed = saveSchema.safeParse(await readJSON(req));
    if (!parsed.success)
      return NextResponse.json(
        {
          error:
            "Check the resume fields. All project names, dates, and bullet points must be filled in.",
        },
        { status: 400 },
      );
    const { id, name, kind, document, updatedAt } = parsed.data;
    const values = { name, kind, document, owner_id: user.id };
    if (id && !updatedAt)
      return NextResponse.json(
        { error: "Reload this version before saving." },
        { status: 400 },
      );
    const query = id
      ? db
          .from("resume_versions")
          .update(values)
          .eq("id", id)
          .eq("owner_id", user.id)
          .eq("updated_at", updatedAt!)
      : db.from("resume_versions").insert(values);
    const { data, error } = await query
      .select("id,name,kind,document,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return NextResponse.json(
        {
          error:
            "This version changed in another tab. Reload it before saving.",
        },
        { status: 409 },
      );
    return NextResponse.json(data);
  } catch (e) {
    if (
      e instanceof SyntaxError ||
      (e instanceof Error && e.message === "SIZE")
    )
      return NextResponse.json(
        { error: "Invalid or oversized resume." },
        { status: 400 },
      );
    return apiError(e);
  }
}
