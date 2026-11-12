"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ZodError } from "zod";
import { browserClient } from "@/lib/supabase";
import {
  cardDate,
  cardMoney,
  parseCardMoney,
  downloadCards,
} from "@/lib/cards";
import { daysUntil, todayIST, money } from "@/lib/subscriptions";
import {
  dashboardSummary,
  agendaStatus,
  type DashboardSummary,
} from "@/lib/dashboard";
import {
  emptyRenewals,
  renewalDocumentSchema,
  renewalItemSchema,
  renewalCategories,
  nextRenewalDate,
  completeRenewal,
  renewalCalendar,
  renewalsCSV,
  type RenewalDocument,
  type RenewalItem,
} from "@/lib/renewals";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="cards-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
const demoSummary = () =>
  dashboardSummary({
    cards: { version: 1, cards: [], statements: [] },
    plans: [],
    learning: {},
    renewals: emptyRenewals(),
    pending: { payments: 0, preferences: 0, joins: 0 },
    sources: {
      cards: true,
      subscriptions: true,
      learning: true,
      renewals: true,
      payments: true,
      preferences: true,
      joins: true,
    },
  });
function updateRenewals(
  summary: DashboardSummary | null,
  doc: RenewalDocument,
) {
  if (!summary) return summary;
  return {
    ...summary,
    sources: { ...summary.sources, renewals: true },
    agenda: [
      ...summary.agenda.filter((a) => a.kind !== "renewal"),
      ...doc.items
        .filter((i) => !i.archived)
        .map((item) => ({
          id: "renewal-" + item.id,
          kind: "renewal" as const,
          title: item.title,
          date: item.dueDate,
          detail: item.category + (item.provider ? " · " + item.provider : ""),
          href: `/dashboard?tab=renewals&item=${item.id}`,
          amountMinor: item.amountMinor || undefined,
          currency: "INR",
        })),
    ].sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
    ),
  };
}
export function PersonalHub() {
  const params = useSearchParams(),
    demo = params.get("demo") === "1",
    initialTab = params.get("tab") === "renewals" ? "renewals" : "overview",
    selectedItem = params.get("item");
  const db = useMemo(() => browserClient(), []),
    generation = useRef(0),
    userId = useRef<string | null>(null);
  const [auth, setAuth] = useState<"checking" | "signedout" | "signedin">(
      demo ? "signedin" : "checking",
    ),
    [tab, setTab] = useState<"overview" | "renewals">(initialTab);
  const [summary, setSummary] = useState<DashboardSummary | null>(
      demo ? demoSummary : null,
    ),
    [doc, setDoc] = useState<RenewalDocument>(emptyRenewals),
    [revision, setRevision] = useState(0),
    [ready, setReady] = useState(demo);
  const [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false),
    [message, setMessage] = useState(""),
    [updated, setUpdated] = useState("");
  const [form, setForm] = useState<"item" | "complete" | null>(null),
    [editing, setEditing] = useState<RenewalItem | null>(null),
    [completing, setCompleting] = useState<RenewalItem | null>(null);
  const [range, setRange] = useState("30"),
    [kind, setKind] = useState("all"),
    [category, setCategory] = useState("all"),
    [filter, setFilter] = useState("active"),
    [search, setSearch] = useState("");
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  useEffect(() => {
    if (!form) return;
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(".hub-form");
      panel?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      panel
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [form, editing?.id, completing?.id]);
  useEffect(() => {
    if (!ready || !selectedItem || tab !== "renewals") return;
    const frame = requestAnimationFrame(() =>
      document.getElementById("renewal-" + selectedItem)?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [ready, selectedItem, tab]);
  async function api(path: string, method = "GET", body?: unknown) {
    const { data } = await db!.auth.getSession();
    if (!data.session)
      throw new Error("Sign in again to access your dashboard.");
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
        setSummary(null);
        setDoc(emptyRenewals());
        setForm(null);
        setReady(false);
      }
      if (r.status === 409) setConflict(true);
      throw new Error(value.error || "Could not load your private data.");
    }
    return value;
  }
  async function load() {
    const epoch = generation.current;
    setBusy(true);
    setMessage("");
    try {
      const results = await Promise.allSettled([
        api("/api/dashboard"),
        api("/api/renewals"),
      ]);
      if (epoch !== generation.current) return;
      const overview = results[0],
        renewals = results[1];
      if (overview.status === "fulfilled") setSummary(overview.value);
      if (renewals.status === "fulfilled") {
        setDoc(
          renewals.value
            ? renewalDocumentSchema.parse(renewals.value.document)
            : emptyRenewals(),
        );
        setRevision(renewals.value?.revision || 0);
        setReady(true);
        setConflict(false);
        setForm(null);
      }
      const errors = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      setMessage(
        errors.length
          ? "Some data could not be loaded. Refresh to try again."
          : "",
      );
      setUpdated(
        new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        }).format(new Date()),
      );
    } catch (e) {
      if (epoch === generation.current) setMessage((e as Error).message);
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
      if (id === userId.current && event !== "INITIAL_SESSION") return;
      userId.current = id;
      generation.current++;
      setAuth(id ? "signedin" : "signedout");
      setSummary(null);
      setDoc(emptyRenewals());
      setRevision(0);
      setReady(false);
      setForm(null);
      setConflict(false);
      setBusy(false);
      if (id)
        setTimeout(() => {
          if (active && userId.current === id) void load();
        }, 0);
    });
    return () => {
      active = false;
      generation.current++;
      data.subscription.unsubscribe();
    };
  }, [db, demo]);
  async function save(next: RenewalDocument) {
    const epoch = generation.current;
    const value = renewalDocumentSchema.parse(next);
    if (!demo) {
      const r = await api("/api/renewals", "POST", {
        document: value,
        revision,
      });
      if (epoch !== generation.current)
        throw new Error("Your session changed. Sign in again.");
      setRevision(r.revision);
    }
    setDoc(value);
    setSummary((current) => updateRenewals(current, value));
    setMessage(
      demo ? "Updated in this demo session only." : "Saved privately.",
    );
    setForm(null);
  }
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage(
        e instanceof ZodError
          ? e.issues[0]?.message || "Check the entered details."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  function startItem(item: RenewalItem | null = null) {
    setEditing(item);
    setForm("item");
    setTab("renewals");
    setMessage("");
  }
  function startComplete(item: RenewalItem) {
    setCompleting(item);
    setForm("complete");
    setMessage("");
  }
  const locked = busy || conflict;
  const activeItems = doc.items.filter((i) => !i.archived),
    renewalsSoon = activeItems.filter((i) => daysUntil(i.dueDate) <= 30);
  const visibleItems = doc.items
    .filter(
      (i) =>
        (filter === "archived" ? i.archived : !i.archived) &&
        (category === "all" || i.category === category) &&
        `${i.title} ${i.provider}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter !== "overdue" || daysUntil(i.dueDate) < 0) &&
        (filter !== "soon" ||
          (daysUntil(i.dueDate) >= 0 && daysUntil(i.dueDate) <= 30)),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const agenda =
    summary?.agenda.filter(
      (a) =>
        (kind === "all" || a.kind === kind) &&
        (range === "all" ||
          (range === "overdue" && daysUntil(a.date) < 0) ||
          (range !== "overdue" && daysUntil(a.date) <= Number(range))),
    ) || [];
  const unavailable = summary
    ? Object.entries(summary.sources)
        .filter(([, ok]) => !ok)
        .map(([name]) => name)
    : [];
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
        <p className="cards-kicker">YOUR PRIVATE HOME</p>
        <h1>
          A little more
          <br />
          in order.
        </h1>
        <p>
          Card dues, shared plans, renewals and learning. One place to start
          your day.
        </p>
        <a className="cards-button" href="/login?next=dashboard">
          Sign in to your dashboard
        </a>
        <a className="cards-secondary-link" href="/dashboard?demo=1">
          Explore the session-only demo →
        </a>
        <p className="cards-note">
          Uses your existing owner account. Your public portfolio stays
          separate.
        </p>
      </main>
    );
  return (
    <main className="cards-app hub-app">
      <header className="cards-header">
        <a className="cards-brand" href="/dashboard">
          Personal<span>hub.</span>
        </a>
        <div>
          <span className="cards-kicker">
            {demo ? "DEMO · SESSION ONLY" : "YOUR PRIVATE SPACE"}
          </span>
          {!demo && (
            <button onClick={() => void db?.auth.signOut()}>Sign out</button>
          )}
        </div>
      </header>
      <nav className="cards-private-nav" aria-label="Private tools">
        <a href={link("/dashboard")} aria-current="page">
          Dashboard
        </a>
        <a href={link("/organizer")}>Organizer</a>
        <a href={link("/cards")}>Cards</a>
        <a href={link("/subscriptions")}>Shared Plan</a>
        <a href="/learning">Learning</a>
        <a href={link("/admin")}>Resume studio</a>
      </nav>
      <div className="cards-title">
        <div>
          <p className="cards-kicker">YOUR DAY, WITH LESS SCROLLING.</p>
          <h1>What needs your attention?</h1>
          <p>One clear view of the things you’re keeping track of.</p>
        </div>
        <button
          disabled={busy}
          onClick={() =>
            demo
              ? setMessage(
                  "This is a session-only demo. Refreshing the page clears its data.",
                )
              : void load()
          }
        >
          Refresh overview
        </button>
      </div>
      {demo && (
        <p className="cards-notice">
          Demo mode. Only sample entries you add here are shown. Nothing is
          saved online; refreshing clears this session.
        </p>
      )}
      <p className="cards-status" role="status">
        {message}
      </p>
      {unavailable.length > 0 && (
        <p className="cards-notice">
          Some sections are unavailable: {unavailable.join(", ")}. Their figures
          may be incomplete. Refresh to try again.
        </p>
      )}
      {conflict && (
        <p className="cards-notice">
          Renewals changed on another device. Refresh before saving again; your
          current form stays visible until you do.
        </p>
      )}
      <nav className="cards-view-tabs" aria-label="Dashboard sections">
        <button
          aria-pressed={tab === "overview"}
          onClick={() => {
            setTab("overview");
            setForm(null);
          }}
        >
          Overview
        </button>
        <button
          aria-pressed={tab === "renewals"}
          onClick={() => setTab("renewals")}
        >
          Renewals
        </button>
      </nav>
      {tab === "overview" && (
        <>
          {!summary ? (
            <section className="cards-panel cards-empty">
              <h2>
                {busy ? "Gathering your overview…" : "Overview unavailable"}
              </h2>
              <p>Your private details appear after the data loads.</p>
            </section>
          ) : (
            <>
              <section className="cards-metrics" aria-label="Personal overview">
                <div>
                  <span>Card bills remaining</span>
                  <strong>
                    {summary.sources.cards
                      ? cardMoney(summary.cards.balanceMinor)
                      : "—"}
                  </strong>
                  <small>
                    {summary.cards.count} active cards · latest statements
                  </small>
                </div>
                <div>
                  <span>Shared Plan to collect</span>
                  <strong className="hub-amounts">
                    {!summary.sources.subscriptions
                      ? "—"
                      : Object.entries(summary.subscriptions.collect).length
                        ? Object.entries(summary.subscriptions.collect).map(
                            ([currency, amount]) => (
                              <span key={currency}>
                                {money(amount, currency as "INR")}
                              </span>
                            ),
                          )
                        : "No bills yet"}
                  </strong>
                  <small>Member balances, separate from your costs</small>
                </div>
                <div>
                  <span>Renewals within 30 days</span>
                  <strong>
                    {summary.sources.renewals
                      ? summary.agenda.filter(
                          (a) =>
                            a.kind === "renewal" && daysUntil(a.date) <= 30,
                        ).length
                      : "—"}
                  </strong>
                  <small>Includes overdue items</small>
                </div>
                <div>
                  <span>Learning progress</span>
                  <strong>
                    {summary.sources.learning
                      ? `${Math.round((summary.learning.completed / summary.learning.total) * 100)}%`
                      : "—"}
                  </strong>
                  <small>
                    {summary.learning.completed} of {summary.learning.total}{" "}
                    recorded milestones
                  </small>
                </div>
              </section>
              <section
                className="cards-metrics"
                aria-label="Organizer overview"
              >
                <a href={link("/organizer?tab=expenses")}>
                  <span>Spending this month</span>
                  <strong>
                    {summary.sources.organizer === false
                      ? "—"
                      : cardMoney(summary.organizer.spendingMinor)}
                  </strong>
                </a>
                <a href={link("/organizer?tab=jobs")}>
                  <span>Active applications</span>
                  <strong>
                    {summary.sources.organizer === false
                      ? "—"
                      : summary.organizer.activeApplications}
                  </strong>
                </a>
                <a href={link("/organizer?tab=goals")}>
                  <span>Recorded savings</span>
                  <strong>
                    {summary.sources.organizer === false
                      ? "—"
                      : cardMoney(summary.organizer.savedMinor)}
                  </strong>
                  <small>Across {summary.organizer.goals} active goals</small>
                </a>
                <a href={link("/organizer?tab=notes")}>
                  <span>Notes & bookmarks</span>
                  <strong>
                    {summary.sources.organizer === false
                      ? "—"
                      : summary.organizer.notes}
                  </strong>
                </a>
              </section>
              <div className="hub-main-grid">
                <section className="cards-panel hub-agenda">
                  <div className="cards-section-head">
                    <div>
                      <p className="cards-kicker">ON YOUR RADAR</p>
                      <h2>Your agenda</h2>
                    </div>
                    <label className="cards-search">
                      Time window
                      <select
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                      >
                        <option value="7">Next 7 days + overdue</option>
                        <option value="30">Next 30 days + overdue</option>
                        <option value="overdue">Overdue only</option>
                        <option value="all">All dates</option>
                      </select>
                    </label>
                  </div>
                  <div
                    className="cards-wallet-filters"
                    aria-label="Agenda type"
                  >
                    {[
                      { value: "all", label: "Everything" },
                      { value: "card", label: "Cards" },
                      { value: "subscription", label: "Shared Plan" },
                      { value: "renewal", label: "Renewals" },
                    ].map((t) => (
                      <button
                        key={t.value}
                        aria-pressed={kind === t.value}
                        onClick={() => setKind(t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {!agenda.length && (
                    <div className="cards-empty">
                      <h3>No tracked items in this window.</h3>
                      <p>Add a card bill or renewal to start your agenda.</p>
                    </div>
                  )}
                  {agenda.map((item) => (
                    <a
                      className="hub-agenda-row"
                      key={item.id}
                      href={link(item.href)}
                    >
                      <span className="hub-kind" data-kind={item.kind}>
                        {item.kind === "card"
                          ? "C"
                          : item.kind === "subscription"
                            ? "S"
                            : "R"}
                      </span>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.detail}</p>
                        <small>{cardDate(item.date)}</small>
                      </div>
                      <span className="hub-agenda-end">
                        {item.amountMinor !== undefined && (
                          <strong>
                            {money(
                              item.amountMinor,
                              (item.currency || "INR") as "INR",
                            )}
                          </strong>
                        )}
                        <small data-overdue={daysUntil(item.date) < 0}>
                          {agendaStatus(item.date)} →
                        </small>
                      </span>
                    </a>
                  ))}
                </section>
                <aside>
                  <section className="cards-panel">
                    <p className="cards-kicker">WAITING ON YOU</p>
                    <h2>Shared Plan inbox</h2>
                    <a
                      className="hub-inbox-row"
                      href={link(
                        summary.pending.paymentPlanId
                          ? `/subscriptions?planId=${summary.pending.paymentPlanId}`
                          : "/subscriptions",
                      )}
                    >
                      <span>Payment reports</span>
                      <strong>
                        {summary.sources.payments
                          ? summary.pending.payments
                          : "—"}
                      </strong>
                    </a>
                    <a
                      className="hub-inbox-row"
                      href={link(
                        summary.pending.preferencePlanId
                          ? `/subscriptions?planId=${summary.pending.preferencePlanId}`
                          : "/subscriptions",
                      )}
                    >
                      <span>Schedule requests</span>
                      <strong>
                        {summary.sources.preferences
                          ? summary.pending.preferences
                          : "—"}
                      </strong>
                    </a>
                    <a
                      className="hub-inbox-row"
                      href={link(
                        summary.pending.joinPlanId
                          ? `/subscriptions?planId=${summary.pending.joinPlanId}`
                          : "/subscriptions",
                      )}
                    >
                      <span>Join requests</span>
                      <strong>
                        {summary.sources.joins ? summary.pending.joins : "—"}
                      </strong>
                    </a>
                    <p className="cards-note">
                      Review requests in Shared Plan. Reporting a payment still
                      needs your confirmation.
                    </p>
                  </section>
                  <section className="cards-panel hub-learning">
                    <p className="cards-kicker">KEEP YOUR MOMENTUM</p>
                    <h2>Small steps count.</h2>
                    <progress
                      value={summary.learning.completed}
                      max={summary.learning.total}
                      aria-label="Learning completion"
                    />
                    <p>
                      {summary.learning.activeDays} recorded study days
                      {summary.learning.lastActivity
                        ? ` · Last activity ${cardDate(summary.learning.lastActivity)}`
                        : ""}
                    </p>
                    <a className="cards-button" href="/learning">
                      Continue learning →
                    </a>
                    <small>
                      Uses online-synced progress. Unsynced device changes
                      appear after you save them online.
                    </small>
                  </section>
                </aside>
              </div>
              <section className="hub-launch-grid" aria-label="Your workspaces">
                {[
                  {
                    name: "Expenses",
                    href: "/organizer?tab=expenses",
                    description: "Spending, category budgets and CSV exports.",
                  },
                  {
                    name: "Applications",
                    href: "/organizer?tab=jobs",
                    description:
                      "Interviews, follow-ups and the resume version you sent.",
                  },
                  {
                    name: "Savings goals",
                    href: "/organizer?tab=goals",
                    description: "Targets and your deposit/withdrawal ledger.",
                  },
                  {
                    name: "Reminder centre",
                    href: "/organizer?tab=reminders",
                    description:
                      "Upcoming dates, snooze and calendar downloads.",
                  },
                  {
                    name: "Notes & bookmarks",
                    href: "/organizer?tab=notes",
                    description: "Searchable private links, notes and tags.",
                  },
                  {
                    name: "Cards",
                    href: "/cards",
                    description:
                      "Statements, minimum dues and payment history.",
                  },
                  {
                    name: "Shared Plan",
                    href: "/subscriptions",
                    description:
                      "Members, collections and personal sharing links.",
                  },
                  {
                    name: "Renewals",
                    href: "/dashboard?tab=renewals",
                    description:
                      "Insurance, warranties and the dates that matter.",
                  },
                  {
                    name: "Resume studio",
                    href: "/admin",
                    description:
                      "Your master resume, tailored versions and exports.",
                  },
                ].map((space) => (
                  <a
                    className="cards-panel"
                    key={space.name}
                    href={link(space.href)}
                  >
                    <h3>{space.name} ↗</h3>
                    <p>{space.description}</p>
                  </a>
                ))}
              </section>
            </>
          )}
        </>
      )}
      {tab === "renewals" && (
        <>
          <div className="cards-section-head">
            <div>
              <p className="cards-kicker">DON’T LOSE TRACK OF THE DATE</p>
              <h2>Renewals & expiries</h2>
              <p>
                {activeItems.length} active · {renewalsSoon.length} due within
                30 days or overdue
              </p>
            </div>
            <button
              className="cards-button"
              disabled={!ready || locked}
              onClick={() => startItem()}
            >
              + Add renewal
            </button>
          </div>
          {!ready && (
            <p className="cards-notice">
              Renewals haven’t loaded yet. Refresh the overview to reconnect.
            </p>
          )}
          {form === "item" && (
            <section className="cards-panel hub-form">
              <div className="cards-section-head">
                <h2>{editing ? "Edit renewal" : "Add a renewal"}</h2>
                <button disabled={busy} onClick={() => setForm(null)}>
                  Close form
                </button>
              </div>
              <form
                key={editing?.id || "new"}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(async () => {
                    const dueDate = String(f.get("dueDate"));
                    const item = renewalItemSchema.parse({
                      id: editing?.id || crypto.randomUUID(),
                      title: f.get("title"),
                      category: f.get("category"),
                      provider: f.get("provider") || "",
                      dueDate,
                      anchorDay:
                        editing && editing.dueDate === dueDate
                          ? editing.anchorDay
                          : Number(dueDate.slice(8, 10)),
                      interval: f.get("interval"),
                      amountMinor: parseCardMoney(
                        String(f.get("amount") || "0"),
                      ),
                      reminderDays: Number(f.get("reminderDays")),
                      url: f.get("url") || "",
                      notes: f.get("notes") || "",
                      archived: editing?.archived || false,
                      history: editing?.history || [],
                    });
                    const next = structuredClone(doc);
                    if (editing)
                      next.items = next.items.map((i) =>
                        i.id === item.id ? item : i,
                      );
                    else next.items.push(item);
                    await save(next);
                  });
                }}
              >
                <div className="cards-fields">
                  <Field label="Renewal name">
                    <input
                      name="title"
                      required
                      maxLength={80}
                      defaultValue={editing?.title}
                      placeholder="Car insurance"
                    />
                  </Field>
                  <Field label="Category">
                    <select
                      name="category"
                      defaultValue={editing?.category || "Insurance"}
                    >
                      {renewalCategories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Provider (optional)">
                    <input
                      name="provider"
                      maxLength={80}
                      defaultValue={editing?.provider}
                    />
                  </Field>
                  <Field label="Due / expiry date">
                    <input
                      name="dueDate"
                      type="date"
                      required
                      defaultValue={editing?.dueDate || todayIST()}
                    />
                  </Field>
                  <Field label="Repeat">
                    <select
                      name="interval"
                      defaultValue={editing?.interval || "yearly"}
                    >
                      <option value="once">One-time expiry</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="half-yearly">Every 6 months</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </Field>
                  <Field label="Estimated amount (INR, optional)">
                    <input
                      name="amount"
                      inputMode="decimal"
                      defaultValue={
                        editing ? (editing.amountMinor / 100).toFixed(2) : "0"
                      }
                    />
                  </Field>
                  <Field label="Calendar reminder (days before)">
                    <input
                      name="reminderDays"
                      type="number"
                      min={0}
                      max={90}
                      required
                      defaultValue={editing?.reminderDays ?? 30}
                    />
                  </Field>
                  <Field label="Service link (optional)">
                    <input
                      name="url"
                      type="url"
                      maxLength={2048}
                      defaultValue={editing?.url}
                      placeholder="https://…"
                    />
                  </Field>
                </div>
                <Field label="Notes (optional)">
                  <textarea
                    name="notes"
                    maxLength={500}
                    defaultValue={editing?.notes}
                    placeholder="A useful checklist or renewal note"
                  />
                </Field>
                <p className="cards-note">
                  Use labels and service links. Keep passwords and full
                  identity/account numbers out of your notes.
                </p>
                <button className="cards-button" disabled={locked}>
                  Save renewal
                </button>
              </form>
            </section>
          )}
          {form === "complete" && completing && (
            <section className="cards-panel hub-form">
              <div className="cards-section-head">
                <h2>Record renewal · {completing.title}</h2>
                <button disabled={busy} onClick={() => setForm(null)}>
                  Close form
                </button>
              </div>
              <p>
                Current due date: {cardDate(completing.dueDate)}. Confirm the
                next actual date before saving.
              </p>
              <form
                key={completing.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(async () => {
                    const next = completeRenewal(
                      doc,
                      completing.id,
                      String(f.get("date")),
                      completing.interval === "once"
                        ? null
                        : String(f.get("nextDate")),
                      parseCardMoney(String(f.get("amount") || "0")),
                    );
                    await save(next);
                    setMessage(
                      completing.interval === "once"
                        ? "Completed and archived. Its history is kept."
                        : "Renewal recorded. The next due date is updated.",
                    );
                  });
                }}
              >
                <div className="cards-fields">
                  <Field label="Completion date">
                    <input
                      name="date"
                      type="date"
                      required
                      max={todayIST()}
                      defaultValue={todayIST()}
                    />
                  </Field>
                  {completing.interval !== "once" && (
                    <Field label="Next actual due date">
                      <input
                        name="nextDate"
                        type="date"
                        required
                        min={completing.dueDate}
                        defaultValue={nextRenewalDate(completing) || ""}
                      />
                    </Field>
                  )}
                  <Field label="Amount recorded (INR)">
                    <input
                      name="amount"
                      inputMode="decimal"
                      required
                      defaultValue={(completing.amountMinor / 100).toFixed(2)}
                    />
                  </Field>
                </div>
                <p className="cards-note">
                  This records something you have already completed. It does not
                  renew or pay the provider.
                </p>
                <button className="cards-button" disabled={locked}>
                  {completing.interval === "once"
                    ? "Confirm completion"
                    : "Confirm renewal"}
                </button>
              </form>
            </section>
          )}
          <div className="hub-renewal-filters">
            <label className="cards-search">
              Find renewal
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or provider"
              />
            </label>
            <label className="cards-search">
              Renewal category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All categories</option>
                {renewalCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="cards-search">
              Renewal status
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="soon">Due in 30 days</option>
                <option value="overdue">Overdue</option>
                <option value="archived">Archived / completed</option>
              </select>
            </label>
          </div>
          {!visibleItems.length && (
            <section className="cards-panel cards-empty">
              <h3>
                {doc.items.length
                  ? "No matching renewals."
                  : "Keep your next important date here."}
              </h3>
              <p>
                Insurance, vehicle documents, warranties, domain renewals or
                memberships.
              </p>
            </section>
          )}
          <section className="hub-renewal-grid" aria-label="Renewal items">
            {visibleItems.map((item) => (
              <article
                className="cards-panel hub-renewal-item"
                key={item.id}
                id={"renewal-" + item.id}
                data-selected={selectedItem === item.id}
              >
                <div className="cards-section-head">
                  <span className="cards-kicker">{item.category}</span>
                  <span
                    className="hub-due-badge"
                    data-overdue={!item.archived && daysUntil(item.dueDate) < 0}
                  >
                    {item.archived ? "Archived" : agendaStatus(item.dueDate)}
                  </span>
                </div>
                <h2>{item.title}</h2>
                {item.provider && <p>{item.provider}</p>}
                <dl className="cards-facts">
                  <div>
                    <dt>Due / expires</dt>
                    <dd>{cardDate(item.dueDate)}</dd>
                  </div>
                  <div>
                    <dt>Estimate</dt>
                    <dd>
                      {item.amountMinor
                        ? cardMoney(item.amountMinor)
                        : "Not set"}
                    </dd>
                  </div>
                  <div>
                    <dt>Repeat</dt>
                    <dd>
                      {item.interval === "once" ? "One-time" : item.interval}
                    </dd>
                  </div>
                  <div>
                    <dt>Calendar alert</dt>
                    <dd>{item.reminderDays} days before</dd>
                  </div>
                </dl>
                {item.notes && <p className="hub-item-notes">{item.notes}</p>}
                {item.url && (
                  <a
                    className="cards-secondary-link"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open service ↗
                  </a>
                )}
                <div className="cards-actions">
                  {!item.archived && (
                    <button
                      className="cards-button"
                      disabled={locked}
                      onClick={() => startComplete(item)}
                    >
                      {item.interval === "once"
                        ? "Mark complete"
                        : "Record renewal"}
                    </button>
                  )}
                  <button disabled={locked} onClick={() => startItem(item)}>
                    Edit
                  </button>
                  {!item.archived && (
                    <button
                      onClick={() =>
                        downloadCards(
                          renewalCalendar(item),
                          "renewal-reminder.ics",
                          "text/calendar;charset=utf-8",
                        )
                      }
                    >
                      Calendar
                    </button>
                  )}
                  <button
                    disabled={locked}
                    onClick={() =>
                      void act(async () => {
                        if (
                          !confirm(
                            item.archived
                              ? "Restore this renewal?"
                              : "Archive this renewal? History is preserved.",
                          )
                        )
                          return;
                        const next = structuredClone(doc);
                        next.items = next.items.map((i) =>
                          i.id === item.id
                            ? { ...i, archived: !i.archived }
                            : i,
                        );
                        await save(next);
                      })
                    }
                  >
                    {item.archived ? "Restore" : "Archive"}
                  </button>
                </div>
                {item.history.length > 0 && (
                  <details className="hub-renewal-history">
                    <summary>Renewal history · {item.history.length}</summary>
                    {[...item.history].reverse().map((h) => (
                      <div key={h.id}>
                        <strong>
                          {cardDate(h.date)} · {cardMoney(h.amountMinor)}
                        </strong>
                        <p>
                          {cardDate(h.previousDueDate)} →{" "}
                          {h.nextDueDate
                            ? cardDate(h.nextDueDate)
                            : "Completed"}
                        </p>
                      </div>
                    ))}
                  </details>
                )}
              </article>
            ))}
          </section>
          <div className="cards-bottom-actions">
            <button
              disabled={!doc.items.length}
              onClick={() => downloadCards(renewalsCSV(doc), "renewals.csv")}
            >
              Export renewals
            </button>
            <button
              disabled={!doc.items.length}
              onClick={() =>
                downloadCards(
                  JSON.stringify(doc, null, 2),
                  "renewals-backup.json",
                  "application/json",
                )
              }
            >
              Download renewal backup
            </button>
          </div>
          <p className="cards-note">
            Calendar downloads can create reminders in your calendar. This
            website does not send email or push notifications automatically.
          </p>
        </>
      )}
      <footer className="cards-footer">
        <p>
          Private personal hub · Dates in IST
          {updated ? " · Updated " + updated + " IST" : ""}
        </p>
        <p>
          Cards and Shared Plan keep their own records. Dashboard summaries are
          read-only; renewals are entered and confirmed by you.
        </p>
      </footer>
    </main>
  );
}
