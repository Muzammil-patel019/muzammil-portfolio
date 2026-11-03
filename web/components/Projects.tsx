"use client";
import { useState } from "react";
import type { Resume } from "@/lib/resume";
export function Projects({ projects }: { projects: Resume["projects"] }) {
  const [filter, setFilter] = useState("All work");
  return (
    <>
      <div className="work-filters" role="group" aria-label="Filter projects">
        {["All work", "Desktop", "Web"].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="experience-grid">
        {projects
          .filter((p) => filter === "All work" || p.type === filter)
          .map((p) => (
            <article key={p.id} id={`project-${p.id}`} className="card">
              <div className="project-info">
              <p className="meta">
                {p.client.toUpperCase()} / {p.dates}
              </p>
              <h3>{p.name}</h3>
              <p className="tags">{p.tools.join(" · ")}</p>
              </div>
              <ul>
                {p.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
      </div>
    </>
  );
}
