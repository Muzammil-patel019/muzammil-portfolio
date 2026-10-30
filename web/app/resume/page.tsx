import { Header } from "@/components/Header";
import { ResumePreview } from "@/components/ResumePreview";
import { publicResume } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function Page() {
  const r = await publicResume();
  return (
    <>
      <Header />
      <main id="main" className="subpage-main">
        <div className="subpage-hero">
          <p className="eyebrow">PORTFOLIO / RESUME</p>
          <h1>Experience and technical skills.</h1>
        </div>
        <div className="resume-toolbar">
          <a className="button" href="/api/pdf">
            Download latest PDF
          </a>
        </div>
        <ResumePreview resume={r} />
      </main>
    </>
  );
}
