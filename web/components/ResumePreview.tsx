import type { Resume } from "@/lib/resume";
import { groupSkills } from "@/lib/resume-layout";
export function ResumePreview({ resume: r }: { resume: Resume }) {
  return (
    <article className="resume-preview" aria-label={`${r.name} resume preview`}>
      <header className="resume-heading">
        <h2>{r.name}</h2>
        <p className="resume-role">{r.title}</p>
        <div className="resume-contact">
          {[r.location, r.email, r.phone].filter(Boolean).map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
      </header>
      <section className="resume-section">
        <h3 className="resume-section-title">Professional summary</h3>
        <p>{r.summary}</p>
      </section>
      {r.skills.length > 0 && (
        <section className="resume-section">
          <h3 className="resume-section-title">Technical skills</h3>
          <dl className="resume-skill-groups">
            {groupSkills(r.skills).map((g) => (
              <div key={g.label}>
                <dt>{g.label}</dt>
                <dd>{g.skills.join(" · ")}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className="resume-section">
        <h3 className="resume-section-title">Professional experience</h3>
        {r.projects.map((p) => (
          <section className="resume-project" key={p.id}>
            <div className="resume-project-heading">
              <div>
                <h4>{p.name}</h4>
                <p className="resume-client">Client: {p.client}</p>
              </div>
              <p className="resume-dates">{p.dates}</p>
            </div>
            {p.tools.length > 0 && (
              <p className="resume-tools">
                <strong>Environment:</strong> {p.tools.join(" · ")}
              </p>
            )}
            <ul>
              {p.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>
        ))}
      </section>
      {r.education && (
        <section className="resume-section">
          <h3 className="resume-section-title">Education</h3>
          <p className="resume-education">{r.education}</p>
        </section>
      )}
    </article>
  );
}
