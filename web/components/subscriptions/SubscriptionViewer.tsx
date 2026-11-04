"use client";
import { useEffect, useState } from "react";
import { daysUntil, money } from "@/lib/subscriptions";
import { subscriptionUpiPayment } from "@/lib/subscription-upi";
type MemberCycle = {
  id: string;
  startDate: string;
  dueDate: string;
  renewalDate: string;
  currency: "INR" | "USD" | "EUR" | "GBP";
  amountMinor: number;
  reportedAt?: string;
  payments: { amountMinor: number; date: string }[];
};
type View = {
  plan: {
    name: string;
    paymentNote: string;
    interval: string;
    upiId?: string;
    payeeName?: string;
  };
  member: { id: string; name: string; joinedDate?: string };
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
}: {
  cycle: MemberCycle;
  plan: View["plan"];
  onReported: () => void;
}) {
  const payment = subscriptionUpiPayment(plan.name, cycle, plan);
  const [openedAt, setOpenedAt] = useState(0),
    [seconds, setSeconds] = useState(0),
    [reported, setReported] = useState(!!cycle.reportedAt),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    if (!openedAt) return;
    const tick = () =>
      setSeconds(Math.max(0, 10 - Math.floor((Date.now() - openedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [openedAt]);
  async function send(action: "opened" | "paid") {
    const response = await fetch("/api/subscriptions/view", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${location.hash.slice(1)}`,
      },
      body: JSON.stringify({ cycleId: cycle.id, action }),
      referrerPolicy: "no-referrer",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Please try again.");
    return result;
  }
  if (!payment) return <p>Payment details will be added by your manager.</p>;
  return (
    <div className="plan-upi-payment">
      <a
        className="plan-button"
        href={payment.href}
        onClick={async (e) => {
          e.preventDefault();
          if (busy) return;
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
        Pay {money(cycle.amountMinor - paid(cycle), cycle.currency)} with UPI
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
        {payment.upiId}{" "}
        <button
          onClick={async () => {
            try {
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
        Report after completing the payment. Your manager confirms receipt.
      </small>
      <span role="status">{status}</span>
    </div>
  );
}
export function SubscriptionViewer() {
  const [view, setView] = useState<View | null>(null),
    [message, setMessage] = useState("Opening your personal plan…"),
    [busy, setBusy] = useState(false),
    [updated, setUpdated] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "history">(
    "overview",
  );
  async function refresh() {
    const token = location.hash.slice(1);
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
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
  }, []);
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
            {latest && (
              <p className="plan-renewal-line">
                Renews {displayDate(latest.renewalDate)} · Your share{" "}
                {money(latest.amountMinor, latest.currency)}
              </p>
            )}
            {latest &&
              subscriptionUpiPayment(view.plan.name, latest, view.plan) && (
                <section className="plan-box">
                  <h2>Pay your share</h2>
                  <PaymentLink
                    key={latest.id}
                    cycle={latest}
                    plan={view.plan}
                    onReported={() => void refresh()}
                  />
                </section>
              )}
          </div>
          {cycles.length > 0 && activeTab === "history" && (
            <section className="plan-box plan-chart">
              <div className="plan-section-head">
                <div>
                  <p className="plan-label">YOUR JOURNEY</p>
                  <h2>Payment timeline</h2>
                </div>
                <span>
                  {cycles.filter((c) => paid(c) === c.amountMinor).length} /{" "}
                  {cycles.length} periods paid
                </span>
              </div>
              <div className="plan-chart-bars">
                {[...cycles].reverse().map((c) => (
                  <div className="plan-chart-period" key={c.id}>
                    <span className="plan-chart-track">
                      <span
                        style={{
                          height: `${c.amountMinor ? Math.min(100, (paid(c) / c.amountMinor) * 100) : 100}%`,
                        }}
                      />
                    </span>
                    <strong>{displayDate(c.startDate, true)}</strong>
                    <meter
                      min={0}
                      max={Math.max(1, c.amountMinor)}
                      value={paid(c)}
                      aria-label={`Paid for ${displayDate(c.startDate, true)}`}
                    />
                    <small>
                      {money(paid(c), c.currency)} /{" "}
                      {money(c.amountMinor, c.currency)}
                    </small>
                  </div>
                ))}
              </div>
            </section>
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
