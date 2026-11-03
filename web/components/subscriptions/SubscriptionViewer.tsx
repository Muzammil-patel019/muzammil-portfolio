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
  payments: { amountMinor: number; date: string }[];
};
type View = {
  plan: { name: string; paymentNote: string; interval: string };
  member: { id: string; name: string };
  cycles: MemberCycle[];
};
const paid = (cycle: MemberCycle) =>
  cycle.payments.reduce((sum, p) => sum + p.amountMinor, 0);
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
function PaymentLink({ cycle, name }: { cycle: MemberCycle; name: string }) {
  const payment = subscriptionUpiPayment(name, cycle);
  const [copied, setCopied] = useState("");
  if (!payment) return null;
  return (
    <div className="plan-upi-payment">
      <a className="plan-button" href={payment.href}>
        Pay {money(cycle.amountMinor - paid(cycle), cycle.currency)} with UPI
      </a>
      <p>
        Choose PhonePe if your phone asks which app to open. Check the recipient
        name in the app before approving.
      </p>
      <p>
        <strong>UPI ID:</strong> {payment.upiId}
        <br />
        <strong>Payment note:</strong> {payment.note}
      </p>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(payment.upiId);
            setCopied("UPI ID copied.");
          } catch {
            setCopied("Select and copy the UPI ID shown above.");
          }
        }}
      >
        Copy UPI ID
      </button>
      <span role="status">{copied}</span>
      <p>
        On a computer or if the app doesn’t open, pay this UPI ID in PhonePe
        using the amount and note above. Your manager will confirm receipt and
        update your balance.
      </p>
    </div>
  );
}
export function SubscriptionViewer() {
  const [view, setView] = useState<View | null>(null),
    [message, setMessage] = useState("Opening your personal plan…"),
    [busy, setBusy] = useState(false),
    [updated, setUpdated] = useState("");
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
        <span className="plan-label">PERSONAL VIEW · READ ONLY</span>
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
              <p>Your share, dates, and payments — all in one place.</p>
            </div>
            <button disabled={busy} onClick={() => void refresh()}>
              {busy ? "Refreshing…" : "Refresh status"}
            </button>
          </div>
          {latest ? (
            <section className="plan-personal-summary">
              <div>
                <span className="plan-label">YOUR LATEST SHARE</span>
                <strong>{money(latest.amountMinor, latest.currency)}</strong>
                <p>
                  {latest.startDate} to {latest.renewalDate}
                </p>
              </div>
              <div>
                <span className="plan-label">REMAINING TO PAY</span>
                <strong>
                  {money(latest.amountMinor - paid(latest), latest.currency)}
                </strong>
                <span
                  className={`plan-badge ${paid(latest) === latest.amountMinor ? "settled" : ""}`}
                >
                  {paid(latest) === latest.amountMinor
                    ? "You’re settled"
                    : countdown(latest.dueDate)}
                </span>
              </div>
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
            <div className="plan-date-strip">
              <div>
                <span>Payment due</span>
                <strong>{latest.dueDate}</strong>
              </div>
              <div>
                <span>Subscription renews</span>
                <strong>{latest.renewalDate}</strong>
              </div>
              <div>
                <span>Days until this renewal</span>
                <strong>{Math.max(0, daysUntil(latest.renewalDate))}</strong>
              </div>
            </div>
          )}
          {latest && subscriptionUpiPayment(view.plan.name, latest) && (
            <section className="plan-box">
              <h2>Pay your share</h2>
              <PaymentLink cycle={latest} name={view.plan.name} />
            </section>
          )}
          {view.plan.paymentNote && (
            <section className="plan-box">
              <h2>How to pay</h2>
              <p className="plan-note">{view.plan.paymentNote}</p>
              <small>
                Send payment outside this site, then let your manager know.
                They’ll update the record here.
              </small>
            </section>
          )}
          <section className="plan-box">
            <h2>Your billing history</h2>
            <p>
              Earlier unpaid balances stay visible here. Each bill is tracked
              separately.
            </p>
            {cycles.map((cycle) => (
              <article className="plan-member-cycle" key={cycle.id}>
                <div className="plan-section-head">
                  <div>
                    <h3>
                      {cycle.startDate} — {cycle.renewalDate}
                    </h3>
                    <p>
                      {paid(cycle) === cycle.amountMinor
                        ? "Settled"
                        : countdown(cycle.dueDate)}{" "}
                      · Pay by {cycle.dueDate}
                    </p>
                  </div>
                  <strong>
                    {money(cycle.amountMinor - paid(cycle), cycle.currency)} due
                  </strong>
                </div>
                <div className="plan-mini-totals">
                  <span>
                    Your share <b>{money(cycle.amountMinor, cycle.currency)}</b>
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
                          {p.date} · {money(p.amountMinor, cycle.currency)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <PaymentLink cycle={cycle} name={view.plan.name} />
                {paid(cycle) < cycle.amountMinor && (
                  <button onClick={() => calendar(cycle, view.plan.name)}>
                    Download payment calendar date
                  </button>
                )}
              </article>
            ))}
          </section>
          <p className="plan-fine-print">
            Updated {updated}. Checks for updates every minute. Dates use India
            time (IST). Calendar files add an event; reminder settings belong to
            your calendar app.
          </p>
        </>
      )}
      <footer className="plan-footer">
        Only your manager can change payments or member details. Keep this
        personal link private.
      </footer>
    </main>
  );
}
