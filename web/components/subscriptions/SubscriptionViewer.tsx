"use client";
import { useEffect, useState } from "react";
import { daysUntil, money } from "@/lib/subscriptions";
import { GroupMembers } from "./GroupMembers";
import { CoverageCards } from "./CoverageCards";
import { PaymentActivity } from "./PaymentActivity";
import {
  coverageOptions,
  coverageQuote,
  type CoverageMonths,
} from "@/lib/member-billing";
import { subscriptionUpiPayment } from "@/lib/subscription-upi";
type MemberCycle = {
  id: string;
  startDate: string;
  dueDate: string;
  renewalDate: string;
  currency: "INR" | "USD" | "EUR" | "GBP";
  amountMinor: number;
  reportedAt?: string;
  coverage?: {
    months?: CoverageMonths;
    amountMinor?: number;
    endDate?: string;
    requestedAt?: string;
    approvedMonths?: number;
  };
  payments: { amountMinor: number; date: string; sourceCreditId?: string }[];
};
type View = {
  groupMembers?: { firstName: string }[];
  credits?: {
    id: string;
    amountMinor: number;
    remainingMinor: number;
    currency: "INR" | "USD" | "EUR" | "GBP";
    date: string;
    startDate: string;
    endDate: string;
  }[];
  plan: {
    name: string;
    paymentNote: string;
    interval: string;
    upiId?: string;
    payeeName?: string;
  };
  member: {
    id: string;
    name: string;
    joinedDate?: string;
    preferredMonths?: CoverageMonths;
  };
  cycles: MemberCycle[];
};
const paid = (cycle: MemberCycle) =>
  cycle.payments.reduce((sum, p) => sum + p.amountMinor, 0);
function displayDate(date: string, monthOnly = false) {
  return new Intl.DateTimeFormat(
    "en-IN",
    monthOnly
      ? { month: "long", year: "numeric", timeZone: "UTC" }
      : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  ).format(new Date(date + "T00:00:00Z"));
}
function countdown(date: string) {
  const days = daysUntil(date);
  return days < 0
    ? `${Math.abs(days)} days overdue`
    : days === 0
      ? "Due today"
      : `Due in ${days} ${days === 1 ? "day" : "days"}`;
}
function calendar(cycle: MemberCycle, name: string) {
  const compact = (value: string) => value.replaceAll("-", "");
  const end = new Date(cycle.dueDate + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  const escape = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shared Plan//Payment Date//EN",
    "BEGIN:VEVENT",
    `UID:${cycle.id}@shared-plan`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${compact(cycle.dueDate)}`,
    `DTEND;VALUE=DATE:${compact(end.toISOString().slice(0, 10))}`,
    `SUMMARY:${escape(name + " payment due")}`,
    `DESCRIPTION:${escape("Amount remaining: " + money(cycle.amountMinor - paid(cycle), cycle.currency))}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "subscription-payment.ics";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function PaymentLink({
  cycle,
  plan,
  onReported,
  creditMinor = 0,
  preferredMonths,
  accessCode,
}: {
  cycle: MemberCycle;
  plan: View["plan"];
  onReported: () => void;
  creditMinor?: number;
  preferredMonths?: CoverageMonths;
  accessCode?: string;
}) {
  const baseMonths = coverageQuote(cycle, 1).baseMonths;
  const [months, setMonths] = useState<CoverageMonths>(
    cycle.coverage?.months ||
      preferredMonths ||
      ([1, 3, 6, 12].includes(baseMonths) ? (baseMonths as CoverageMonths) : 1),
  );
  const quote = coverageQuote(cycle, months, creditMinor);
  const payment = subscriptionUpiPayment(
    plan.name,
    {
      ...cycle,
      amountMinor: quote.amountMinor,
      payments: [],
      renewalDate: quote.endDate,
    },
    { ...plan, coverageMonths: months },
  );
  const [openedAt, setOpenedAt] = useState(0),
    [seconds, setSeconds] = useState(0),
    [reported, setReported] = useState(!!cycle.reportedAt),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    setReported(!!cycle.reportedAt);
    if (!cycle.reportedAt) {
      setOpenedAt(0);
      setSeconds(0);
    }
  }, [cycle.reportedAt]);
  useEffect(() => {
    if (!openedAt) return;
    const tick = () =>
      setSeconds(Math.max(0, 10 - Math.floor((Date.now() - openedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [openedAt]);
  async function send(action: "opened" | "paid" | "preference") {
    const response = await fetch("/api/subscriptions/view", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessCode || location.hash.slice(1)}`,
      },
      body: JSON.stringify({ cycleId: cycle.id, action, months }),
      referrerPolicy: "no-referrer",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Please try again.");
    return result;
  }
  return (
    <div className="plan-upi-payment">
      <CoverageCards
        cycle={cycle}
        value={months}
        creditMinor={creditMinor}
        disabled={busy || reported || !!cycle.reportedAt}
        onChange={(value) => {
          setMonths(value);
          setOpenedAt(0);
          setSeconds(0);
          setStatus("");
        }}
      />
      <p className="plan-coverage-dates">
        {displayDate(quote.startDate)} – {displayDate(quote.endDate)}
      </p>
      <p className="plan-coverage-price">
        {money(quote.amountMinor, cycle.currency)}{" "}
        <small>at the current rate, after recorded payments</small>
      </p>
      <button
        disabled={busy || reported || !!cycle.reportedAt}
        onClick={async () => {
          setBusy(true);
          try {
            await send("preference");
            setStatus("Preference sent to your manager for approval.");
            onReported();
          } catch (error) {
            setStatus((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {cycle.coverage?.approvedMonths === months || preferredMonths === months
          ? "Preference approved"
          : "Request this schedule"}
      </button>
      {cycle.coverage?.requestedAt &&
        cycle.coverage.approvedMonths !== months && (
          <small>Schedule request awaiting approval</small>
        )}
      <a
        className="plan-button"
        href={payment?.href}
        aria-disabled={!payment || busy}
        onClick={async (e) => {
          e.preventDefault();
          if (busy || !payment) return;
          setBusy(true);
          setStatus("");
          window.open(payment.href, "_blank", "noopener,noreferrer");
          try {
            await send("opened");
            setOpenedAt(Date.now());
            setSeconds(10);
          } catch (error) {
            setStatus((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {payment
          ? `Pay ${money(quote.amountMinor, cycle.currency)} with UPI`
          : quote.amountMinor === 0
            ? "Selected coverage already paid"
            : "Payment details not set"}
      </a>
      <button
        className="plan-report-paid"
        disabled={
          busy || reported || !!cycle.reportedAt || !openedAt || seconds > 0
        }
        onClick={async () => {
          setBusy(true);
          try {
            await send("paid");
            setReported(true);
            setStatus("Sent to your manager for confirmation.");
            onReported();
          } catch (error) {
            setStatus((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {reported || cycle.reportedAt
          ? "Reported paid · awaiting confirmation"
          : seconds > 0
            ? `I’ve paid · ${seconds}s`
            : "I’ve paid"}
      </button>
      <p className="plan-payee">
        {payment?.upiId}{" "}
        <button
          onClick={async () => {
            try {
              if (!payment) return;
              await navigator.clipboard.writeText(payment.upiId);
              setStatus("UPI ID copied.");
            } catch {
              setStatus("Select and copy the UPI ID above.");
            }
          }}
        >
          Copy UPI ID
        </button>
      </p>
      <small>
        Pay upfront or request approval. Extra payment becomes advance credit
        after your manager confirms receipt.
      </small>
      <span role="status">{status}</span>
    </div>
  );
}
export function SubscriptionViewer({
  accessCode,
}: { accessCode?: string } = {}) {
  const [view, setView] = useState<View | null>(null),
    [message, setMessage] = useState("Opening your personal plan…"),
    [busy, setBusy] = useState(false),
    [updated, setUpdated] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "history">(
    "overview",
  );
  async function refresh() {
    const token = accessCode || location.hash.slice(1);
    if (!/^(?:[A-Za-z0-9_-]{22}|[A-Za-z0-9_-]{43})$/.test(token)) {
      setView(null);
      setMessage(
        "This personal link is missing or incomplete. Ask your plan manager for a new link.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/subscriptions/view", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
        referrerPolicy: "no-referrer",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ||
            "This link is unavailable. Ask your plan manager for a new link.",
        );
      setView(data);
      setMessage("");
      setUpdated(
        new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        }).format(new Date()) + " IST",
      );
    } catch (e) {
      setView(null);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    window.addEventListener("hashchange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("hashchange", refresh);
    };
  }, [accessCode]);
  const cycles = view
    ? [...view.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate))
    : [];
  const latest = cycles[0];
  return (
    <main className="plan-app plan-viewer">
      <header className="plan-header">
        <span className="plan-brand">
          Shared<span>plan.</span>
        </span>
        <span className="plan-label">YOUR MEMBERSHIP</span>
      </header>
      <p className="plan-status" role="status">
        {message}
      </p>
      {!view ? (
        <section className="plan-box plan-empty">
          <h1>Your shared plan</h1>
          <p>
            Use the complete personal link your manager sent you. No account is
            needed to view it.
          </p>
          <button disabled={busy} onClick={() => void refresh()}>
            {busy ? "Loading…" : "Try again"}
          </button>
        </section>
      ) : (
        <>
          <div className="plan-title">
            <div>
              <p className="plan-label">
                HELLO, {view.member.name.toUpperCase()}
              </p>
              <h1>{view.plan.name}</h1>
              <p>Your subscription, simply.</p>
            </div>
            <button disabled={busy} onClick={() => void refresh()}>
              {busy ? "Refreshing…" : "Refresh status"}
            </button>
          </div>
          <div className="plan-member-meta">
            <span>{view.plan.interval} plan</span>
            <span>
              {view.member.joinedDate
                ? `Member since ${displayDate(view.member.joinedDate)}`
                : cycles.length
                  ? `Records from ${displayDate(cycles.at(-1)!.startDate, true)}`
                  : "No billing records yet"}
            </span>
          </div>
          <nav className="plan-view-tabs" aria-label="Your subscription">
            <button
              aria-pressed={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              aria-pressed={activeTab === "history"}
              onClick={() => setActiveTab("history")}
            >
              History
            </button>
          </nav>
          <div hidden={activeTab !== "overview"}>
            {view.groupMembers && <GroupMembers members={view.groupMembers} />}
            {cycles.some(
              (c) => c.id !== latest?.id && paid(c) < c.amountMinor,
            ) && (
              <button
                className="plan-older-balance"
                onClick={() => setActiveTab("history")}
              >
                Earlier balance outstanding · View history →
              </button>
            )}
            {latest ? (
              <section className="plan-personal-summary plan-simple-summary">
                <span className="plan-label">
                  {displayDate(latest.startDate, true)}
                </span>
                <span className="plan-label">AMOUNT DUE</span>
                <strong>
                  {money(latest.amountMinor - paid(latest), latest.currency)}
                </strong>
                <span>
                  {paid(latest) === latest.amountMinor
                    ? "Paid in full"
                    : countdown(latest.dueDate)}
                </span>
                <p>
                  {displayDate(latest.startDate)} –{" "}
                  {displayDate(latest.renewalDate)}
                </p>
              </section>
            ) : (
              <div className="plan-box plan-empty">
                <h2>No bill yet.</h2>
                <p>
                  Your manager will open the first billing cycle when it’s time.
                </p>
              </div>
            )}
            {(view.credits || []).some((c) => c.remainingMinor > 0) && (
              <section className="plan-box plan-credit">
                <h2>Advance credit</h2>
                {(view.credits || [])
                  .filter((c) => c.remainingMinor > 0)
                  .map((c) => (
                    <p key={c.id}>
                      {money(c.remainingMinor, c.currency)} available · received{" "}
                      {displayDate(c.date)}
                    </p>
                  ))}
              </section>
            )}
            {latest && (
              <p className="plan-renewal-line">
                Renews {displayDate(latest.renewalDate)} · Your share{" "}
                {money(latest.amountMinor, latest.currency)}
              </p>
            )}
            {latest && (
              <section className="plan-box">
                <h2>Payment options</h2>
                <PaymentLink
                  key={latest.id}
                  cycle={latest}
                  plan={view.plan}
                  preferredMonths={view.member.preferredMonths}
                  creditMinor={(view.credits || [])
                    .filter(
                      (c) =>
                        c.currency === latest.currency &&
                        c.startDate <= latest.startDate,
                    )
                    .reduce((sum, c) => sum + c.remainingMinor, 0)}
                  accessCode={accessCode}
                  onReported={() => void refresh()}
                />
              </section>
            )}
          </div>
          {activeTab === "history" && (
            <PaymentActivity
              joinedDate={view.member.joinedDate}
              events={[
                ...cycles.flatMap((c) =>
                  c.payments.map((p) => ({ ...p, currency: c.currency })),
                ),
                ...(view.credits || []).map((c) => ({
                  date: c.date,
                  amountMinor: c.amountMinor,
                  currency: c.currency,
                })),
              ]}
            />
          )}
          <div
            className="plan-history-panel plan-receipts"
            hidden={activeTab !== "history"}
          >
            <section className="plan-box">
              <h2>Payment history</h2>
              <p>
                Earlier unpaid balances stay visible here. Each bill is tracked
                separately.
              </p>
              {(view.credits || []).map((c) => (
                <article className="plan-member-cycle" key={c.id}>
                  <h3>Advance payment received</h3>
                  <strong>{money(c.amountMinor, c.currency)}</strong>
                  <p>
                    {displayDate(c.date)} ·{" "}
                    {money(c.remainingMinor, c.currency)} credit remaining
                  </p>
                  <p>
                    Selected coverage: {displayDate(c.startDate)} –{" "}
                    {displayDate(c.endDate)}
                  </p>
                </article>
              ))}
              {cycles.map((cycle) => (
                <article className="plan-member-cycle" key={cycle.id}>
                  <div className="plan-section-head">
                    <div>
                      <h3>{displayDate(cycle.startDate, true)}</h3>
                      <p>
                        {displayDate(cycle.startDate)} –{" "}
                        {displayDate(cycle.renewalDate)}
                      </p>
                      <p>
                        {paid(cycle) === cycle.amountMinor
                          ? "Settled"
                          : countdown(cycle.dueDate)}{" "}
                        · Pay by {cycle.dueDate}
                      </p>
                    </div>
                    <strong>
                      {money(cycle.amountMinor - paid(cycle), cycle.currency)}{" "}
                      due
                    </strong>
                  </div>
                  <div className="plan-mini-totals">
                    <span>
                      Your share{" "}
                      <b>{money(cycle.amountMinor, cycle.currency)}</b>
                    </span>
                    <span>
                      Received <b>{money(paid(cycle), cycle.currency)}</b>
                    </span>
                  </div>
                  {cycle.payments.length > 0 && (
                    <details>
                      <summary>Payments received</summary>
                      <ul>
                        {cycle.payments.map((p, i) => (
                          <li key={i}>
                            {displayDate(p.date)} ·{" "}
                            {money(p.amountMinor, cycle.currency)}
                            {p.sourceCreditId
                              ? " · Advance credit applied"
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {cycle.id !== latest?.id && (
                    <PaymentLink
                      key={cycle.id}
                      cycle={cycle}
                      plan={view.plan}
                      preferredMonths={view.member.preferredMonths}
                      creditMinor={(view.credits || [])
                        .filter(
                          (c) =>
                            c.currency === cycle.currency &&
                            c.startDate <= cycle.startDate,
                        )
                        .reduce((sum, c) => sum + c.remainingMinor, 0)}
                      accessCode={accessCode}
                      onReported={() => void refresh()}
                    />
                  )}
                  {paid(cycle) < cycle.amountMinor && (
                    <button onClick={() => calendar(cycle, view.plan.name)}>
                      Download payment calendar date
                    </button>
                  )}
                </article>
              ))}
            </section>
          </div>
          <p className="plan-fine-print">
            Updated {updated} · All dates in IST
          </p>
        </>
      )}
      <footer className="plan-footer">
        Your private subscription statement.
      </footer>
    </main>
  );
}
