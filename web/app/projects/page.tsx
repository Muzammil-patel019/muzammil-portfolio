import { Header } from "@/components/Header";
import { Projects } from "@/components/Projects";
import { publicResume } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function Page() {
  const r = await publicResume();
  return (
    <>
      <Header />
      <main id="main" className="subpage-main">
        <div className="subpage-hero">
          <p className="eyebrow">PORTFOLIO / PROJECTS</p>
          <h1>Automation in healthcare software.</h1>
          <p>Selected client work across desktop and web test automation.</p>
        </div>
        <Projects projects={r.projects} />
      </main>
    </>
  );
}
