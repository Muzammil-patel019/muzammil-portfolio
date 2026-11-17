import type { Resume } from "@/lib/resume";
import { groupSkills } from "@/lib/resume-layout";
import {
  orderedSections,
  sectionLabels,
  textLines,
  profileLinks,
} from "@/lib/resume-builder";
export function ResumePreview({ resume: r }: { resume: Resume }) {
  const sections = {
    summary: r.summary && <p>{r.summary}</p>,
    skills: r.skills.filter((s) => s.trim()).length > 0 && (
      <dl className="resume-skill-groups">
        {groupSkills(r.skills.filter((s) => s.trim())).map((g) => (
          <div key={g.label}>
            <dt>{g.label}</dt>
            <dd>{g.skills.join(" · ")}</dd>
          </div>
        ))}
      </dl>
    ),
    projects:
      r.projects.length > 0 &&
      r.projects.map((p) => (
        <section className="resume-project" key={p.id}>
          <div className="resume-project-heading">
            <div>
              <h4>{p.name}</h4>
              <p className="resume-client">Client: {p.client}</p>
            </div>
            <p className="resume-dates">{p.dates}</p>
          </div>
          {p.tools.filter(Boolean).length > 0 && (
            <p className="resume-tools">
              <strong>Environment:</strong>{" "}
              {p.tools.filter(Boolean).join(" · ")}
            </p>
          )}
          <ul>
            {p.bullets
              .filter((b) => b.trim())
              .map((b, i) => (
                <li key={i}>{b}</li>
              ))}
          </ul>
        </section>
      )),
    education: r.education && <p className="resume-education">{r.education}</p>,
    certifications: textLines(r.certifications).length > 0 && (
      <ul>
        {textLines(r.certifications).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    ),
    achievements: textLines(r.achievements).length > 0 && (
      <ul>
        {textLines(r.achievements).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    ),
  };
  return (
    <article
      className={`resume-preview resume-template-${r.template || "professional"} ${r.layout === "compact" ? "resume-compact" : "resume-comfortable"}`}
      aria-label={`${r.name} resume preview`}
    >
      <header className="resume-heading">
        <h2>{r.name}</h2>
        <p className="resume-role">{r.title}</p>
        <div className="resume-contact">
          {[r.location, r.email, r.phone].filter(Boolean).map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>
        {profileLinks(r).length > 0 && (
          <div className="resume-contact resume-links">
            {profileLinks(r).map((l) => (
              <span key={l.label}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.url.replace(/^https?:\/\//, "")}
                </a>
              </span>
            ))}
          </div>
        )}
      </header>
      {orderedSections(r).map((key) =>
        sections[key] ? (
          <section
            className="resume-section"
            data-resume-section={key}
            key={key}
          >
            <h3 className="resume-section-title">{sectionLabels[key]}</h3>
            {sections[key]}
          </section>
        ) : null,
      )}
    </article>
  );
}
