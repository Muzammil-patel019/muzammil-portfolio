import { Header } from "@/components/Header";
export default function Page() {
  return (
    <>
      <Header />
      <main id="main" className="subpage-main">
        <div className="subpage-hero">
          <p className="eyebrow">PORTFOLIO / BLOG</p>
          <h1>Notes from the test bench.</h1>
          <p>Automation, debugging, and software quality.</p>
        </div>
        <div className="empty-note">
          No articles published yet.{" "}
          <a href="/projects">Explore my project experience.</a>
        </div>
      </main>
    </>
  );
}
