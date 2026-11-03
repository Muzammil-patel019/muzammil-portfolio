import { DownloadResume } from "@/components/DownloadResume";
import { Header } from "@/components/Header";
import { publicResume } from "@/lib/server";
import { groupSkills } from "@/lib/resume-layout";
export const dynamic = "force-dynamic";

function Arrow() {
  return <svg className="inline-arrow" aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 13 13 3M3 3h10v10" stroke="currentColor" strokeWidth="1.3" /></svg>;
}

export default async function Home() {
  const r = await publicResume();
  const initials = r.name.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join("");
  return (
    <>
      <Header />
      <main id="main" className="portfolio-home">
        <section className="profile-intro" aria-labelledby="profile-name">
          <div className="profile-heading">
            <span className="profile-mark" aria-hidden="true">{initials}<span>.</span></span>
            <div><p className="eyebrow">{r.title}</p><h1 id="profile-name">{r.name}<span>.</span></h1><p className="profile-location">{r.location}</p></div>
          </div>
          <p className="profile-summary">{r.summary}</p>
          <div className="profile-actions">
            <a className="button" href="/resume">View resume <Arrow /></a>
            <DownloadResume resume={r} secondary />
            <a className="quiet-link" href={`mailto:${r.email}`}>Email me</a>
          </div>
          <div className="profile-footnote"><span>Desktop & web automation</span><span>Healthcare software</span></div>
        </section>

        <section className="home-section" id="experience" aria-labelledby="work-title">
          <div className="home-section-heading"><div><p className="eyebrow">01 / SELECTED WORK</p><h2 id="work-title">Software I help put to the test.</h2></div><a className="quiet-link" href="/projects">All project details <Arrow /></a></div>
          <div className="selected-projects">
            {r.projects.map((p, i) => <article className="project-teaser" key={p.id}>
              <div className="project-teaser-top"><span className="project-number">{String(i + 1).padStart(2, "0")}</span><span className="project-kind">{p.type} automation</span><span className="project-client">{p.client}</span></div>
              <div className="project-teaser-body"><div><h3><a href={`/projects#project-${p.id}`}>{p.name}<Arrow /></a></h3><p className="project-period">{p.dates}</p></div><p className="project-excerpt">{p.bullets[0] || "View project responsibilities and tools."}</p></div>
              <div className="project-teaser-bottom"><ul aria-label={`${p.name} tools`}>{p.tools.map((tool, index) => <li key={`${tool}-${index}`}>{tool}</li>)}</ul><a href={`/projects#project-${p.id}`} aria-label={`Read about ${p.name}`}>Read project <span aria-hidden="true">→</span></a></div>
            </article>)}
          </div>
        </section>

        <section className="home-section background-section" aria-labelledby="background-title">
          <div className="home-section-heading"><div><p className="eyebrow">02 / BACKGROUND</p><h2 id="background-title">Engineering, with a testing mindset.</h2></div></div>
          <div className="background-row"><span className="background-year">2024 — Present</span><div><h3>AlgoShack Technologies</h3><p>Test Automation Engineer</p><p className="background-description">Manual and automated testing across healthcare desktop and web applications.</p></div></div>
          {r.education && <div className="background-row"><span className="background-year">EDUCATION</span><p className="education-copy">{r.education}</p></div>}
        </section>

        <section className="home-section" id="skills" aria-labelledby="tools-title">
          <div className="home-section-heading"><div><p className="eyebrow">03 / TOOLBOX</p><h2 id="tools-title">The tools behind the work.</h2></div></div>
          <dl className="toolbox-list">{groupSkills(r.skills).map(group => <div key={group.label}><dt>{group.label}</dt><dd>{group.skills.map(skill => <span key={skill}>{skill}</span>)}</dd></div>)}</dl>
        </section>

        <section className="learning-invitation" aria-labelledby="learning-title"><div><p className="eyebrow">LEARNING IN PRACTICE</p><h2 id="learning-title">A place to work through the fundamentals.</h2><p>Python, pytest and Java, with visual explanations and small exercises.</p></div><a className="quiet-link" href="/learning">Open learning hub <Arrow /></a></section>

        <section id="contact" className="home-contact" aria-labelledby="contact-title"><p className="eyebrow">04 / SAY HELLO</p><h2 id="contact-title">Let’s talk about quality.</h2><p>For test automation roles, project conversations, or a quick hello.</p><a className="contact-email" href={`mailto:${r.email}`}>{r.email}<Arrow /></a><div className="home-socials"><a href="https://github.com/Muzammil-patel019">GitHub</a><a href="https://www.linkedin.com/in/muzammil-patel-375381224/">LinkedIn</a><a href="/links">More links</a></div></section>
      </main>
      <footer><span>{r.name} · {r.title}</span><div><a href="/blog">Notes</a><a href="/login">Owner login</a></div></footer>
    </>
  );
}
