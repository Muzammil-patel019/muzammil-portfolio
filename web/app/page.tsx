import { Header } from "@/components/Header";
import { Desk } from "@/components/Desk";
import { Projects } from "@/components/Projects";
import { publicResume } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function Home() {
  const r = await publicResume();
  return (
    <>
      <Header />
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              {r.name.toUpperCase()} / {r.title.toUpperCase()}
            </p>
            <h1>
              Good software.
              <br />
              <em>Bad day</em>
              <br />
              for bugs<span className="headline-dot">.</span>
            </h1>
            <p className="hero-line">
              A curious mind. A very thorough test suite.
            </p>
            <p className="intro">{r.summary}</p>
            <div className="hero-actions">
              <a className="button" href="/resume">
                Read my resume ↗
              </a>
              <a className="button secondary" href="/api/pdf">
                Download PDF ↓
              </a>
              <a className="text-link" href="#experience">
                Explore my experience ↓
              </a>
            </div>
          </div>
          <Desk />
        </section>
        <section className="section" id="experience">
          <div className="section-heading">
            <p className="eyebrow">01 / EXPERIENCE</p>
            <h2>
              Serious work.
              <br />
              <em>Curious approach.</em>
            </h2>
          </div>
          <div className="employer">
            <h3>AlgoShack Technologies</h3>
            <p>Test Automation Engineer · April 2024 – Present</p>
          </div>
          <Projects projects={r.projects} />
        </section>
        <section className="section" id="skills">
          <div className="section-heading">
            <p className="eyebrow">02 / TOOLKIT</p>
            <h2>
              My kind of
              <br />
              <em>power tools.</em>
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {r.skills.map((s, i) => (
              <span
                className="rounded-full border border-violet-300 bg-violet-100 px-4 py-2 text-sm"
                key={`${s}-${i}`}
              >
                {s}
              </span>
            ))}
          </div>
        </section>
        <section id="contact" className="contact section">
          <div className="contact-card contact-simple">
            <p className="eyebrow">03 / CONTACT</p>
            <h2>Let’s connect.</h2>
            <p className="contact-intro">
              For test automation roles, project conversations, or a quick
              hello.
            </p>
            <a className="email" href={`mailto:${r.email}`}>
              <span />
              <span>
                <small>Email</small>
                {r.email}
              </span>
            </a>
            <div className="social-links">
              <a href="https://github.com/Muzammil-patel019">GitHub ↗</a>
              <a href="https://www.linkedin.com/in/muzammil-patel-375381224/">
                LinkedIn ↗
              </a>
            </div>
            <p className="contact-location">{r.location}</p>
          </div>
        </section>
      </main>
      <footer>
        <span>Portfolio of {r.name}</span>
        <a href="/login">Owner login</a>
      </footer>
    </>
  );
}
