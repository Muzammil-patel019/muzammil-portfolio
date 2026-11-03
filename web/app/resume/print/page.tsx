import { ResumePreview } from "@/components/ResumePreview";
import { publicResume } from "@/lib/server";
import { PrintResume } from "@/components/PrintResume";
export const dynamic = "force-dynamic";
export default async function PrintPage() {
  return <main className="print-resume"><div className="print-controls"><a href="/resume">← Resume</a><PrintResume /></div><ResumePreview resume={await publicResume()} /></main>;
}
