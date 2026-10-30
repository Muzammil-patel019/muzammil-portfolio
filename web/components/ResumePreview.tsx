import type { Resume } from "@/lib/resume";
export function ResumePreview({ resume: r }: { resume: Resume }) {
  return (
    <article className="resume-preview">
      <h2>{r.name}</h2>
      <p>{r.title}</p>
      <p>
        {r.location} | {r.email} | {r.phone}
      </p>
      <h3>Profile</h3>
      <p>{r.summary}</p>
      <h3>Skills</h3>
      <p>{r.skills.join(" / ")}</p>
      <h3>Experience</h3>
      {r.projects.map((p) => (
        <section key={p.id}>
          <h4 className="font-bold">
            {p.name} — {p.client}
          </h4>
          <p>{p.dates}</p>
          <p>{p.tools.join(" / ")}</p>
          <ul>
            {p.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      ))}
      <h3>Education</h3>
      <p className="whitespace-pre-line">{r.education}</p>
    </article>
  );
}
