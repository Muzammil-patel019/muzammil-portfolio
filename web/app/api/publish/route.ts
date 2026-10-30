import { NextRequest, NextResponse } from "next/server";
import { owner, apiError, readJSON } from "@/lib/server";
import { resumeSchema } from "@/lib/resume";
export async function POST(req: NextRequest) {
  try {
    const { db, user } = await owner(req);
    const parsed = resumeSchema.safeParse(await readJSON(req));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid resume fields." },
        { status: 400 },
      );
    const { error } = await db
      .from("published_resume")
      .upsert({
        id: 1,
        document: parsed.data,
        published_by: user.id,
        published_at: new Date().toISOString(),
      });
    if (error) throw error;
    return NextResponse.json({ published: true });
  } catch (e) {
    if (
      e instanceof SyntaxError ||
      (e instanceof Error && e.message === "SIZE")
    )
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    return apiError(e);
  }
}
