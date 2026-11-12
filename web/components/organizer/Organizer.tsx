"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ZodError } from "zod";
import { browserClient } from "@/lib/supabase";
import { todayIST, daysUntil } from "@/lib/subscriptions";
import { cardMoney, cardDate, downloadCards } from "@/lib/cards";
import { agendaStatus, type AgendaItem } from "@/lib/dashboard";
import {
  emptyOrganizer,
  organizerSchema,
  spendingCategories,
  monthSpending,
  goalSaved,
  changeJobStatus,
  organizerReminders,
  organizerSummary,
  exportExpenses,
  reminderCalendar,
  jobStatuses,
  interviewDisplay,
  type OrganizerDocument,
  type Job,
} from "@/lib/organizer";
import { EntryForm, type FormKind, type ResumeChoice } from "./EntryForm";
const sections = [
  {
    id: "expenses",
    title: "Expenses",
    description: "Your spending, categories and budgets.",
  },
  {
    id: "jobs",
    title: "Applications",
    description: "Every application, conversation and next step.",
  },
  {
    id: "goals",
    title: "Savings goals",
    description: "Give your next milestone a little momentum.",
  },
  {
    id: "reminders",
    title: "Reminders",
    description: "One place for the dates that need attention.",
  },
  {
    id: "notes",
    title: "Notes & bookmarks",
    description: "Keep the useful things close.",
  },
] as const;
type Section = (typeof sections)[number]["id"];
const plusDays = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export function Organizer() {
  const params = useSearchParams(),
    demo = params.get("demo") === "1",
    requested = params.get("tab") || "expenses",
    initial = sections.some((s) => s.id === requested)
      ? (requested as Section)
      : "expenses",
    selectedItem = params.get("item");
  const db = useMemo(() => browserClient(), []),
    generation = useRef(0),
    user = useRef<string | null>(null);
  const [auth, setAuth] = useState<"checking" | "signedout" | "signedin">(
      demo ? "signedin" : "checking",
    ),
    [doc, setDoc] = useState<OrganizerDocument>(emptyOrganizer),
    [revision, setRevision] = useState(0),
    [ready, setReady] = useState(demo),
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false),
    [message, setMessage] = useState("");
  const [tab, setTab] = useState<Section>(initial),
    [versions, setVersions] = useState<ResumeChoice[]>([]),
    [versionsAvailable, setVersionsAvailable] = useState(true),
    [agenda, setAgenda] = useState<AgendaItem[]>([]),
    [agendaAvailable, setAgendaAvailable] = useState(demo);
  const [form, setForm] = useState<{
      kind: FormKind;
      id: string;
      goalId: string;
    } | null>(null),
    [month, setMonth] = useState(todayIST().slice(0, 7)),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [archived, setArchived] = useState(false),
    [reminderKind, setReminderKind] = useState("all"),
    [reminderWindow, setReminderWindow] = useState("30");
  const locked = busy || conflict;
  const errorMessage = (error: unknown) =>
    setMessage(
      error instanceof ZodError
        ? error.issues[0]?.message || "Check the entered details."
        : (error as Error).message,
    );
  useEffect(() => {
    setTab(initial);
    setSearch("");
    setStatus("all");
    setArchived(false);
    setForm(null);
  }, [initial]);
  useEffect(() => {
    if (!ready || !selectedItem) return;
    const frame = requestAnimationFrame(() =>
      document.getElementById("entry-" + selectedItem)?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [ready, selectedItem, tab]);
  function switchTab(next: Section) {
    setTab(next);
    setSearch("");
    setStatus("all");
    setArchived(false);
    setForm(null);
    window.history.replaceState(
      null,
      "",
      `/organizer?tab=${next}${demo ? "&demo=1" : ""}`,
    );
  }
  function begin(kind: FormKind, id = "", goalId = "") {
    setForm({ kind, id, goalId });
    setMessage("");
  }
  async function api(path: string, method = "GET", body?: unknown) {
    const { data } = await db!.auth.getSession();
    if (!data.session) throw new Error("Sign in again to open your organizer.");
    const r = await fetch(path, {
      method,
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const value = await r.json();
    if (!r.ok) {
      if ([401, 403].includes(r.status)) {
        generation.current++;
        setAuth("signedout");
        setDoc(emptyOrganizer());
        setAgenda([]);
        setVersions([]);
        setForm(null);
        setReady(false);
      }
      if (r.status === 409) setConflict(true);
      throw new Error(value.error || "Could not load your organizer.");
    }
    return value;
  }
  async function load() {
    const epoch = generation.current;
    setBusy(true);
    setMessage("");
    try {
      const [records, dashboard] = await Promise.allSettled([
        api("/api/organizer"),
        api("/api/dashboard"),
      ]);
      if (epoch !== generation.current) return;
      if (records.status === "fulfilled") {
        const value = records.value;
        setDoc(
          value.document
            ? organizerSchema.parse(value.document)
            : emptyOrganizer(),
        );
        setRevision(value.revision || 0);
        setVersions(value.resumeVersions || []);
        setVersionsAvailable(value.versionsAvailable !== false);
        setReady(true);
        setConflict(false);
        setForm(null);
      } else throw records.reason;
      if (dashboard.status === "fulfilled") {
        setAgenda(dashboard.value.agenda || []);
        setAgendaAvailable(
          Object.values(dashboard.value.sources || {}).every(Boolean),
        );
      } else {
        setAgendaAvailable(false);
        setAgenda([]);
      }
    } catch (error) {
      if (epoch === generation.current) errorMessage(error);
    } finally {
      if (epoch === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (demo) return;
    if (!db) {
      setAuth("signedout");
      return;
    }
    let active = true;
    const { data } = db.auth.onAuthStateChange((event, session) => {
      const id = session?.user.id || null;
      if (id === user.current && event !== "INITIAL_SESSION") return;
      user.current = id;
      generation.current++;
      setAuth(id ? "signedin" : "signedout");
      setDoc(emptyOrganizer());
      setAgenda([]);
      setVersions([]);
      setReady(false);
      setRevision(0);
      setForm(null);
      setConflict(false);
      setBusy(false);
      if (id)
        setTimeout(() => {
          if (active && user.current === id) void load();
        }, 0);
    });
    return () => {
      active = false;
      generation.current++;
      data.subscription.unsubscribe();
    };
  }, [db, demo]);
  async function save(next: OrganizerDocument) {
    const epoch = generation.current;
    setBusy(true);
    setMessage("");
    try {
      const value = organizerSchema.parse(next);
      if (!demo) {
        const result = await api("/api/organizer", "POST", {
          document: value,
          revision,
        });
        if (epoch !== generation.current)
          throw new Error("Your session changed. Sign in again.");
        setRevision(result.revision);
      }
      setDoc(value);
      setForm(null);
      setMessage(
        demo ? "Updated in this demo session only." : "Saved privately.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function act(work: () => Promise<void>) {
    try {
      await work();
    } catch (error) {
      errorMessage(error);
    }
  }
  async function archive(kind: "jobs" | "goals" | "notes", id: string) {
    const next = structuredClone(doc);
    if (kind === "jobs")
      next.jobs = next.jobs.map((i) =>
        i.id === id ? { ...i, archived: !i.archived } : i,
      );
    if (kind === "goals")
      next.goals = next.goals.map((i) =>
        i.id === id ? { ...i, archived: !i.archived } : i,
      );
    if (kind === "notes")
      next.notes = next.notes.map((i) =>
        i.id === id ? { ...i, archived: !i.archived } : i,
      );
    await save(next);
  }
  async function remove(
    kind: "expenses" | "budgets" | "reminders",
    id: string,
  ) {
    if (!confirm("Remove this manual entry?")) return;
    const next = structuredClone(doc);
    if (kind === "expenses")
      next.expenses = next.expenses.filter((i) => i.id !== id);
    if (kind === "budgets")
      next.budgets = next.budgets.filter((i) => i.id !== id);
    if (kind === "reminders")
      next.reminders = next.reminders.filter((i) => i.id !== id);
    await save(next);
  }
  const summary = organizerSummary(doc),
    spending = monthSpending(doc, month),
    expenses = doc.expenses
      .filter(
        (e) =>
          e.date.startsWith(month) &&
          `${e.description} ${e.category} ${e.note}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  const categories = spendingCategories(doc, month).map((c) => ({
    ...c,
    total: c.amountMinor,
  }));
  const jobs = doc.jobs.filter(
    (j) =>
      j.archived === archived &&
      (status === "all" || j.status === status) &&
      `${j.company} ${j.role} ${j.notes} ${j.contact}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const goals = doc.goals.filter(
    (g) =>
      g.archived === archived &&
      `${g.title} ${g.notes}`.toLowerCase().includes(search.toLowerCase()),
  );
  const notes = doc.notes
    .filter(
      (n) =>
        n.archived === archived &&
        (status === "all" || n.kind === status) &&
        `${n.title} ${n.body} ${n.tags.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const allReminders = organizerReminders(
      { ...doc, dismissed: [], snoozed: [] },
      agenda,
    ),
    openReminders = organizerReminders(doc, agenda),
    reminders = (
      reminderWindow === "hidden"
        ? allReminders.filter(
            (r) =>
              doc.dismissed.includes(r.key) ||
              doc.snoozed.some((s) => s.key === r.key && s.until > todayIST()),
          )
        : openReminders
    ).filter(
      (r) =>
        (reminderKind === "all" || r.kind === reminderKind) &&
        `${r.title} ${r.detail}`.toLowerCase().includes(search.toLowerCase()) &&
        (reminderWindow === "hidden" ||
          reminderWindow === "all" ||
          (reminderWindow === "overdue" && daysUntil(r.date) < 0) ||
          (!["hidden", "all", "overdue"].includes(reminderWindow) &&
            daysUntil(r.date) <= Number(reminderWindow))),
    );
  const section = sections.find((s) => s.id === tab)!;
  const link = (path: string) =>
    demo ? path + (path.includes("?") ? "&" : "?") + "demo=1" : path;
  if (auth === "checking")
    return (
      <main className="cards-app">
        <p role="status">Checking your sign-in…</p>
      </main>
    );
  if (auth === "signedout")
    return (
      <main className="cards-app cards-entry">
        <p className="cards-kicker">YOUR PRIVATE ORGANIZER</p>
        <h1>
          Room for the rest
          <br />
          of your life.
        </h1>
        <p>
          Spending, applications, savings, reminders and the notes worth
          keeping.
        </p>
        <a className="cards-button" href="/login?next=organizer">
          Sign in to Organizer
        </a>
        <a className="cards-secondary-link" href="/organizer?demo=1">
          Explore a session-only demo →
        </a>
      </main>
    );
  return (
    <main className="cards-app organizer-app">
      <header className="cards-header">
        <a className="cards-brand" href={link("/dashboard")}>
          Your<span>space.</span>
        </a>
        <div>
          <span className="cards-kicker">
            {demo ? "DEMO · NOT SAVED" : "PRIVATE ORGANIZER"}
          </span>
          {!demo && (
            <button onClick={() => void db?.auth.signOut()}>Sign out</button>
          )}
        </div>
      </header>
      <nav className="cards-private-nav" aria-label="Private tools">
        <a href={link("/dashboard")}>Dashboard</a>
        <a href={link("/cards")}>Cards</a>
        <a href={link("/subscriptions")}>Shared Plan</a>
        <a href={link("/dashboard?tab=renewals")}>Renewals</a>
        <a href={link("/admin")}>Resume studio</a>
      </nav>
      <div className="cards-title">
        <div>
          <p className="cards-kicker">KEEP THE IMPORTANT THINGS TOGETHER.</p>
          <h1>{section.title}</h1>
          <p>{section.description}</p>
        </div>
        <button
          disabled={busy}
          onClick={() =>
            demo
              ? setMessage(
                  "This demo stays in memory. Refreshing the page clears it.",
                )
              : void load()
          }
        >
          Refresh records
        </button>
      </div>
      {demo && (
        <p className="cards-notice">
          Demo mode. Nothing is saved online; refreshing clears this session.
          Sample entries stay within this demo.
        </p>
      )}
      <p className="cards-status" role="status">
        {message}
      </p>
      {conflict && (
        <p className="cards-notice">
          Another device saved a newer version. Refresh before saving again;
          your form stays here until then.
        </p>
      )}
      <nav className="organizer-tabs" aria-label="Organizer sections">
        {sections.map((s) => (
          <button
            key={s.id}
            aria-pressed={tab === s.id}
            onClick={() => switchTab(s.id)}
          >
            {s.title}
          </button>
        ))}
      </nav>
      {!ready ? (
        <section className="cards-panel cards-empty">
          <h2>{busy ? "Loading your records…" : "Records unavailable"}</h2>
          <p>Refresh to reconnect to your private organizer.</p>
        </section>
      ) : (
        <>
          {form && (
            <EntryForm
              key={form.kind + form.id + form.goalId}
              {...form}
              doc={doc}
              versions={versions}
              busy={locked}
              onClose={() => setForm(null)}
              onSave={save}
              onError={errorMessage}
            />
          )}
          {tab === "expenses" && (
            <>
              <section className="cards-metrics organizer-metrics">
                <div>
                  <span>Spending this month</span>
                  <strong>{cardMoney(spending)}</strong>
                  <small>{month}</small>
                </div>
                <div>
                  <span>Entries</span>
                  <strong>
                    {
                      doc.expenses.filter((e) => e.date.startsWith(month))
                        .length
                    }
                  </strong>
                  <small>Manual spending records</small>
                </div>
                <div>
                  <span>Overall budget</span>
                  <strong>
                    {doc.budgets.find((b) => b.month === month && !b.category)
                      ? cardMoney(
                          doc.budgets.find(
                            (b) => b.month === month && !b.category,
                          )!.amountMinor,
                        )
                      : "Not set"}
                  </strong>
                  <small>Category budgets are separate</small>
                </div>
              </section>
              <div className="cards-section-head">
                <label className="cards-search">
                  Spending month
                  <input
                    type="month"
                    value={month}
                    onChange={(e) =>
                      setMonth(e.target.value || todayIST().slice(0, 7))
                    }
                  />
                </label>
                <div className="cards-actions">
                  <button
                    className="cards-button"
                    disabled={locked}
                    onClick={() => begin("expense")}
                  >
                    + Add expense
                  </button>
                  <button disabled={locked} onClick={() => begin("budget")}>
                    Set a budget
                  </button>
                </div>
              </div>
              <div className="organizer-two-col">
                <section className="cards-panel">
                  <p className="cards-kicker">WHERE IT WENT</p>
                  <h2>Spending by category</h2>
                  {!categories.length && (
                    <p>No spending recorded for this month.</p>
                  )}
                  {categories.map((c) => (
                    <div className="organizer-category" key={c.category}>
                      <div>
                        <span>{c.category}</span>
                        <strong>{cardMoney(c.total)}</strong>
                      </div>
                      <progress
                        value={c.total}
                        max={Math.max(1, spending)}
                        aria-label={c.category + " spending share"}
                      />
                    </div>
                  ))}
                </section>
                <section className="cards-panel">
                  <p className="cards-kicker">YOUR LIMITS, YOUR CHOICE</p>
                  <h2>Monthly budgets</h2>
                  {!doc.budgets.some((b) => b.month === month) && (
                    <p>
                      Set an overall budget or choose individual categories.
                    </p>
                  )}
                  {doc.budgets
                    .filter((b) => b.month === month)
                    .map((b) => {
                      const actual = monthSpending(doc, month, b.category),
                        left = b.amountMinor - actual;
                      return (
                        <article className="organizer-budget" key={b.id}>
                          <div>
                            <strong>{b.category || "Overall budget"}</strong>
                            <span data-over={left < 0}>
                              {left < 0
                                ? cardMoney(-left) + " over"
                                : cardMoney(left) + " left"}
                            </span>
                          </div>
                          <progress
                            value={Math.min(actual, b.amountMinor)}
                            max={b.amountMinor || 1}
                            aria-label={
                              (b.category || "Overall") + " budget used"
                            }
                          />
                          <small>
                            {cardMoney(actual)} of {cardMoney(b.amountMinor)}
                          </small>
                          <div className="cards-actions">
                            <button
                              disabled={locked}
                              onClick={() => begin("budget", b.id)}
                            >
                              Edit budget
                            </button>
                            <button
                              disabled={locked}
                              onClick={() =>
                                void act(() => remove("budgets", b.id))
                              }
                            >
                              Remove budget
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </section>
              </div>
              <section className="cards-panel">
                <div className="cards-section-head">
                  <h2>Expense history</h2>
                  <label className="cards-search">
                    Search expenses
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                {!expenses.length && (
                  <p className="cards-empty">
                    No expenses match this month and search.
                  </p>
                )}
                {expenses.map((e) => (
                  <article
                    className="organizer-record"
                    key={e.id}
                    id={"entry-" + e.id}
                  >
                    <div>
                      <h3>{e.description}</h3>
                      <p>
                        {cardDate(e.date)} · {e.category} · {e.method}
                      </p>
                      {e.note && <small>{e.note}</small>}
                    </div>
                    <strong>{cardMoney(e.amountMinor)}</strong>
                    <div className="cards-actions">
                      <button
                        disabled={locked}
                        onClick={() => begin("expense", e.id)}
                      >
                        Edit expense
                      </button>
                      <button
                        disabled={locked}
                        onClick={() => void act(() => remove("expenses", e.id))}
                      >
                        Remove expense
                      </button>
                    </div>
                  </article>
                ))}
              </section>
              <button
                disabled={!doc.expenses.length}
                onClick={() =>
                  downloadCards(exportExpenses(doc), "expenses.csv")
                }
              >
                Export all expenses
              </button>
            </>
          )}
          {tab === "jobs" && (
            <>
              <section className="cards-metrics organizer-metrics">
                <div>
                  <span>Active applications</span>
                  <strong>{summary.activeApplications}</strong>
                  <small>Applied through offer stages</small>
                </div>
                <div>
                  <span>Interviews tracked</span>
                  <strong>
                    {
                      doc.jobs.filter(
                        (j) => !j.archived && j.status === "Interview",
                      ).length
                    }
                  </strong>
                  <small>Interview stage</small>
                </div>
                <div>
                  <span>Offers</span>
                  <strong>
                    {
                      doc.jobs.filter(
                        (j) => !j.archived && j.status === "Offer",
                      ).length
                    }
                  </strong>
                  <small>Your recorded outcomes</small>
                </div>
              </section>
              <div className="organizer-toolbar">
                <label className="cards-search">
                  Search applications
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="cards-search">
                  Filter application status
                  <select
                    aria-label="Filter application status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">All stages</option>
                    {jobStatuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="organizer-check">
                  <input
                    type="checkbox"
                    checked={archived}
                    onChange={(e) => setArchived(e.target.checked)}
                  />{" "}
                  Show archived applications
                </label>
                <button
                  className="cards-button"
                  disabled={locked}
                  onClick={() => begin("job")}
                >
                  + Add application
                </button>
              </div>
              {!versionsAvailable && (
                <p className="cards-notice">
                  Resume versions could not be loaded. Existing application
                  links are kept; refresh to reconnect.
                </p>
              )}
              <section
                className="organizer-card-grid"
                aria-label="Job applications"
              >
                {jobs.map((job) => (
                  <article
                    className="cards-panel"
                    key={job.id}
                    id={"entry-" + job.id}
                  >
                    <div className="cards-section-head">
                      <span className="hub-due-badge">{job.status}</span>
                      <button
                        disabled={locked}
                        onClick={() => begin("job", job.id)}
                      >
                        Edit application
                      </button>
                    </div>
                    <h2>{job.company}</h2>
                    <h3>{job.role}</h3>
                    {job.appliedDate && (
                      <p>Applied {cardDate(job.appliedDate)}</p>
                    )}
                    {job.interviewAt && (
                      <p className="organizer-date-line">
                        Interview · {interviewDisplay(job.interviewAt)}
                      </p>
                    )}
                    {job.followUpDate && (
                      <p className="organizer-date-line">
                        Follow up · {cardDate(job.followUpDate)}
                      </p>
                    )}
                    {job.contact && <p>{job.contact}</p>}
                    {job.resumeVersionName && (
                      <p className="cards-note">
                        Resume used:{" "}
                        <a
                          className="organizer-text-link"
                          href={link("/admin?version=" + job.resumeVersionId)}
                        >
                          {job.resumeVersionName} ↗
                        </a>
                      </p>
                    )}
                    {job.url && (
                      <a
                        className="organizer-text-link"
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open job posting ↗
                      </a>
                    )}
                    {job.notes && (
                      <details className="organizer-details">
                        <summary>Application notes</summary>
                        <p className="organizer-body">{job.notes}</p>
                      </details>
                    )}
                    <label className="cards-search organizer-status-select">
                      Move application
                      <select
                        aria-label="Move application"
                        disabled={locked}
                        value={job.status}
                        onChange={(e) =>
                          void act(() =>
                            save(
                              changeJobStatus(
                                doc,
                                job.id,
                                e.target.value as Job["status"],
                              ),
                            ),
                          )
                        }
                      >
                        {jobStatuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <details className="organizer-details">
                      <summary>Status history · {job.history.length}</summary>
                      {[...job.history].reverse().map((event) => (
                        <p key={event.id}>
                          {event.status} · {interviewDisplay(event.at)}
                        </p>
                      ))}
                    </details>
                    <div className="cards-actions">
                      <button
                        disabled={locked}
                        onClick={() => void act(() => archive("jobs", job.id))}
                      >
                        {job.archived
                          ? "Restore application"
                          : "Archive application"}
                      </button>
                    </div>
                  </article>
                ))}
              </section>
              {!jobs.length && (
                <section className="cards-panel cards-empty">
                  <h2>No applications in this view.</h2>
                  <p>
                    Save a role, record an application and keep its next step
                    here.
                  </p>
                </section>
              )}
            </>
          )}
          {tab === "goals" && (
            <>
              <section className="cards-metrics organizer-metrics">
                <div>
                  <span>Active goals</span>
                  <strong>{summary.goals}</strong>
                  <small>Personal savings targets</small>
                </div>
                <div>
                  <span>Recorded savings</span>
                  <strong>{cardMoney(summary.savedMinor)}</strong>
                  <small>Deposits minus withdrawals</small>
                </div>
                <div>
                  <span>Completed goals</span>
                  <strong>
                    {
                      doc.goals.filter(
                        (g) => !g.archived && goalSaved(g) >= g.targetMinor,
                      ).length
                    }
                  </strong>
                  <small>Targets reached</small>
                </div>
              </section>
              <div className="organizer-toolbar">
                <label className="cards-search">
                  Search goals
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="organizer-check">
                  <input
                    type="checkbox"
                    checked={archived}
                    onChange={(e) => setArchived(e.target.checked)}
                  />{" "}
                  Show archived goals
                </label>
                <button
                  className="cards-button"
                  disabled={locked}
                  onClick={() => begin("goal")}
                >
                  + Add savings goal
                </button>
              </div>
              <section
                className="organizer-card-grid"
                aria-label="Savings goals"
              >
                {goals.map((goal) => {
                  const saved = goalSaved(goal),
                    left = Math.max(0, goal.targetMinor - saved);
                  return (
                    <article
                      className="cards-panel organizer-goal"
                      key={goal.id}
                      id={"entry-" + goal.id}
                    >
                      <div className="cards-section-head">
                        <p className="cards-kicker">
                          {left === 0 ? "TARGET REACHED" : "A LITTLE CLOSER"}
                        </p>
                        <button
                          disabled={locked}
                          onClick={() => begin("goal", goal.id)}
                        >
                          Edit goal
                        </button>
                      </div>
                      <h2>{goal.title}</h2>
                      <strong className="organizer-goal-amount">
                        {cardMoney(saved)}
                      </strong>
                      <p>
                        of {cardMoney(goal.targetMinor)} ·{" "}
                        {Math.round((saved / goal.targetMinor) * 100)}%
                      </p>
                      <progress
                        max={goal.targetMinor}
                        value={Math.min(saved, goal.targetMinor)}
                        aria-label={goal.title + " savings progress"}
                      />
                      <p>
                        {left
                          ? cardMoney(left) + " to go"
                          : "You reached this target."}
                      </p>
                      {goal.deadline && (
                        <p className="organizer-date-line">
                          Target date · {cardDate(goal.deadline)}
                        </p>
                      )}
                      {goal.notes && (
                        <p className="organizer-body">{goal.notes}</p>
                      )}
                      <div className="cards-actions">
                        <button
                          className="cards-button"
                          disabled={locked || goal.archived}
                          onClick={() => begin("contribution", "", goal.id)}
                        >
                          Record savings movement
                        </button>
                        <button
                          disabled={locked}
                          onClick={() =>
                            void act(() => archive("goals", goal.id))
                          }
                        >
                          {goal.archived ? "Restore goal" : "Archive goal"}
                        </button>
                      </div>
                      <details className="organizer-details">
                        <summary>
                          Savings history · {goal.contributions.length}
                        </summary>
                        {[...goal.contributions].reverse().map((c) => (
                          <div className="organizer-ledger-row" key={c.id}>
                            <span>
                              <strong>
                                {c.kind === "withdrawal" ? "−" : "+"}
                                {cardMoney(c.amountMinor)}
                              </strong>
                              <small>
                                {cardDate(c.date)}
                                {c.note ? " · " + c.note : ""}
                              </small>
                            </span>
                            <button
                              disabled={locked}
                              onClick={() =>
                                void act(async () => {
                                  if (
                                    !confirm(
                                      "Remove this savings entry? The recorded balance will change.",
                                    )
                                  )
                                    return;
                                  const next = structuredClone(doc);
                                  next.goals.find(
                                    (g) => g.id === goal.id,
                                  )!.contributions = goal.contributions.filter(
                                    (x) => x.id !== c.id,
                                  );
                                  await save(next);
                                })
                              }
                            >
                              Correct entry
                            </button>
                          </div>
                        ))}
                      </details>
                    </article>
                  );
                })}
              </section>
              {!goals.length && (
                <section className="cards-panel cards-empty">
                  <h2>Give your next goal a name.</h2>
                  <p>An emergency fund, a trip or your next big purchase.</p>
                </section>
              )}
              <p className="cards-note">
                Savings movements are manual records. No money is moved between
                bank accounts.
              </p>
            </>
          )}
          {tab === "notes" && (
            <>
              <div className="organizer-toolbar">
                <label className="cards-search">
                  Search notes and tags
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="cards-search">
                  Filter note type
                  <select
                    aria-label="Filter note type"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">Notes and bookmarks</option>
                    <option value="note">Notes only</option>
                    <option value="bookmark">Bookmarks only</option>
                  </select>
                </label>
                <label className="organizer-check">
                  <input
                    type="checkbox"
                    checked={archived}
                    onChange={(e) => setArchived(e.target.checked)}
                  />{" "}
                  Show archived notes
                </label>
                <button
                  className="cards-button"
                  disabled={locked}
                  onClick={() => begin("note")}
                >
                  + Add note or bookmark
                </button>
              </div>
              <section
                className="organizer-card-grid"
                aria-label="Private notes"
              >
                {notes.map((note) => (
                  <article
                    className="cards-panel"
                    key={note.id}
                    id={"entry-" + note.id}
                  >
                    <div className="cards-section-head">
                      <p className="cards-kicker">
                        {note.pinned ? "PINNED · " : ""}
                        {note.kind === "bookmark" ? "BOOKMARK" : "NOTE"}
                      </p>
                      <button
                        disabled={locked}
                        onClick={() => begin("note", note.id)}
                      >
                        Edit note
                      </button>
                    </div>
                    <h2>{note.title}</h2>
                    {note.body && (
                      <div className="organizer-body organizer-note-body">
                        {note.body.split("\n").map((line, index) => {
                          const check = /^- \[([ xX])\] (.*)$/.exec(line);
                          return check ? (
                            <label className="organizer-check" key={index}>
                              <input
                                type="checkbox"
                                disabled={locked}
                                checked={check[1].toLowerCase() === "x"}
                                onChange={() =>
                                  void act(async () => {
                                    const next = structuredClone(doc),
                                      entry = next.notes.find(
                                        (n) => n.id === note.id,
                                      )!;
                                    const lines = entry.body.split("\n");
                                    lines[index] =
                                      `- [${check[1] === " " ? "x" : " "}] ${check[2]}`;
                                    entry.body = lines.join("\n");
                                    entry.updatedAt = new Date().toISOString();
                                    await save(next);
                                  })
                                }
                              />
                              {check[2]}
                            </label>
                          ) : (
                            <div key={index}>{line || "\u00a0"}</div>
                          );
                        })}
                      </div>
                    )}
                    {note.url && (
                      <a
                        className="organizer-text-link"
                        href={note.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open link ↗
                      </a>
                    )}
                    <div className="organizer-tags">
                      {note.tags.map((tag) => (
                        <button key={tag} onClick={() => setSearch(tag)}>
                          {tag}
                        </button>
                      ))}
                    </div>
                    <small>Updated {interviewDisplay(note.updatedAt)}</small>
                    <div className="cards-actions">
                      <button
                        disabled={locked}
                        onClick={() =>
                          void act(async () => {
                            const next = structuredClone(doc);
                            next.notes = next.notes.map((n) =>
                              n.id === note.id
                                ? { ...n, pinned: !n.pinned }
                                : n,
                            );
                            await save(next);
                          })
                        }
                      >
                        {note.pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        disabled={locked}
                        onClick={() =>
                          void act(() => archive("notes", note.id))
                        }
                      >
                        {note.archived ? "Restore note" : "Archive note"}
                      </button>
                    </div>
                  </article>
                ))}
              </section>
              {!notes.length && (
                <section className="cards-panel cards-empty">
                  <h2>A home for useful things.</h2>
                  <p>
                    Keep bookmarks, checklists, study notes and ideas
                    searchable.
                  </p>
                </section>
              )}
            </>
          )}
          {tab === "reminders" && (
            <>
              <section className="cards-metrics organizer-metrics">
                <div>
                  <span>Overdue reminders</span>
                  <strong>
                    {openReminders.filter((r) => daysUntil(r.date) < 0).length}
                  </strong>
                  <small>From the available sources</small>
                </div>
                <div>
                  <span>Due within 7 days</span>
                  <strong>
                    {
                      openReminders.filter(
                        (r) => daysUntil(r.date) >= 0 && daysUntil(r.date) <= 7,
                      ).length
                    }
                  </strong>
                  <small>Cards, renewals and personal dates</small>
                </div>
                <div>
                  <span>Email delivery</span>
                  <strong>Off</strong>
                  <small>Set up later · no emails are sent</small>
                </div>
              </section>
              {!agendaAvailable && (
                <p className="cards-notice">
                  Some dashboard reminders are unavailable. Your personal
                  reminders, applications and goals are still shown. Refresh to
                  reconnect.
                </p>
              )}
              <div className="organizer-toolbar">
                <label className="cards-search">
                  Search reminders
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="cards-search">
                  Reminder source
                  <select
                    aria-label="Reminder source"
                    value={reminderKind}
                    onChange={(e) => setReminderKind(e.target.value)}
                  >
                    <option value="all">All sources</option>
                    {[
                      "card",
                      "subscription",
                      "renewal",
                      "job",
                      "goal",
                      "manual",
                    ].map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cards-search">
                  Reminder window
                  <select
                    aria-label="Reminder window"
                    value={reminderWindow}
                    onChange={(e) => setReminderWindow(e.target.value)}
                  >
                    <option value="7">Next 7 days + overdue</option>
                    <option value="30">Next 30 days + overdue</option>
                    <option value="overdue">Overdue</option>
                    <option value="all">All dates</option>
                    <option value="hidden">Snoozed / dismissed</option>
                  </select>
                </label>
                <button
                  className="cards-button"
                  disabled={locked}
                  onClick={() => begin("reminder")}
                >
                  + Add personal reminder
                </button>
              </div>
              <section
                className="cards-panel organizer-reminder-list"
                aria-label="Your reminders"
              >
                {!reminders.length && (
                  <p className="cards-empty">No reminders match this view.</p>
                )}
                {reminders.map((r) => (
                  <article
                    className="organizer-reminder"
                    key={r.key}
                    id={"entry-" + r.id}
                  >
                    <span className="hub-kind">{r.kind[0].toUpperCase()}</span>
                    <div>
                      <h3>{r.title}</h3>
                      <p>{r.detail}</p>
                      <small>
                        {cardDate(r.date)} · {agendaStatus(r.date)}
                      </small>
                    </div>
                    <div className="cards-actions">
                      {reminderWindow === "hidden" ? (
                        <button
                          disabled={locked}
                          onClick={() =>
                            void act(async () => {
                              const next = structuredClone(doc);
                              next.dismissed = next.dismissed.filter(
                                (k) => k !== r.key,
                              );
                              next.snoozed = next.snoozed.filter(
                                (s) => s.key !== r.key,
                              );
                              await save(next);
                            })
                          }
                        >
                          Restore reminder
                        </button>
                      ) : (
                        <>
                          <a className="cards-button" href={link(r.href)}>
                            Open
                          </a>
                          <button
                            disabled={locked}
                            onClick={() =>
                              void act(async () => {
                                const next = structuredClone(doc);
                                next.snoozed = next.snoozed.filter(
                                  (s) => s.key !== r.key,
                                );
                                next.snoozed.push({
                                  key: r.key,
                                  until: plusDays(todayIST(), 7),
                                });
                                await save(next);
                              })
                            }
                          >
                            Snooze 7 days
                          </button>
                          <button
                            disabled={locked}
                            onClick={() =>
                              void act(async () => {
                                const next = structuredClone(doc);
                                next.dismissed = [
                                  ...new Set([...next.dismissed, r.key]),
                                ];
                                await save(next);
                              })
                            }
                          >
                            Dismiss reminder
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </section>
              <div className="cards-actions">
                <button
                  disabled={!reminders.length}
                  onClick={() =>
                    downloadCards(
                      reminderCalendar(reminders),
                      "personal-reminders.ics",
                      "text/calendar;charset=utf-8",
                    )
                  }
                >
                  Download reminder calendar
                </button>
              </div>
              <section className="cards-panel">
                <h2>Personal reminders</h2>
                <p className="cards-note">
                  Dismissing a reminder does not mark a bank bill paid or
                  complete a renewal.
                </p>
                {!doc.reminders.length && (
                  <p>Add a task or personal date above.</p>
                )}
                {doc.reminders.map((r) => (
                  <article className="organizer-record" key={r.id}>
                    <div>
                      <h3>{r.title}</h3>
                      <p>
                        {cardDate(r.dueDate)} · {r.done ? "Completed" : "Open"}
                      </p>
                      {r.notes && <small>{r.notes}</small>}
                    </div>
                    <div className="cards-actions">
                      <button
                        disabled={locked}
                        onClick={() =>
                          void act(async () => {
                            const next = structuredClone(doc);
                            next.reminders = next.reminders.map((x) =>
                              x.id === r.id ? { ...x, done: !x.done } : x,
                            );
                            next.dismissed = next.dismissed.filter(
                              (k) => !k.startsWith(r.id + ":"),
                            );
                            next.snoozed = next.snoozed.filter(
                              (s) => !s.key.startsWith(r.id + ":"),
                            );
                            await save(next);
                          })
                        }
                      >
                        {r.done ? "Reopen reminder" : "Mark reminder done"}
                      </button>
                      <button
                        disabled={locked}
                        onClick={() => begin("reminder", r.id)}
                      >
                        Edit reminder
                      </button>
                      <button
                        disabled={locked}
                        onClick={() =>
                          void act(() => remove("reminders", r.id))
                        }
                      >
                        Remove reminder
                      </button>
                    </div>
                  </article>
                ))}
              </section>
              <p className="cards-note">
                Calendar downloads can create device reminders. The website does
                not send background emails or push notifications. Email setup is
                deferred.
              </p>
            </>
          )}
          <div className="cards-bottom-actions">
            <button
              onClick={() =>
                downloadCards(
                  JSON.stringify(doc, null, 2),
                  "personal-organizer-backup.json",
                  "application/json",
                )
              }
            >
              Download private organizer backup
            </button>
          </div>
        </>
      )}
      <footer className="cards-footer">
        <p>Private owner workspace · INR · Dates and interviews in IST</p>
        <p>
          Manual records stay separate from bank transactions and employer
          systems. Only you can access these tools through your owner login.
        </p>
      </footer>
    </main>
  );
}
