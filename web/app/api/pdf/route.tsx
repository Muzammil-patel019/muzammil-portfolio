import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ResumePDF } from "@/components/ResumePDF";
import { owner, apiError, readJSON, publicResume } from "@/lib/server";
import { resumeSchema, type Resume } from "@/lib/resume";
import { resumeFilename } from "@/lib/resume-filename";
export const runtime = "nodejs";
async function pdf(resume: Resume) {
  const buffer = await renderToBuffer(<ResumePDF resume={resume} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${resumeFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
export async function GET() {
  return pdf(await publicResume());
}
export async function POST(req: NextRequest) {
  try {
    await owner(req);
    const parsed = resumeSchema.safeParse(await readJSON(req));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid resume fields." },
        { status: 400 },
      );
    return await pdf(parsed.data);
  } catch (e) {
    return apiError(e);
  }
}
