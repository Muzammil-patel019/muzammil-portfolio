"use client";
import type { Resume } from "@/lib/resume";
import {
  orderedSections,
  sectionLabels,
  moveSection,
  resumeChecks,
} from "@/lib/resume-builder";
export function ResumeControls({
  resume,
  onChange,
  onJump,
}: {
  resume: Resume;
  onChange: (r: Resume) => void;
  onJump: (id: string) => void;
}) {
  const checks = resumeChecks(resume);
  return (
    <div className="studio-builder-controls">
      <section aria-labelledby="studio-style-title">
        <p className="studio-eyebrow">MAKE IT YOURS</p>
        <h2 id="studio-style-title">Document style</h2>
        <div
          className="studio-template-options"
          role="group"
          aria-label="Document style"
        >
          {(
            [
              {
                id: "professional",
                name: "Professional",
                hint: "Balanced · sans serif",
              },
              { id: "classic", name: "Classic", hint: "Traditional · serif" },
              {
                id: "modern",
                name: "Modern",
                hint: "Left aligned · sans serif",
              },
            ] as const
          ).map((style) => (
            <button
              key={style.id}
              type="button"
              aria-pressed={(resume.template || "professional") === style.id}
              onClick={() => onChange({ ...resume, template: style.id })}
            >
              <span
                className={`studio-template-sample template-${style.id}`}
                aria-hidden="true"
              >
                <b>Aa</b>
                <i />
                <i />
                <i />
              </span>
              <span>
                <strong>{style.name}</strong>
                <small>{style.hint}</small>
              </span>
            </button>
          ))}
        </div>
        <p className="studio-control-note">
          Single column in every style. PDF spacing can differ from the live
          preview.
        </p>
      </section>
      <section aria-labelledby="studio-order-title">
        <h2 id="studio-order-title">Section order</h2>
        <p className="studio-control-note">
          Put your strongest evidence first. Empty optional sections stay out of
          exports.
        </p>
        <ol className="studio-section-order">
          {orderedSections(resume).map((key, i) => (
            <li key={key}>
              <button
                className="studio-section-jump"
                type="button"
                onClick={() => onJump(key)}
              >
                {sectionLabels[key]}
              </button>
              <div>
                <button
                  type="button"
                  aria-label={`Move ${sectionLabels[key]} up`}
                  disabled={i === 0}
                  onClick={() => onChange(moveSection(resume, key, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${sectionLabels[key]} down`}
                  disabled={i === orderedSections(resume).length - 1}
                  onClick={() => onChange(moveSection(resume, key, 1))}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section
        aria-labelledby="studio-check-title"
        className="studio-resume-check"
      >
        <h2 id="studio-check-title">Before you send</h2>
        <p>
          {checks.filter((c) => c.ok).length} of {checks.length} checks met
        </p>
        <progress
          max={checks.length}
          value={checks.filter((c) => c.ok).length}
          aria-label="Resume checklist completion"
        />
        <ul>
          {checks.map((c) => (
            <li key={c.id} data-complete={c.ok}>
              <span aria-hidden="true">{c.ok ? "✓" : "○"}</span>
              <div>
                <strong>{c.label}</strong>
                {!c.ok && <p>{c.hint}</p>}
              </div>
              <span className="sr-only">{c.ok ? "Met" : "Review"}</span>
            </li>
          ))}
        </ul>
        <p className="studio-control-note">
          Writing guidance, not an ATS score or hiring prediction. Check the
          downloaded PDF for page breaks.
        </p>
      </section>
    </div>
  );
}
