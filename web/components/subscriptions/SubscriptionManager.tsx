"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  recordMemberReceipt,
  applyAdvanceCredit,
  coverageLabel,
  type CoverageMonths,
} from "@/lib/member-billing";
import { billingLabels } from "@/lib/subscription-statement";
import { browserClient } from "@/lib/supabase";
import {
  buildCycle,
  cycleDates,
  daysUntil,
  documentSchema,
  money,
  paidTotal,
  parseMoney,
  todayIST,
  type SubscriptionDocument,
} from "@/lib/subscriptions";

type Settings = {
  name: string;
  currency: "INR" | "USD" | "EUR" | "GBP";
  amount: string;
  interval: "monthly" | "quarterly" | "half-yearly" | "yearly";
  upiId: string;
  payeeName: string;
  anchorDate: string;
  paymentNote: string;
};
const defaults = (): Settings => ({
  name: "YouTube Premium",
  currency: "INR",
  amount: "",
  interval: "monthly",
  anchorDate: todayIST(),
  paymentNote: "",
  upiId: "",
  payeeName: "",
});
const clone = <T,>(value: T): T => structuredClone(value);
export function SubscriptionManager() {
  const initialPlan = useSearchParams().get("planId") || "";
  const demo = useSearchParams().get("demo") === "1";
  const db = useMemo(() => browserClient(), []);
  const [auth, setAuth] = useState<"checking" | "signedout" | "signedin">(
    demo ? "signedin" : "checking",
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [planId, setPlanId] = useState("");
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [demoPlans, setDemoPlans] = useState<
    Record<string, SubscriptionDocument>
  >({});
  const [reports, setReports] = useState<
    {
      member_id: string;
      cycle_id: string;
      reported_at: string | null;
      term_months?: CoverageMonths;
      amount_minor?: number;
      coverage_end?: string;
      preference_at?: string;
      approved_months?: number;
    }[]
  >([]);
  const [joinRequests, setJoinRequests] = useState<
    { id: string; name: string; email: string; created_at: string }[]
  >([]);
  const [doc, setDoc] = useState<SubscriptionDocument | null>(null),
    [revision, setRevision] = useState(0);
  const [settings, setSettings] = useState<Settings>(defaults),
    [membersText, setMembersText] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [loaded, setLoaded] = useState(demo);
  const [selected, setSelected] = useState(""),
    [tab, setTab] = useState<"overview" | "settings">("overview");
  const [preferences, setPreferences] = useState<
    {
      memberId: string;
      preferredMonths?: number;
      requestedMonths?: number;
      requestedAt?: string;
    }[]
  >([]);
  const [shares, setShares] = useState<string[]>([]),
    [link, setLink] = useState("");
  const [payment, setPayment] = useState<{
    memberId: string;
    amount: string;
    date: string;
    note: string;
    advance?: boolean;
  } | null>(null);
  async function api(path: string, method = "GET", body?: unknown) {
    const { data } = await db!.auth.getSession();
    if (!data.session) throw new Error("Sign in again to manage your plan.");
    if (
      path.startsWith("/api/subscriptions") &&
      method === "GET" &&
      !path.includes("?") &&
      planId
    )
      path += `?planId=${planId}`;
    if (path.startsWith("/api/subscriptions") && method !== "GET")
      body = { ...(body as object), planId: planId || null };
    const response = await fetch(path, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "The request failed. Try again.");
    return result;
  }
  async function shareMember(memberId: string, replace = false) {
    await action(async () => {
      if (
        replace &&
        !confirm("Replace this link? The previous link will stop working.")
      )
        return;
      let result = await api("/api/subscriptions/share", "POST", {
        memberId,
        replace,
      });
      if (result.needsReplacement) {
        if (
          !confirm(
            "This older link cannot be recovered. Replace it once to enable copying it again later? The old link will stop working.",
          )
        )
          return;
        result = await api("/api/subscriptions/share", "POST", {
          memberId,
          replace: true,
        });
      }
      const url = result.code
        ? `${location.origin}/shared/${result.code}`
        : `${location.origin}/subscriptions/view#${result.token}`;
      setLink(url);
      setShares((current) => [...new Set([...current, memberId])]);
      try {
        await navigator.clipboard.writeText(url);
        setMessage("Personal link copied. Send it privately.");
      } catch {
        setMessage("Personal link ready. Copy it from the box.");
      }
    });
  }
  function fillSettings(value: SubscriptionDocument) {
    setSettings({
      ...value.plan,
      amount: (value.plan.amountMinor / 100).toFixed(2),
      upiId:
        value.plan.upiId ||
        (/^(youtube|yt) premium$/i.test(value.plan.name)
          ? "muzammilytpremium@axl"
          : ""),
      payeeName: value.plan.payeeName || "",
    });
  }
  async function load(id = planId) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api(`/api/subscriptions?planId=${id}`);
      setPlans(result?.plans || []);
      setPlanId(result?.id || "");
      setDoc(result?.document || null);
      setRevision(result?.revision || 0);
      setLoaded(true);
      setPayment(null);
      if (result?.document) {
        fillSettings(result.document);
        setSelected(result.document.cycles.at(-1)?.id || "");
      }
      const joining = result?.id
        ? await api(`/api/subscriptions/group?planId=${result.id}`)
        : [];
      setJoinRequests(joining || []);
      const sharing = await api(
        `/api/subscriptions/share?planId=${result?.id || ""}`,
      );
      setReports(sharing.reports || []);
      setPreferences(sharing.shares || []);
      setShares(
        (Array.isArray(sharing) ? sharing : sharing.shares || []).map(
          (s: { memberId: string }) => s.memberId,
        ),
      );
    } catch (e) {
      setMessage(
        `${(e as Error).message} If this is your first visit, the subscription database setup may still be needed.`,
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (demo) return;
    if (!db) {
      setAuth("signedout");
      return;
    }
    let active = true;
    void db.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuth(data.session ? "signedin" : "signedout");
      if (data.session) void load(initialPlan);
    });
    const { data } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAuth("signedout");
        setDoc(null);
        setLink("");
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [db, demo]);
  useEffect(() => {
    if (demo || !planId || auth !== "signedin") return;
    const refreshReports = () => {
      void api(`/api/subscriptions/group?planId=${planId}`)
        .then((result) => setJoinRequests(result || []))
        .catch(() => {});
      void api(`/api/subscriptions/share?planId=${planId}`)
        .then((result) => {
          setReports(result.reports || []);
          setPreferences(result.shares || []);
        })
        .catch(() => {});
    };
    const timer = setInterval(refreshReports, 15000);
    window.addEventListener("focus", refreshReports);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshReports);
    };
  }, [planId, auth, demo]);
  async function persist(
    next: SubscriptionDocument,
    confirmedReport?: { memberId: string; cycleId: string; reportedAt: string },
  ) {
    const checked = documentSchema.safeParse(next);
    if (!checked.success)
      throw new Error(
        checked.error.issues[0]?.message || "Check the plan fields.",
      );
    if (demo) {
      const id = planId || crypto.randomUUID();
      setPlanId(id);
      setDemoPlans((current) => ({ ...current, [id]: next }));
      setPlans((current) => [
        ...current.filter((p) => p.id !== id),
        { id, name: next.plan.name },
      ]);
      setDoc(next);
      setMessage("Updated in this demo session only.");
      return;
    }
    const result = await api("/api/subscriptions", "POST", {
      document: next,
      revision,
      confirmedReport,
    });
    setDoc(next);
    setPlanId(result.id);
    setPlans((current) => [
      ...current.filter((p) => p.id !== result.id),
      { id: result.id, name: next.plan.name },
    ]);
    setRevision(result.revision);
    setMessage("Saved online. Shared member pages show this update.");
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function planFromSettings() {
    return {
      name: settings.name.trim(),
      currency: settings.currency,
      amountMinor: parseMoney(settings.amount),
      interval: settings.interval,
      anchorDate: settings.anchorDate,
      paymentNote: settings.paymentNote.trim(),
      upiId: settings.upiId.trim(),
      payeeName: settings.payeeName.trim(),
    };
  }
  const cycle =
    doc?.cycles.find((c) => c.id === selected) ||
    [...(doc?.cycles || [])].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    )[0];
  const collected =
    cycle?.allocations.reduce((sum, a) => sum + paidTotal(a), 0) || 0;
  const outstanding = (cycle?.totalMinor || 0) - collected;
  const count = doc?.members.filter((m) => m.active).length || 0;
  const due = cycle ? daysUntil(cycle.dueDate) : 0;
  const reportedMembers = new Set(
    reports
      .filter((r) => r.cycle_id === cycle?.id && r.reported_at)
      .map((r) => r.member_id),
  );
  const settledCount =
    cycle?.allocations.filter((a) => paidTotal(a) >= a.amountMinor).length || 0;
  const pendingPreferences = new Set(
    preferences.filter((p) => p.requestedMonths).map((p) => p.memberId),
  );
  const visibleAllocations =
    cycle?.allocations.filter(
      (a) =>
        a.name
          .toLocaleLowerCase()
          .includes(memberSearch.trim().toLocaleLowerCase()) &&
        (collectionFilter === "all" ||
          (collectionFilter === "preferences"
            ? pendingPreferences.has(a.memberId)
            : collectionFilter === "pending"
              ? reportedMembers.has(a.memberId)
              : collectionFilter === "settled"
                ? paidTotal(a) >= a.amountMinor
                : paidTotal(a) < a.amountMinor)),
    ) || [];
  function reminder(
    name: string,
    amount: number,
    currency: string,
    dueDate: string,
  ) {
    return `Hi ${name}, your ${doc?.plan.name} share is ${money(amount, currency as Settings["currency"])}, due ${dueDate}.${doc?.plan.paymentNote ? " " + doc.plan.paymentNote : ""}`;
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied. Paste it into your own message.");
    } catch {
      setLink(text);
      setMessage("Copy the text from the box below.");
    }
  }
  if (auth === "checking")
    return (
      <main className="plan-app">
        <p>Checking your sign-in…</p>
      </main>
    );
  if (auth === "signedout")
    return (
      <main className="plan-app plan-entry">
        <p className="plan-label">SHARED PLAN / MANAGER</p>
        <h1>
          A little less
          <br />
          “who’s paid?”
        </h1>
        <p>
          One place for the bill, the split, and the next payment. This space is
          separate from the portfolio.
        </p>
        <a className="plan-button" href="/login?next=subscriptions">
          Sign in to manage
        </a>
        <a className="plan-text-link" href="/subscriptions?demo=1">
          Try the session-only demo
        </a>
      </main>
    );
  return (
    <main className="plan-app">
      <header className="plan-header">
        <a href="/subscriptions" className="plan-brand">
          Shared<span>plan.</span>
        </a>
        <div>
          <span className="plan-label">
            {demo ? "DEMO · SESSION ONLY" : "MANAGER SPACE"}
          </span>
          <a
            className="plan-text-link"
            href={demo ? "/cards?demo=1" : "/cards"}
          >
            Cards ↗
          </a>
          {!demo && (
            <button onClick={() => void db?.auth.signOut()}>Sign out</button>
          )}
        </div>
      </header>
      <nav className="plan-private-nav" aria-label="Private tools">
        <a href={demo ? "/organizer?demo=1" : "/organizer"}>Organizer</a>
        <a href={demo ? "/dashboard?demo=1" : "/dashboard"}>Dashboard ↗</a>
        <a href={demo ? "/cards?demo=1" : "/cards"}>Cards</a>
        <a href="/learning">Learning</a>
      </nav>
      <nav className="plan-switcher" aria-label="Subscriptions">
        {plans.map((plan) => (
          <button
            key={plan.id}
            disabled={busy}
            aria-pressed={planId === plan.id}
            onClick={() => {
              setLink("");
              setMemberSearch("");
              setCollectionFilter("all");
              setPayment(null);
              setReports([]);
              setJoinRequests([]);
              setShares([]);
              setPreferences([]);
              if (demo) {
                const value = demoPlans[plan.id];
                setPlanId(plan.id);
                setDoc(value);
                fillSettings(value);
                setSelected("");
                setTab("overview");
              } else void load(plan.id);
            }}
          >
            {plan.name}
          </button>
        ))}
        <button
          disabled={busy}
          onClick={() => {
            setPlanId("");
            setDoc(null);
            setRevision(0);
            setSettings({ ...defaults(), name: "" });
            setMembersText("");
            setSelected("");
            setLink("");
            setShares([]);
            setPreferences([]);
            setReports([]);
            setJoinRequests([]);
            setPayment(null);
            setTab("settings");
          }}
        >
          + Add subscription
        </button>
      </nav>
      <div className="plan-title">
        <div>
          <p className="plan-label">SPLIT FAIRLY. KEEP IT SIMPLE.</p>
          <h1>{doc?.plan.name || "Your shared subscription"}</h1>
          <p>
            {doc
              ? `${count} active people · ${billingLabels[doc.plan.interval].label} billing`
              : "Set up once. Share a personal view with each member."}
          </p>
        </div>
        {doc && (
          <nav aria-label="Manager sections">
            <button
              aria-pressed={tab === "overview"}
              onClick={() => setTab("overview")}
            >
              Overview
            </button>
            <button
              aria-pressed={tab === "settings"}
              onClick={() => setTab("settings")}
            >
              Plan & members
            </button>
          </nav>
        )}
      </div>
      {demo && (
        <p className="plan-banner">
          Demo mode. Nothing is saved online, and share links are unavailable.
          Refreshing clears this session.
        </p>
      )}
      <p className="plan-status" role="status">
        {message}
      </p>
      {!loaded && !demo && (
        <button disabled={busy} onClick={() => void load()}>
          Retry loading
        </button>
      )}
      {loaded && (!doc || tab === "settings") && (
        <section className="plan-grid">
          <form
            className="plan-box"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const plan = planFromSettings();
                if (doc) {
                  const next = clone(doc);
                  if (
                    plan.interval !== doc.plan.interval &&
                    plan.anchorDate === doc.plan.anchorDate &&
                    doc.cycles.length
                  )
                    plan.anchorDate = [...doc.cycles].sort((a, b) =>
                      b.startDate.localeCompare(a.startDate),
                    )[0].renewalDate;
                  next.plan = plan;
                  await persist(next);
                  fillSettings(next);
                } else {
                  const names = membersText
                    .split("\n")
                    .map((n) => n.trim())
                    .filter(Boolean);
                  if (!names.length)
                    throw new Error(
                      "Add everyone sharing the bill, including yourself.",
                    );
                  const next: SubscriptionDocument = {
                    version: 1,
                    plan,
                    members: names.map((name) => ({
                      id: crypto.randomUUID(),
                      name,
                      active: true,
                    })),
                    cycles: [],
                  };
                  await persist(next);
                }
                setTab("overview");
              });
            }}
          >
            <h2>{doc ? "Plan settings" : "Set up your plan"}</h2>
            <p>
              Include yourself in the member list if you are also sharing the
              bill.
            </p>
            <fieldset disabled={busy}>
              <label htmlFor="plan-name">Plan name</label>
              <input
                id="plan-name"
                required
                maxLength={80}
                value={settings.name}
                onChange={(e) =>
                  setSettings({ ...settings, name: e.target.value })
                }
              />
              <div className="plan-fields">
                <div>
                  <label htmlFor="plan-price">Total subscription price</label>
                  <input
                    id="plan-price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={settings.amount}
                    onChange={(e) =>
                      setSettings({ ...settings, amount: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="plan-currency">Currency</label>
                  <select
                    id="plan-currency"
                    value={settings.currency}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        currency: e.target.value as Settings["currency"],
                      })
                    }
                  >
                    {["INR", "USD", "EUR", "GBP"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="plan-fields">
                <div>
                  <label htmlFor="plan-frequency">Billing frequency</label>
                  <select
                    id="plan-frequency"
                    value={settings.interval}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        interval: e.target.value as Settings["interval"],
                      })
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="half-yearly">Half-yearly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="plan-start">Billing schedule starts</label>
                  <input
                    id="plan-start"
                    type="date"
                    required
                    value={settings.anchorDate}
                    onChange={(e) =>
                      setSettings({ ...settings, anchorDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="plan-fields">
                <label>
                  Receiving UPI ID
                  <input
                    value={settings.upiId}
                    placeholder="name@bank"
                    onChange={(e) =>
                      setSettings({ ...settings, upiId: e.target.value })
                    }
                  />
                </label>
                <label>
                  Payee name
                  <input
                    value={settings.payeeName}
                    placeholder="Name shown to members"
                    onChange={(e) =>
                      setSettings({ ...settings, payeeName: e.target.value })
                    }
                  />
                </label>
              </div>
              <label htmlFor="payment-note">
                Payment instructions (shown on member pages)
              </label>
              <textarea
                id="payment-note"
                maxLength={500}
                placeholder="e.g. Pay to my UPI ID, and message me after paying."
                value={settings.paymentNote}
                onChange={(e) =>
                  setSettings({ ...settings, paymentNote: e.target.value })
                }
              />
              {!doc && (
                <>
                  <label htmlFor="initial-members">
                    Members — one name per line
                  </label>
                  <textarea
                    id="initial-members"
                    required
                    rows={5}
                    placeholder={"Your name\nFriend 1\nFriend 2"}
                    value={membersText}
                    onChange={(e) => setMembersText(e.target.value)}
                  />
                </>
              )}
              <button className="plan-button" type="submit">
                {busy ? "Saving…" : doc ? "Save settings" : "Create plan"}
              </button>
            </fieldset>
            <small>
              Prices and active members affect new cycles. Existing cycle
              amounts stay unchanged.
            </small>
          </form>
          <div className="plan-box">
            <h2>{doc ? "Members" : "How it works"}</h2>
            {!doc ? (
              <ol>
                <li>Add the total price and everyone sharing it.</li>
                <li>Open a billing cycle to calculate each share.</li>
                <li>Record payments as they arrive.</li>
                <li>Send each friend their own read-only link.</li>
              </ol>
            ) : (
              <>
                <ul className="plan-member-list">
                  {doc.members.map((member) => (
                    <li key={member.id}>
                      <span>
                        {member.name}
                        <small>
                          {member.active
                            ? "Included in new cycles"
                            : "Inactive · history kept"}
                        </small>
                      </span>
                      <div className="plan-actions">
                        <label>
                          Joined plan
                          <input
                            type="date"
                            aria-label={`Joined date for ${member.name}`}
                            value={member.joinedDate || ""}
                            disabled={busy}
                            onChange={(e) => {
                              const value = e.target.value;
                              void action(async () => {
                                const next = clone(doc);
                                const target = next.members.find(
                                  (m) => m.id === member.id,
                                )!;
                                if (value) target.joinedDate = value;
                                else delete target.joinedDate;
                                await persist(next);
                              });
                            }}
                          />
                        </label>
                        <button
                          disabled={busy}
                          onClick={() => {
                            const name = prompt(
                              "Member name (past bills keep their original names)",
                              member.name,
                            )?.trim();
                            if (name)
                              void action(async () => {
                                const next = clone(doc);
                                next.members.find(
                                  (m) => m.id === member.id,
                                )!.name = name;
                                await persist(next);
                              });
                          }}
                        >
                          Rename
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              const next = clone(doc);
                              next.members.find(
                                (m) => m.id === member.id,
                              )!.active = !member.active;
                              await persist(next);
                            })
                          }
                        >
                          {member.active ? "Pause" : "Reactivate"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const name = String(
                      new FormData(form).get("memberName") || "",
                    ).trim();
                    if (!name) return;
                    void action(async () => {
                      const next = clone(doc);
                      next.members.push({
                        id: crypto.randomUUID(),
                        name,
                        active: true,
                      });
                      await persist(next);
                      form.reset();
                    });
                  }}
                >
                  <label htmlFor="member-name">Add member</label>
                  <div className="plan-inline">
                    <input
                      id="member-name"
                      name="memberName"
                      maxLength={80}
                      required
                    />
                    <button disabled={busy} type="submit">
                      Add
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      )}
      {doc && tab === "overview" && (
        <>
          <section className="plan-summary" aria-label="Billing summary">
            <div>
              <span>Current plan price</span>
              <strong>{money(doc.plan.amountMinor, doc.plan.currency)}</strong>
              <small>Per {billingLabels[doc.plan.interval].period}</small>
            </div>
            <div>
              <span>Collected this cycle</span>
              <strong>
                {money(collected, cycle?.currency || doc.plan.currency)}
              </strong>
              <small>{cycle ? cycle.startDate : "No cycle opened"}</small>
            </div>
            <div>
              <span>Still to collect</span>
              <strong>
                {money(outstanding, cycle?.currency || doc.plan.currency)}
              </strong>
              <small>
                {cycle
                  ? outstanding === 0
                    ? "All settled"
                    : due < 0
                      ? `${Math.abs(due)} days overdue`
                      : due === 0
                        ? "Due today"
                        : `Due in ${due} days`
                  : "Create your first cycle below"}
              </small>
            </div>
          </section>
          {cycle && (
            <section
              className="plan-collection"
              aria-label="Collection progress"
            >
              <div>
                <p className="plan-label">COLLECTION PROGRESS</p>
                <h2>
                  {settledCount} of {cycle.allocations.length} members settled
                </h2>
              </div>
              <div className="plan-collection-meter">
                <progress
                  value={collected}
                  max={cycle.totalMinor || 1}
                  aria-label="Amount collected"
                />
                <span>
                  {money(collected, cycle.currency)} of{" "}
                  {money(cycle.totalMinor, cycle.currency)}
                </span>
              </div>
              {pendingPreferences.size > 0 && (
                <button onClick={() => setCollectionFilter("preferences")}>
                  {pendingPreferences.size} schedule requests →
                </button>
              )}
              {reportedMembers.size > 0 && (
                <button onClick={() => setCollectionFilter("pending")}>
                  {reportedMembers.size} to verify →
                </button>
              )}
            </section>
          )}
          <section className="plan-box">
            <div className="plan-section-head">
              <div>
                <h2>Billing cycles</h2>
                <p>
                  Review each person’s balance and record confirmed payments.
                  Past bills keep their original split.
                </p>
              </div>
              <button
                className="plan-button"
                disabled={busy || !count}
                onClick={() =>
                  void action(async () => {
                    const next = clone(doc);
                    const created = buildCycle(next);
                    if (
                      !confirm(
                        `Open the cycle starting ${created.startDate}? The total ${money(created.totalMinor, created.currency)} will be split between ${created.allocations.length} members.`,
                      )
                    )
                      return;
                    applyAdvanceCredit(next, created);
                    next.cycles.push(created);
                    await persist(next);
                    setSelected(created.id);
                    setPayment(null);
                  })
                }
              >
                Open next cycle
              </button>
            </div>
            <details className="plan-past-period">
              <summary>Add a past billing period</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const values = new FormData(form);
                  void action(async () => {
                    const start = String(values.get("pastStart"));
                    if (start > todayIST())
                      throw new Error("Choose a past or current billing date.");
                    if (doc.cycles.some((c) => c.startDate === start))
                      throw new Error(
                        "A billing period already starts on that date.",
                      );
                    const next = clone(doc);
                    const temp = clone(doc);
                    temp.plan.amountMinor = parseMoney(
                      String(values.get("pastAmount")),
                    );
                    temp.members = temp.members.map((m) => ({
                      ...m,
                      active:
                        m.active &&
                        (!m.joinedDate ||
                          m.joinedDate <
                            cycleDates(start, doc.plan.interval, 1).startDate),
                    }));
                    const created = buildCycle(temp);
                    const dates = cycleDates(start, doc.plan.interval, 0);
                    Object.assign(created, dates, { dueDate: start });
                    applyAdvanceCredit(next, created);
                    next.cycles.push(created);
                    await persist(next);
                    setSelected(created.id);
                    setPayment(null);
                    form.reset();
                  });
                }}
              >
                <p>
                  Enter the actual period and total price. Shares use current
                  active members and their join dates. Record received payments
                  against this period afterward.
                </p>
                <label>
                  Past period starts
                  <input
                    type="date"
                    name="pastStart"
                    max={todayIST()}
                    required
                  />
                </label>
                <label>
                  Total price for this period
                  <input
                    name="pastAmount"
                    inputMode="decimal"
                    defaultValue={(doc.plan.amountMinor / 100).toFixed(2)}
                    required
                  />
                </label>
                <button disabled={busy}>Add past period</button>
              </form>
            </details>
            {doc.cycles.length > 0 && (
              <>
                <label htmlFor="cycle-select">View cycle</label>
                <select
                  id="cycle-select"
                  value={cycle?.id}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setPayment(null);
                  }}
                >
                  {[...doc.cycles].reverse().map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.startDate} — {c.renewalDate}
                    </option>
                  ))}
                </select>
              </>
            )}
            {!cycle ? (
              <div className="plan-empty">
                <h3>No bills yet.</h3>
                <p>
                  Open the first cycle when you’re ready. Nothing is charged
                  automatically.
                </p>
              </div>
            ) : (
              <>
                <div className="plan-cycle-line">
                  <span>
                    Renews <strong>{cycle.renewalDate}</strong> ·{" "}
                    {Math.max(0, daysUntil(cycle.renewalDate))} days remaining
                  </span>
                  <label>
                    Pay by
                    <input
                      aria-label="Payment due date"
                      type="date"
                      value={cycle.dueDate}
                      disabled={busy}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!value) return;
                        void action(async () => {
                          const next = clone(doc);
                          next.cycles.find((c) => c.id === cycle.id)!.dueDate =
                            value;
                          await persist(next);
                        });
                      }}
                    />
                  </label>
                </div>
                <div className="plan-member-toolbar">
                  <label>
                    Find a member
                    <input
                      type="search"
                      value={memberSearch}
                      placeholder="Search by name"
                      onChange={(e) => {
                        setMemberSearch(e.target.value);
                        setPayment(null);
                      }}
                    />
                  </label>
                  <label>
                    Payment status
                    <select
                      value={collectionFilter}
                      onChange={(e) => {
                        setCollectionFilter(e.target.value);
                        setPayment(null);
                      }}
                    >
                      <option value="all">All members</option>
                      <option value="unpaid">Outstanding</option>
                      <option value="pending">Needs verification</option>
                      <option value="preferences">Schedule requests</option>
                      <option value="settled">Settled</option>
                    </select>
                  </label>
                  <span aria-live="polite">
                    {visibleAllocations.length} of {cycle.allocations.length}{" "}
                    members
                  </span>
                </div>
                {visibleAllocations.length === 0 && (
                  <div className="plan-empty">
                    <h3>No matching members</h3>
                    <button
                      onClick={() => {
                        setMemberSearch("");
                        setCollectionFilter("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                <div className="plan-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Share</th>
                        <th>Paid</th>
                        <th>Balance</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAllocations.map((allocation) => {
                        const paid = paidTotal(allocation),
                          balance = allocation.amountMinor - paid;
                        return (
                          <Fragment key={allocation.memberId}>
                            <tr>
                              <td>
                                <strong>{allocation.name}</strong>
                                {preferences
                                  .filter(
                                    (p) =>
                                      p.memberId === allocation.memberId &&
                                      (p.preferredMonths || p.requestedMonths),
                                  )
                                  .map((preference) => (
                                    <div
                                      className="plan-preference"
                                      key={preference.memberId}
                                    >
                                      {preference.preferredMonths && (
                                        <small>
                                          {coverageLabel(
                                            preference.preferredMonths,
                                          )}{" "}
                                          · Approved schedule
                                        </small>
                                      )}
                                      {preference.requestedMonths && (
                                        <>
                                          <small>
                                            {coverageLabel(
                                              preference.requestedMonths,
                                            )}{" "}
                                            requested · Awaiting approval
                                          </small>
                                          <button
                                            disabled={busy}
                                            onClick={() =>
                                              void action(async () => {
                                                await api(
                                                  "/api/subscriptions/share",
                                                  "POST",
                                                  {
                                                    memberId:
                                                      allocation.memberId,
                                                    cycleId: cycle.id,
                                                    approveMonths:
                                                      preference.requestedMonths,
                                                  },
                                                );
                                                setPreferences((current) =>
                                                  current.map((p) =>
                                                    p.memberId ===
                                                    preference.memberId
                                                      ? {
                                                          ...p,
                                                          preferredMonths:
                                                            preference.requestedMonths,
                                                          requestedMonths:
                                                            undefined,
                                                        }
                                                      : p,
                                                  ),
                                                );
                                                setMessage(
                                                  `${coverageLabel(preference.requestedMonths)} schedule approved for ${allocation.name}. Payment receipts are recorded separately.`,
                                                );
                                              })
                                            }
                                          >
                                            Approve preference
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                <span
                                  className={`plan-badge ${balance === 0 ? "settled" : ""}`}
                                >
                                  {reports.some(
                                    (r) =>
                                      r.reported_at &&
                                      r.member_id === allocation.memberId &&
                                      r.cycle_id === cycle.id,
                                  )
                                    ? "Member reported paid · verify"
                                    : balance === 0
                                      ? "Settled"
                                      : paid
                                        ? "Part paid"
                                        : "Awaiting payment"}
                                </span>
                              </td>
                              <td data-label="Share">
                                {money(allocation.amountMinor, cycle.currency)}
                              </td>
                              <td data-label="Paid">
                                {money(paid, cycle.currency)}
                              </td>
                              <td data-label="Balance">
                                {money(balance, cycle.currency)}
                              </td>
                              <td>
                                <button
                                  disabled={
                                    busy ||
                                    (balance === 0 &&
                                      !reports.some(
                                        (r) =>
                                          r.member_id === allocation.memberId &&
                                          r.cycle_id === cycle.id &&
                                          r.reported_at &&
                                          r.amount_minor,
                                      ))
                                  }
                                  onClick={() =>
                                    setPayment({
                                      memberId: allocation.memberId,
                                      advance:
                                        (reports.find(
                                          (r) =>
                                            r.member_id ===
                                              allocation.memberId &&
                                            r.cycle_id === cycle.id &&
                                            r.reported_at,
                                        )?.amount_minor || 0) > balance,
                                      amount: (
                                        (reports.find(
                                          (r) =>
                                            r.member_id ===
                                              allocation.memberId &&
                                            r.cycle_id === cycle.id &&
                                            r.reported_at,
                                        )?.amount_minor || balance) / 100
                                      ).toFixed(2),
                                      date: todayIST(),
                                      note: "",
                                    })
                                  }
                                >
                                  {reports.some(
                                    (r) =>
                                      r.reported_at &&
                                      r.member_id === allocation.memberId &&
                                      r.cycle_id === cycle.id,
                                  )
                                    ? "Verify & record"
                                    : "Record payment"}
                                </button>
                                <button
                                  disabled={busy || balance === 0}
                                  onClick={() =>
                                    void copy(
                                      reminder(
                                        allocation.name,
                                        balance,
                                        cycle.currency,
                                        cycle.dueDate,
                                      ),
                                    )
                                  }
                                >
                                  Copy reminder
                                </button>
                              </td>
                            </tr>
                            <tr
                              className="plan-inline-receipt"
                              hidden={payment?.memberId !== allocation.memberId}
                            >
                              <td colSpan={5}>
                                {" "}
                                {payment?.memberId === allocation.memberId && (
                                  <form
                                    className="plan-payment-form"
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      void action(async () => {
                                        const next = clone(doc);
                                        const allocation = next.cycles
                                          .find((c) => c.id === cycle.id)!
                                          .allocations.find(
                                            (a) =>
                                              a.memberId === payment.memberId,
                                          )!;
                                        const amountMinor = parseMoney(
                                          payment.amount,
                                        );
                                        const report = reports.find(
                                          (r) =>
                                            r.member_id === payment.memberId &&
                                            r.cycle_id === cycle.id &&
                                            r.reported_at,
                                        );
                                        if (
                                          amountMinor >
                                            allocation.amountMinor -
                                              paidTotal(allocation) &&
                                          !payment.advance
                                        )
                                          throw new Error(
                                            "Payment exceeds this member’s remaining balance.",
                                          );
                                        recordMemberReceipt(
                                          next,
                                          cycle.id,
                                          payment.memberId,
                                          amountMinor,
                                          payment.date,
                                          payment.note.trim(),
                                          report?.term_months,
                                        );
                                        await persist(
                                          next,
                                          report?.reported_at
                                            ? {
                                                memberId: payment.memberId,
                                                cycleId: cycle.id,
                                                reportedAt: report.reported_at,
                                              }
                                            : undefined,
                                        );
                                        if (report)
                                          setReports((current) =>
                                            current.filter((r) => r !== report),
                                          );
                                        setPayment(null);
                                      });
                                    }}
                                  >
                                    <h3>
                                      Record payment for{" "}
                                      {
                                        cycle.allocations.find(
                                          (a) =>
                                            a.memberId === payment.memberId,
                                        )?.name
                                      }
                                    </h3>
                                    <p>
                                      For billing period {cycle.startDate} to{" "}
                                      {cycle.renewalDate}. This receipt will
                                      appear in the member’s personal payment
                                      history.
                                    </p>
                                    <div className="plan-fields">
                                      <div>
                                        <label htmlFor="payment-amount">
                                          Amount received
                                        </label>
                                        <input
                                          id="payment-amount"
                                          required
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          value={payment.amount}
                                          onChange={(e) =>
                                            setPayment({
                                              ...payment,
                                              amount: e.target.value,
                                            })
                                          }
                                        />
                                      </div>
                                      <div>
                                        <label htmlFor="payment-date">
                                          Payment date
                                        </label>
                                        <input
                                          id="payment-date"
                                          required
                                          type="date"
                                          value={payment.date}
                                          onChange={(e) =>
                                            setPayment({
                                              ...payment,
                                              date: e.target.value,
                                            })
                                          }
                                        />
                                      </div>
                                    </div>
                                    <label className="plan-advance-toggle">
                                      <input
                                        type="checkbox"
                                        checked={!!payment.advance}
                                        onChange={(e) =>
                                          setPayment({
                                            ...payment,
                                            advance: e.target.checked,
                                          })
                                        }
                                      />{" "}
                                      Record excess as advance credit
                                    </label>
                                    <label htmlFor="payment-reference">
                                      Private reference / note
                                    </label>
                                    <input
                                      id="payment-reference"
                                      maxLength={200}
                                      value={payment.note}
                                      onChange={(e) =>
                                        setPayment({
                                          ...payment,
                                          note: e.target.value,
                                        })
                                      }
                                    />
                                    <div className="plan-actions">
                                      <button
                                        className="plan-button"
                                        disabled={busy}
                                        type="submit"
                                      >
                                        Save payment
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPayment(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <details className="plan-history">
                  <summary>Payment history & corrections</summary>
                  {(doc.credits || []).map((c) => (
                    <p key={c.id}>
                      {doc.members.find((m) => m.id === c.memberId)?.name}:{" "}
                      Advance received {money(c.amountMinor, c.currency)} on{" "}
                      {c.date} · {money(c.remainingMinor, c.currency)} remaining
                    </p>
                  ))}
                  {cycle.allocations.flatMap((a) =>
                    a.payments.map((p) => (
                      <div className="plan-history-row" key={p.id}>
                        <span>
                          {a.name}
                          <small>
                            {p.date}
                            {p.note ? " · " + p.note : ""}
                          </small>
                        </span>
                        <strong>{money(p.amountMinor, cycle.currency)}</strong>
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              !confirm(
                                "Remove this payment record? The balance will increase again.",
                              )
                            )
                              return;
                            void action(async () => {
                              const next = clone(doc);
                              const target = next.cycles
                                .find((c) => c.id === cycle.id)!
                                .allocations.find(
                                  (x) => x.memberId === a.memberId,
                                )!;
                              if (p.sourceCreditId) {
                                const credit = next.credits?.find(
                                  (c) => c.id === p.sourceCreditId,
                                );
                                if (credit)
                                  credit.remainingMinor = Math.min(
                                    credit.amountMinor,
                                    credit.remainingMinor + p.amountMinor,
                                  );
                              }
                              target.payments = target.payments.filter(
                                (x) => x.id !== p.id,
                              );
                              await persist(next);
                            });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )),
                  )}
                  {!cycle.allocations.some((a) => a.payments.length) && (
                    <p>No payments recorded yet.</p>
                  )}
                </details>
              </>
            )}
          </section>
          <section className="plan-box">
            <div className="plan-section-head">
              <div>
                <p className="plan-label">INVITE & SHARE</p>
                <h2>People & links</h2>
                <p>
                  Invite someone new, or copy an existing member’s private
                  payment page.
                </p>
              </div>
              <a className="plan-text-link" href="#plan-members-links">
                Member links ↓
              </a>
            </div>
            <div className="plan-invite-strip">
              <div>
                <h3>Invite someone new</h3>
                <p>They request a place. You approve who joins.</p>
              </div>
              <button
                disabled={busy || demo}
                onClick={() =>
                  void action(async () => {
                    const result = await api(
                      "/api/subscriptions/group",
                      "POST",
                      {},
                    );
                    const url = `${location.origin}/group/${result.code}`;
                    setLink(url);
                    await copy(url);
                  })
                }
              >
                Copy group invite
              </button>
            </div>
            {joinRequests.length > 0 && (
              <div className="plan-join-requests">
                <h3>Awaiting approval</h3>
                {joinRequests.map((request) => (
                  <article key={request.id}>
                    <div>
                      <strong>{request.name}</strong>
                      <p>{request.email}</p>
                    </div>
                    <div className="plan-actions">
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api("/api/subscriptions/group", "POST", {
                              requestId: request.id,
                              approve: true,
                            });
                            await load(planId);
                            setMessage(
                              "Member approved. Copy their personal link below and arrange subscription access with them.",
                            );
                          })
                        }
                      >
                        Approve {request.name}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api("/api/subscriptions/group", "POST", {
                              requestId: request.id,
                              approve: false,
                            });
                            setJoinRequests((current) =>
                              current.filter((r) => r.id !== request.id),
                            );
                          })
                        }
                      >
                        Decline
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {link && (
              <div className="plan-share-result">
                <label htmlFor="share-result">Ready to share privately</label>
                <textarea
                  id="share-result"
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                />
                <div className="plan-actions">
                  <button onClick={() => void copy(link)}>Copy again</button>
                  <button onClick={() => setLink("")}>Dismiss</button>
                </div>
                <small>
                  You can retrieve a member’s link again by clicking their name.
                </small>
              </div>
            )}
            <h3 id="plan-members-links" style={{ marginTop: 28 }}>
              Personal member links
            </h3>
            <p>
              Click a name to copy their personal link. Saved links can be
              copied again anytime.
            </p>
            <ul className="plan-member-list plan-link-list">
              {doc.members.map((member) => (
                <li key={member.id}>
                  <button
                    className="plan-member-copy"
                    disabled={busy || demo}
                    onClick={() => void shareMember(member.id)}
                    aria-label={`Copy link for ${member.name}`}
                  >
                    <span className="plan-person-avatar" aria-hidden="true">
                      {Array.from(member.name)[0]?.toUpperCase()}
                    </span>
                    <span>{member.name}</span>
                    <small>
                      {shares.includes(member.id)
                        ? "Copy personal link ↗"
                        : "Create & copy link ↗"}
                    </small>
                  </button>
                  <details className="plan-link-options">
                    <summary>Link options</summary>
                    <div className="plan-actions">
                      <button
                        disabled={busy || demo}
                        onClick={() => void shareMember(member.id, true)}
                      >
                        Replace link
                      </button>
                      {shares.includes(member.id) && (
                        <button
                          disabled={busy || demo}
                          onClick={() =>
                            void action(async () => {
                              if (!confirm("Disable this link?")) return;
                              await api("/api/subscriptions/share", "POST", {
                                memberId: member.id,
                                revoke: true,
                              });
                              setShares(
                                shares.filter((id) => id !== member.id),
                              );
                              setLink("");
                              setMessage("Member link disabled.");
                            })
                          }
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            {demo && <small>Share links require a saved online plan.</small>}
          </section>
          <div className="plan-bottom-actions">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(doc, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "subscription-backup.json";
                document.body.append(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
              }}
            >
              Download JSON backup
            </button>
            {!demo && (
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Reload the saved online plan? Unsaved form changes will be replaced.",
                    )
                  )
                    void load();
                }}
              >
                Reload online
              </button>
            )}
          </div>
        </>
      )}
      {doc && tab === "settings" && (
        <section className="plan-box plan-danger-zone">
          <h2>Remove this plan</h2>
          <p>
            Deletes this plan, its billing and payment history, and all personal
            links. Download a backup below first. This does not cancel your
            YouTube subscription or reverse any payments.
          </p>
          <button
            disabled={busy}
            onClick={() => {
              if (
                prompt(
                  `Type ${doc.plan.name} to permanently delete this plan and disable every shared link.`,
                ) !== doc.plan.name
              )
                return;
              void action(async () => {
                if (!demo)
                  await api("/api/subscriptions", "DELETE", { revision });
                setPlans((current) => current.filter((p) => p.id !== planId));
                setPlanId("");
                setReports([]);
                setJoinRequests([]);
                setDoc(null);
                setRevision(0);
                setShares([]);
                setPreferences([]);
                setLink("");
                setPayment(null);
                setSelected("");
                setSettings(defaults());
                setMembersText("");
                setTab("overview");
                setMessage("Plan removed. Its personal links no longer work.");
              });
            }}
          >
            Delete plan permanently
          </button>
        </section>
      )}
      <footer className="plan-footer">
        Shared plans · Private manager workspace.
      </footer>
    </main>
  );
}
