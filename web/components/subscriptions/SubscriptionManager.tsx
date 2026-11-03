"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  interval: "monthly" | "yearly";
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
});
const clone = <T,>(value: T): T => structuredClone(value);
export function SubscriptionManager() {
  const demo = useSearchParams().get("demo") === "1";
  const db = useMemo(() => browserClient(), []);
  const [auth, setAuth] = useState<"checking" | "signedout" | "signedin">(
    demo ? "signedin" : "checking",
  );
  const [doc, setDoc] = useState<SubscriptionDocument | null>(null),
    [revision, setRevision] = useState(0);
  const [settings, setSettings] = useState<Settings>(defaults),
    [membersText, setMembersText] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [loaded, setLoaded] = useState(demo);
  const [selected, setSelected] = useState(""),
    [tab, setTab] = useState<"overview" | "settings">("overview");
  const [shares, setShares] = useState<string[]>([]),
    [link, setLink] = useState("");
  const [payment, setPayment] = useState<{
    memberId: string;
    amount: string;
    date: string;
    note: string;
  } | null>(null);
  async function api(path: string, method = "GET", body?: unknown) {
    const { data } = await db!.auth.getSession();
    if (!data.session) throw new Error("Sign in again to manage your plan.");
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
      const url = `${location.origin}/subscriptions/view#${result.token}`;
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
    });
  }
  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/api/subscriptions");
      setDoc(result?.document || null);
      setRevision(result?.revision || 0);
      setLoaded(true);
      setPayment(null);
      if (result?.document) {
        fillSettings(result.document);
        setSelected(result.document.cycles.at(-1)?.id || "");
      }
      const sharing = await api("/api/subscriptions/share");
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
      if (data.session) void load();
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
  async function persist(next: SubscriptionDocument) {
    const checked = documentSchema.safeParse(next);
    if (!checked.success)
      throw new Error(
        checked.error.issues[0]?.message || "Check the plan fields.",
      );
    if (demo) {
      setDoc(next);
      setMessage("Updated in this demo session only.");
      return;
    }
    const result = await api("/api/subscriptions", "POST", {
      document: next,
      revision,
    });
    setDoc(next);
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
          {!demo && (
            <button onClick={() => void db?.auth.signOut()}>Sign out</button>
          )}
        </div>
      </header>
      <div className="plan-title">
        <div>
          <p className="plan-label">SPLIT FAIRLY. KEEP IT SIMPLE.</p>
          <h1>{doc?.plan.name || "Your shared subscription"}</h1>
          <p>
            {doc
              ? `${count} active people · ${doc.plan.interval === "monthly" ? "Monthly" : "Yearly"} billing`
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
                setDoc(null);
                setRevision(0);
                setShares([]);
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
      <p className="plan-status" role="status">
        {message}
      </p>
      {link && (
        <div className="plan-box">
          <label htmlFor="share-result">
            Link or message — copy and send privately
          </label>
          <textarea
            id="share-result"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
          <button onClick={() => setLink("")}>Hide</button>
        </div>
      )}
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
                    doc.cycles.length &&
                    (plan.anchorDate !== doc.plan.anchorDate ||
                      plan.interval !== doc.plan.interval)
                  )
                    throw new Error(
                      "Billing start and frequency stay fixed after the first cycle so history remains consistent.",
                    );
                  next.plan = plan;
                  await persist(next);
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
                    disabled={!!doc?.cycles.length}
                    value={settings.interval}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        interval: e.target.value as Settings["interval"],
                      })
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="plan-start">First billing date</label>
                  <input
                    id="plan-start"
                    type="date"
                    required
                    disabled={!!doc?.cycles.length}
                    value={settings.anchorDate}
                    onChange={(e) =>
                      setSettings({ ...settings, anchorDate: e.target.value })
                    }
                  />
                </div>
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
                          Joined YouTube
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
              <small>
                Per {doc.plan.interval === "monthly" ? "month" : "year"}
              </small>
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
          <section className="plan-box">
            <div className="plan-section-head">
              <div>
                <h2>Billing cycles</h2>
                <p>
                  Each cycle keeps its own member list, split and payment
                  history. If the total won’t divide evenly, the extra cents or
                  paise are assigned in member order.
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
                      {cycle.allocations.map((allocation) => {
                        const paid = paidTotal(allocation),
                          balance = allocation.amountMinor - paid;
                        return (
                          <tr key={allocation.memberId}>
                            <td>
                              <strong>{allocation.name}</strong>
                              <span
                                className={`plan-badge ${balance === 0 ? "settled" : ""}`}
                              >
                                {balance === 0
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
                                disabled={busy || balance === 0}
                                onClick={() =>
                                  setPayment({
                                    memberId: allocation.memberId,
                                    amount: (balance / 100).toFixed(2),
                                    date: todayIST(),
                                    note: "",
                                  })
                                }
                              >
                                Record payment
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {payment && (
                  <form
                    className="plan-payment-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action(async () => {
                        const next = clone(doc);
                        const allocation = next.cycles
                          .find((c) => c.id === cycle.id)!
                          .allocations.find(
                            (a) => a.memberId === payment.memberId,
                          )!;
                        const amountMinor = parseMoney(payment.amount);
                        if (
                          amountMinor >
                          allocation.amountMinor - paidTotal(allocation)
                        )
                          throw new Error(
                            "Payment exceeds this member’s remaining balance.",
                          );
                        allocation.payments.push({
                          id: crypto.randomUUID(),
                          amountMinor,
                          date: payment.date,
                          note: payment.note.trim(),
                        });
                        await persist(next);
                        setPayment(null);
                      });
                    }}
                  >
                    <h3>
                      Record payment for{" "}
                      {
                        cycle.allocations.find(
                          (a) => a.memberId === payment.memberId,
                        )?.name
                      }
                    </h3>
                    <p>
                      For billing period {cycle.startDate} to{" "}
                      {cycle.renewalDate}. This receipt will appear in the
                      member’s personal payment history.
                    </p>
                    <div className="plan-fields">
                      <div>
                        <label htmlFor="payment-amount">Amount received</label>
                        <input
                          id="payment-amount"
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={payment.amount}
                          onChange={(e) =>
                            setPayment({ ...payment, amount: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label htmlFor="payment-date">Payment date</label>
                        <input
                          id="payment-date"
                          required
                          type="date"
                          value={payment.date}
                          onChange={(e) =>
                            setPayment({ ...payment, date: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <label htmlFor="payment-reference">
                      Private reference / note
                    </label>
                    <input
                      id="payment-reference"
                      maxLength={200}
                      value={payment.note}
                      onChange={(e) =>
                        setPayment({ ...payment, note: e.target.value })
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
                      <button type="button" onClick={() => setPayment(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                <details className="plan-history">
                  <summary>Payment history & corrections</summary>
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
            <h2>Personal member links</h2>
            <p>
              Click a name to copy their personal link. Saved links can be
              copied again anytime.
            </p>
            <ul className="plan-member-list">
              {doc.members.map((member) => (
                <li key={member.id}>
                  <button
                    className="plan-member-copy"
                    disabled={busy || demo}
                    onClick={() => void shareMember(member.id)}
                    aria-label={`Copy link for ${member.name}`}
                  >
                    {member.name}
                    <small>
                      {shares.includes(member.id)
                        ? "Copy personal link ↗"
                        : "Create & copy link ↗"}
                    </small>
                  </button>
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
                            setShares(shares.filter((id) => id !== member.id));
                            setLink("");
                            setMessage("Member link disabled.");
                          })
                        }
                      >
                        Revoke
                      </button>
                    )}
                  </div>
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
      <footer className="plan-footer">
        A private utility on your domain. Payments are recorded by the manager;
        this site does not collect money or send reminders automatically.
      </footer>
    </main>
  );
}
