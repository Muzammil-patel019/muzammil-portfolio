"use client";
import { useState } from "react";
import type { Resume } from "@/lib/resume";

export function WorkShowcase({ projects }: { projects: Resume["projects"] }) {
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, projects.length - 1);
  const project = projects[index];
  if (!project) return null;
  function step(direction: number) {
    setSelected((index + direction + projects.length) % projects.length);
  }
  return (
    <aside className="work-showcase" aria-label="Selected automation work">
      <div className="showcase-topline">
        <span>INSIDE MY WORK</span>
        <span>
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(projects.length).padStart(2, "0")}
        </span>
      </div>
      <div className="showcase-art" aria-hidden="true">
        <svg viewBox="0 0 380 150" fill="none">
          <path
            d="M92 77H288"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
          <rect
            x="20"
            y="20"
            width="100"
            height="110"
            rx="8"
            fill="#fffdf8"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M20 43H120" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="31" cy="32" r="3" fill="#b4a0e5" />
          <circle cx="42" cy="32" r="3" fill="#d8f27b" />
          <path
            d="m55 65-12 12 12 12m30-24 12 12-12 12m-10-30-10 36"
            stroke="#5540c6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="145"
            y="42"
            width="90"
            height="70"
            rx="8"
            fill="#d8f27b"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="m171 77 13 13 26-28"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="260"
            y="20"
            width="100"
            height="110"
            rx="8"
            fill="#fffdf8"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M277 45h45m-45 16h65m-65 16h38m-38 16h57m-57 16h30"
            stroke="#a99abd"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <div className="showcase-process">
          <span>WORKFLOW</span>
          <span>VALIDATION</span>
          <span>EVIDENCE</span>
        </div>
      </div>
      <div className="showcase-detail" key={project.id}>
        <p className="showcase-category">
          {project.type.toUpperCase()} AUTOMATION /{" "}
          {project.client.toUpperCase()}
        </p>
        <h2>{project.name}</h2>
        <p className="showcase-date">{project.dates}</p>
        <p className="showcase-description">
          {project.bullets[0] || "Explore the project experience below."}
        </p>
        <div className="showcase-tools">
          {project.tools.map((tool, i) => (
            <span key={`${tool}-${i}`}>{tool}</span>
          ))}
        </div>
        <a className="showcase-link" href={`/projects#project-${project.id}`}>
          Explore this project{" "}
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              d="M5 19 19 5M5 5h14v14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </a>
      </div>
      <div className="showcase-controls">
        <span>TAKE A CLOSER LOOK</span>
        <div>
          <button
            type="button"
            aria-label="Previous project"
            onClick={() => step(-1)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next project"
            onClick={() => step(1)}
          >
            →
          </button>
        </div>
      </div>
      <div
        className="showcase-picker"
        role="group"
        aria-label="Choose featured project"
      >
        {projects.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={index === i}
            onClick={() => setSelected(i)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <p className="showcase-announcement" role="status">
        Showing {project.name}, {project.client}.
      </p>
    </aside>
  );
}
