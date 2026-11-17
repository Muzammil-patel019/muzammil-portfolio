"use client";
import { useState } from "react";
import { milestones, exercises } from "@/lib/lab/learning";
export function LearningPath({
  completed,
  onToggle,
  onExplore,
}: {
  completed: string[];
  onToggle: (id: string) => void;
  onExplore: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <section className="lab-learning-intro">
        <div>
          <p className="lab-eyebrow">BUILD UNDERSTANDING, THEN ABSTRACTIONS</p>
          <h2>A framework you can explain.</h2>
          <p>
            First explore the app. Write a few clear tests. Extract reusable
            pieces when repetition makes their purpose obvious.
          </p>
          <button className="lab-primary" onClick={onExplore}>
            Explore the API →
          </button>
          <a className="lab-text-link" href="/lab/starter.zip" download>
            Download Python starter ↓
          </a>
        </div>
        <div className="lab-learning-card">
          <span>STAGE 01 / 10</span>
          <strong>
            {completed.length}
            <small> / 10</small>
          </strong>
          <p>exploration exercises marked complete</p>
          <progress
            value={completed.length}
            max={exercises.length}
            aria-label="Exploration progress"
          />
          <small>
            Self-marked on this browser. This is a learning checklist, not an
            automated test result.
          </small>
        </div>
      </section>
      <section className="lab-panel">
        <div className="lab-section-title">
          <div>
            <p className="lab-eyebrow">START HERE</p>
            <h2>Ten small investigations.</h2>
          </div>
          <span className="lab-pill">Stage 1 · ready</span>
        </div>
        <div className="lab-exercises">
          {exercises.map((task, i) => (
            <article key={task.id} data-testid={"exercise-" + task.id}>
              <div className="lab-exercise-number">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <span className="lab-task-kind">{task.kind}</span>
                <h3>{task.title}</h3>
                <p>{task.task}</p>
                <details>
                  <summary>Expected behaviour & hint</summary>
                  <p>
                    <b>Expected:</b> {task.expected}
                  </p>
                  <p>{task.hint}</p>
                </details>
                <label className="lab-check">
                  <input
                    type="checkbox"
                    checked={completed.includes(task.id)}
                    onChange={() => onToggle(task.id)}
                  />
                  I checked this myself
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="lab-panel">
        <p className="lab-eyebrow">YOUR NEXT STEP</p>
        <h2>Read your first API test.</h2>
        <p className="lab-muted">
          The starter has two pytest API tests and one Playwright browser test.
          Run them directly before adding page objects, clients or fixtures.
        </p>
        <pre className="lab-code">{`import os\nimport httpx\n\nBASE = os.getenv("LAB_BASE_URL", "http://127.0.0.1:3000")\n\ndef test_health():\n    response = httpx.get(f"{BASE}/api/lab/health", timeout=10)\n    assert response.status_code == 200\n    assert response.json()["status"] == "ok"`}</pre>
        <button
          className="lab-subtle"
          aria-expanded={open === "setup"}
          onClick={() => setOpen(open === "setup" ? null : "setup")}
        >
          How to run the starter {open === "setup" ? "−" : "+"}
        </button>
        {open === "setup" && (
          <div className="lab-setup">
            <ol>
              <li>Download and unzip the starter.</li>
              <li>
                Create a virtual environment: <code>python -m venv .venv</code>.
                Activate it using the instructions in its README.
              </li>
              <li>
                Run <code>python -m pip install -r requirements.txt</code> and{" "}
                <code>python -m playwright install chromium</code>.
              </li>
              <li>
                Start this app locally with{" "}
                <code>npm --prefix web run dev</code>, or set LAB_BASE_URL to
                this website’s origin.
              </li>
              <li>
                Run <code>python -m pytest -v</code>. Start with the API tests
                if you have not installed a browser yet.
              </li>
            </ol>
            <p>
              Use public dummy lab endpoints only. No owner credentials or
              payment details are needed.
            </p>
          </div>
        )}
      </section>
      <section className="lab-roadmap-section">
        <p className="lab-eyebrow">ONE MILESTONE AT A TIME</p>
        <h2>The full learning path</h2>
        <div className="lab-roadmap">
          {milestones.map((m) => (
            <article key={m.number} data-available={m.available}>
              <span>{String(m.number).padStart(2, "0")}</span>
              <div>
                <small>{m.available ? "AVAILABLE NOW" : "PLANNED"}</small>
                <h3>{m.title}</h3>
                <p>{m.description}</p>
                <code>{m.topics}</code>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
