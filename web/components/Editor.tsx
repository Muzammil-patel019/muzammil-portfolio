"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { browserClient } from "@/lib/supabase";
import { resumeSchema, analyzeJD, type Resume } from "@/lib/resume";
import seed from "@/lib/seed.json";
import { ResumePreview } from "./ResumePreview";
type Version = {
  id: string;
  name: string;
  kind: "master" | "tailored";
  document: Resume;
  updated_at: string;
};
export function Editor() {
  const demo = useSearchParams().get("demo") === "1";
  const db = useMemo(() => browserClient(), []);
  const [ready, setReady] = useState(false),
    [token, setToken] = useState("");
  const [resume, setResume] = useState<Resume>(resumeSchema.parse(seed));
  const [versions, setVersions] = useState<Version[]>([]),
    [selected, setSelected] = useState<Version | null>(null),
    [name, setName] = useState("Master profile"),
    [kind, setKind] = useState<"master" | "tailored">("master");
  const [jd, setJd] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const analysis = analyzeJD(jd, resume);
  useEffect(() => {
    let mounted = true;
    if (demo) {
      setReady(true);
      return;
    }
    if (!db) {
      setMessage(
        "Login is not configured. Use the local demo or connect Supabase.",
      );
      return;
    }
    db.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        window.location.replace("/login");
        return;
      }
      setToken(data.session.access_token);
      try {
        const r = await fetch("/api/versions", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const body = await r.json();
        if (!r.ok) throw Error(body.error);
        if (mounted) {
          setVersions(body);
          setReady(true);
        }
      } catch (e) {
        if (mounted) setMessage((e as Error).message);
      }
    });
    const { data: listener } = db.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") window.location.replace("/login");
      if (session) setToken(session.access_token);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [db, demo]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(next: Resume) {
    setResume(next);
    setDirty(true);
    setMessage("");
  }
  function choose(v: Version) {
    if (
      dirty &&
      !window.confirm("Discard unsaved changes and open this version?")
    )
      return;
    setSelected(v);
    setResume(resumeSchema.parse(structuredClone(v.document)));
    setName(v.name);
    setKind(v.kind);
    setDirty(false);
    setMessage("Version loaded.");
  }
  async function request(path: string, body: unknown) {
    const r = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json();
      throw Error(e.error || "Request failed.");
    }
    return r;
  }
  async function save(copy = false) {
    const parsed = resumeSchema.safeParse(resume);
    if (!parsed.success) {
      setMessage(
        "Please fill in every required field. Use one bullet per line and comma-separated skills.",
      );
      return;
    }
    if (!name.trim()) {
      setMessage("Give this version a name.");
      return;
    }
    setBusy(true);
    try {
      if (demo) {
        const v: Version = {
          id: copy || !selected ? crypto.randomUUID() : selected.id,
          name,
          kind,
          document: structuredClone(parsed.data),
          updated_at: new Date().toISOString(),
        };
        setVersions((vs) => [v, ...vs.filter((x) => x.id !== v.id)]);
        setSelected(v);
        setDirty(false);
        setMessage(
          "Saved in this demo session only. Export JSON to keep a copy.",
        );
      } else {
        const r = await request("/api/versions", {
          ...(!copy && selected
            ? { id: selected.id, updatedAt: selected.updated_at }
            : {}),
          name,
          kind,
          document: parsed.data,
        });
        const v = await r.json();
        setVersions((vs) => [v, ...vs.filter((x) => x.id !== v.id)]);
        setSelected(v);
        setDirty(false);
        setMessage(
          "Private version saved. The public portfolio has not changed.",
        );
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function pdf() {
    const parsed = resumeSchema.safeParse(resume);
    if (!parsed.success) {
      setMessage("Complete the required fields before exporting.");
      return;
    }
    setBusy(true);
    try {
      if (demo) {
        const [{ pdf }, { ResumePDF }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("./ResumePDF"),
        ]);
        download(
          await pdf(<ResumePDF resume={parsed.data} />).toBlob(),
          "Muzammil_Patel_Resume.pdf",
        );
      } else {
        download(
          await (await request("/api/pdf", parsed.data)).blob(),
          "Muzammil_Patel_Resume.pdf",
        );
      }
      setMessage("PDF exported from the current preview.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    const parsed = resumeSchema.safeParse(resume);
    if (!parsed.success) {
      setMessage("Complete the required fields before publishing.");
      return;
    }
    if (
      !window.confirm(
        "Publish this resume to the public portfolio? Its name, contact details, skills, projects, and PDF will be visible to everyone. Private versions stay private.",
      )
    )
      return;
    setBusy(true);
    try {
      await request("/api/publish", parsed.data);
      setMessage(
        "Published. The public portfolio and public PDF now use this snapshot.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const field = (
    key: "name" | "title" | "email" | "phone" | "location",
    label: string,
  ) => (
    <div key={key}>
      <label htmlFor={key}>{label}</label>
      <input
        id={key}
        type={key === "email" ? "email" : "text"}
        value={resume[key]}
        onChange={(e) => change({ ...resume, [key]: e.target.value })}
      />
    </div>
  );
  if (!ready)
    return (
      <main className="studio p-8">
        <h1>Private resume studio</h1>
        <p role="status">{message || "Checking owner access…"}</p>
        <Link href="/login">Owner login</Link> ·{" "}
        <Link href="/admin?demo=1">Local demo</Link>
      </main>
    );
  return (
    <div className="studio">
      <div className="mx-auto max-w-400 p-4 md:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-violet-700"
              onClick={(event) => {
                if (
                  busy ||
                  (dirty &&
                    !window.confirm(
                      "Leave the studio and discard unsaved changes?",
                    ))
                )
                  event.preventDefault();
              }}
            >
              ← Portfolio
            </Link>
            <h1 className="mt-3!">
              Resume studio<span className="text-violet-600">.</span>
            </h1>
            <p className="mb-0! text-stone-500">
              A master profile. As many next chapters as you need.
            </p>
          </div>
          {!demo && (
            <button
              onClick={async () => {
                if (dirty && !confirm("Sign out and discard unsaved changes?"))
                  return;
                await db?.auth.signOut();
                window.location.assign("/login");
              }}
            >
              Sign out
            </button>
          )}
        </header>
        {demo && (
          <div className="notice mb-5">
            <b>Local demo.</b> No login or database is connected. Saves last
            only until you reload. JSON and PDF exports work locally; publishing
            is disabled.
          </div>
        )}
        <div role="status" aria-live="polite" className="notice mb-5">
          {message ||
            (dirty
              ? "Unsaved changes."
              : "Private by default. Save a version without changing your live website.")}
        </div>
        <fieldset
          disabled={busy}
          className="grid min-w-0 items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]"
        >
          <aside className="panel">
            <h2>Versions</h2>
            <label htmlFor="version-name">Version name</label>
            <input
              id="version-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
            <label htmlFor="kind">Purpose</label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as "master" | "tailored");
                setDirty(true);
              }}
            >
              <option value="master">Master profile</option>
              <option value="tailored">Tailored resume</option>
            </select>
            <div className="mt-4 grid gap-2">
              <button
                disabled={busy}
                className="primary"
                onClick={() => save()}
              >
                Save privately
              </button>
              <button disabled={busy} onClick={() => save(true)}>
                Save as new version
              </button>
              {versions.map((v) => (
                <button
                  key={v.id}
                  aria-pressed={selected?.id === v.id}
                  onClick={() => choose(v)}
                  className="text-left"
                >
                  {v.name}
                  <small className="block text-stone-500">{v.kind}</small>
                </button>
              ))}
            </div>
            <hr className="my-5 border-stone-200" />
            <button
              onClick={() =>
                download(
                  new Blob([JSON.stringify(resume, null, 2)], {
                    type: "application/json",
                  }),
                  "resume-backup.json",
                )
              }
            >
              Export JSON backup
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              className="mt-3"
              aria-label="Import resume JSON"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 200000) {
                  setMessage("Backup is too large.");
                  return;
                }
                try {
                  const parsed = resumeSchema.parse(JSON.parse(await f.text()));
                  if (
                    dirty &&
                    !confirm("Replace unsaved edits with this backup?")
                  )
                    return;
                  change(parsed);
                  setSelected(null);
                  setMessage("Backup imported. Save it as a private version.");
                } catch {
                  setMessage(
                    "Invalid backup. Import a JSON file exported by this studio.",
                  );
                } finally {
                  if (file.current) file.current.value = "";
                }
              }}
            />
          </aside>
          <section className="panel min-w-0">
            <h2>Edit your experience</h2>
            <label htmlFor="resume-layout">Resume layout</label>
            <select
              id="resume-layout"
              value={resume.layout || "comfortable"}
              onChange={(e) =>
                change({
                  ...resume,
                  layout: e.target.value as "comfortable" | "compact",
                })
              }
            >
              <option value="comfortable">Readable — full experience</option>
              <option value="compact">Compact — tighter spacing</option>
            </select>
            <p className="mt-2 text-xs text-stone-500">
              Readable uses larger text and allows additional pages. Compact
              saves space. Page count depends on your content.
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Use skills and tools that reflect your actual work. Changes appear
              in the preview immediately.
            </p>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {field("name", "Full name")}
              {field("title", "Professional title")}
              {field("email", "Email")}
              {field("phone", "Phone")}
              {field("location", "Location")}
            </div>
            <label htmlFor="summary">Profile summary</label>
            <textarea
              id="summary"
              value={resume.summary}
              onChange={(e) => change({ ...resume, summary: e.target.value })}
            />
            <label htmlFor="skills">Skills — separate with commas</label>
            <textarea
              id="skills"
              value={resume.skills.join(", ")}
              onChange={(e) =>
                change({
                  ...resume,
                  skills: e.target.value.split(",").map((x) => x.trim()),
                })
              }
            />
            {resume.projects.map((p, index) => (
              <fieldset
                key={p.id}
                className="mt-6 rounded-lg border border-stone-200 p-4"
              >
                <legend className="px-2 font-bold">
                  {p.name || "New project"}
                </legend>
                {(["name", "client", "dates"] as const).map((key) => (
                  <div key={key}>
                    <label htmlFor={`${p.id}-${key}`}>
                      {key === "dates"
                        ? "Timeline"
                        : key === "client"
                          ? "Client"
                          : "Project name"}
                    </label>
                    <input
                      id={`${p.id}-${key}`}
                      value={p[key]}
                      onChange={(e) =>
                        change({
                          ...resume,
                          projects: resume.projects.map((v, i) =>
                            i === index ? { ...v, [key]: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <label htmlFor={`${p.id}-type`}>Platform</label>
                <select
                  id={`${p.id}-type`}
                  value={p.type}
                  onChange={(e) =>
                    change({
                      ...resume,
                      projects: resume.projects.map((v, i) =>
                        i === index
                          ? { ...v, type: e.target.value as "Desktop" | "Web" }
                          : v,
                      ),
                    })
                  }
                >
                  <option>Desktop</option>
                  <option>Web</option>
                </select>
                <label htmlFor={`${p.id}-tools`}>
                  Project tools — separate with commas
                </label>
                <input
                  id={`${p.id}-tools`}
                  value={p.tools.join(", ")}
                  onChange={(e) =>
                    change({
                      ...resume,
                      projects: resume.projects.map((v, i) =>
                        i === index
                          ? {
                              ...v,
                              tools: e.target.value
                                .split(",")
                                .map((x) => x.trim()),
                            }
                          : v,
                      ),
                    })
                  }
                />
                <p
                  id={`${p.id}-wording-hint`}
                  className="mt-3 text-xs text-stone-500"
                >
                  Changing tools does not rewrite your responsibilities. Review
                  the wording below to keep this version consistent.
                </p>
                <label htmlFor={`${p.id}-bullets`}>
                  Responsibilities — one bullet per line
                </label>
                <textarea
                  id={`${p.id}-bullets`}
                  aria-describedby={`${p.id}-wording-hint`}
                  className="min-h-52!"
                  value={p.bullets.join("\n")}
                  onChange={(e) =>
                    change({
                      ...resume,
                      projects: resume.projects.map((v, i) =>
                        i === index
                          ? { ...v, bullets: e.target.value.split("\n") }
                          : v,
                      ),
                    })
                  }
                />
                <button
                  className="danger mt-3"
                  disabled={resume.projects.length === 1}
                  onClick={() => {
                    if (confirm(`Remove ${p.name} from this version?`))
                      change({
                        ...resume,
                        projects: resume.projects.filter((_, i) => i !== index),
                      });
                  }}
                >
                  Remove project
                </button>
              </fieldset>
            ))}
            <button
              className="mt-4"
              onClick={() =>
                change({
                  ...resume,
                  projects: [
                    ...resume.projects,
                    {
                      id: crypto.randomUUID(),
                      name: "New project",
                      client: "Client",
                      dates: "Dates",
                      type: "Web",
                      tools: [],
                      bullets: ["Describe your contribution."],
                    },
                  ],
                })
              }
            >
              + Add project
            </button>
            <label htmlFor="education">Education</label>
            <textarea
              id="education"
              value={resume.education}
              onChange={(e) => change({ ...resume, education: e.target.value })}
            />
          </section>
          <section className="min-w-0 space-y-5">
            <div className="panel">
              <h2>Job description match</h2>
              <label htmlFor="jd">Paste a job description</label>
              <textarea
                id="jd"
                value={jd}
                maxLength={30000}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Looking for Java, Selenium, SQL…"
              />
              {jd && (
                <div className="mt-3 text-sm">
                  <p>
                    <b>Already in your profile:</b>{" "}
                    {analysis.matched.join(", ") ||
                      "No recognized skills matched."}
                  </p>
                  <p>
                    <b>Not found in your profile:</b>{" "}
                    {analysis.missing.join(", ") ||
                      "None among recognized skills."}
                  </p>
                  <p className="text-xs text-stone-500">
                    Keyword comparison, not AI scoring. It never adds experience
                    or changes your resume automatically. Highlight relevant
                    work and add only skills you actually have.
                  </p>
                  <button
                    onClick={() => {
                      const wanted = analysis.matched.map((x) =>
                        x.toLowerCase(),
                      );
                      change({
                        ...resume,
                        skills: [...resume.skills].sort(
                          (a, b) =>
                            Number(wanted.includes(b.toLowerCase())) -
                            Number(wanted.includes(a.toLowerCase())),
                        ),
                      });
                      setMessage(
                        "Existing skills reordered. No new skills were added.",
                      );
                    }}
                  >
                    Prioritize matching skills
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="primary" disabled={busy} onClick={pdf}>
                {busy ? "Working…" : "Download PDF"}
              </button>
              <button disabled={busy || demo} onClick={publish}>
                Publish to portfolio
              </button>
            </div>
            <ResumePreview resume={resume} />
          </section>
        </fieldset>
      </div>
    </div>
  );
}
