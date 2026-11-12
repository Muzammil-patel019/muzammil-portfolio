"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ZodError } from "zod";
import { useSearchParams } from "next/navigation";
import { browserClient } from "@/lib/supabase";
import { daysUntil, todayIST } from "@/lib/subscriptions";
import {
  parseCardMoney as parseMoney,
  expectedCardStatement,
  cardPaymentLog,
  cardPaymentsCSV,
  cardSchema,
  cardsDocumentSchema,
  emptyCards,
  cardMoney,
  cardDate,
  cardSchedule,
  suggestedDue,
  latestCardBill,
  statementPaid,
  statementBalance,
  recordCardPayment,
  cardsCSV,
  downloadCards,
  cardCalendar,
  type Card,
  type CardStatement,
  type CardsDocument,
} from "@/lib/cards";
const copy = <T,>(v: T): T => structuredClone(v);
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
function dueText(bill: CardStatement) {
  const days = daysUntil(bill.dueDate);
  return statementBalance(bill) === 0
    ? "Paid in full"
    : days < 0
      ? `${Math.abs(days)} days overdue`
      : days === 0
        ? "Due today"
        : `Due in ${days} ${days === 1 ? "day" : "days"}`;
}
export function CardsManager() {
  const initialCard = useSearchParams().get("cardId");
  const demo = useSearchParams().get("demo") === "1",
    db = useMemo(() => browserClient(), []);
  const [auth, setAuth] = useState<"checking" | "signedout" | "signedin">(
    demo ? "signedin" : "checking",
  );
  const [doc, setDoc] = useState<CardsDocument>(emptyCards),
    [revision, setRevision] = useState(0),
    [loaded, setLoaded] = useState(demo),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [conflict, setConflict] = useState(false);
  const [selected, setSelected] = useState(""),
    [view, setView] = useState<"overview" | "history" | "archived">("overview"),
    [query, setQuery] = useState("");
  const [walletFilter, setWalletFilter] = useState("all");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"full" | "minimum" | "custom">(
    "custom",
  );
  const [historyMode, setHistoryMode] = useState<"bills" | "payments">("bills");
  const [historyMonth, setHistoryMonth] = useState("");
  const [receipt, setReceipt] = useState<{
    card: string;
    last4: string;
    amount: number;
    date: string;
    remaining: number;
  } | null>(null);
  const [form, setForm] = useState<"card" | "statement" | "payment" | null>(
      null,
    ),
    [editCard, setEditCard] = useState<Card | null>(null),
    [editBill, setEditBill] = useState<CardStatement | null>(null),
    [paymentBill, setPaymentBill] = useState("");
  useEffect(() => {
    if (!form) return;
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(".cards-form-panel");
      panel?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      panel
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [form, editCard?.id, editBill?.id, paymentBill]);
  const authGeneration = useRef(0);
  const currentUser = useRef<string | null>(null);
  async function api(method = "GET", body?: unknown) {
    const { data } = await db!.auth.getSession();
    if (!data.session) throw new Error("Sign in again to access Cards.");
    const r = await fetch("/api/cards", {
      method,
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await r.json();
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) {
        authGeneration.current++;
        setDoc(emptyCards());
        setForm(null);
        setLoaded(false);
        setAuth("signedout");
        setReceipt(null);
      }
      if (r.status === 409) setConflict(true);
      throw new Error(result.error || "Could not save. Please try again.");
    }
    return result;
  }
  async function load() {
    const generation = authGeneration.current;
    setBusy(true);
    setMessage("");
    try {
      const result = await api();
      if (generation !== authGeneration.current) return;
      const value = result
        ? cardsDocumentSchema.parse(result.document)
        : emptyCards();
      setDoc(value);
      setRevision(result?.revision || 0);
      setLoaded(true);
      setConflict(false);
      setForm(null);
      setSelected(
        value.cards.find((c) => c.id === initialCard)?.id ||
          value.cards.find((c) => !c.archived)?.id ||
          value.cards[0]?.id ||
          "",
      );
    } catch (e) {
      if (generation === authGeneration.current)
        setMessage(
          e instanceof ZodError
            ? e.issues[0]?.message || "Check the entered details."
            : (e as Error).message,
        );
    } finally {
      if (generation === authGeneration.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (demo) return;
    if (!db) {
      setAuth("signedout");
      setReceipt(null);
      return;
    }
    let active = true;
    const { data } = db.auth.onAuthStateChange((event, session) => {
      const id = session?.user.id || null;
      if (id === currentUser.current && event !== "INITIAL_SESSION") return;
      currentUser.current = id;
      authGeneration.current++;
      setReceipt(null);
      setAuth(id ? "signedin" : "signedout");
      setDoc(emptyCards());
      setForm(null);
      setSelected("");
      setLoaded(false);
      setRevision(0);
      setBusy(false);
      setConflict(false);
      if (id)
        setTimeout(() => {
          if (active && currentUser.current === id) void load();
        }, 0);
    });
    return () => {
      active = false;
      authGeneration.current++;
      data.subscription.unsubscribe();
    };
  }, [db, demo]);
  async function save(next: CardsDocument) {
    const generation = authGeneration.current;
    const value = cardsDocumentSchema.parse(next);
    if (!demo) {
      const result = await api("POST", { document: value, revision });
      if (generation !== authGeneration.current)
        throw new Error("Your session changed. Sign in again.");
      setRevision(result.revision);
    }
    setDoc(value);
    setMessage(
      demo ? "Updated in this demo session only." : "Saved privately.",
    );
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
  const activeCards = doc.cards.filter((c) => !c.archived);
  const latestBills = activeCards
    .map((c) => ({ card: c, bill: latestCardBill(doc, c.id) }))
    .filter((x): x is { card: Card; bill: CardStatement } => !!x.bill);
  const dueBills = latestBills
    .filter((x) => statementBalance(x.bill) > 0)
    .sort((a, b) => a.bill.dueDate.localeCompare(b.bill.dueDate));
  const totalLimit = activeCards.reduce((n, c) => n + c.limitMinor, 0),
    totalBalance = latestBills.reduce(
      (n, x) => n + statementBalance(x.bill),
      0,
    );
  const paymentLog = cardPaymentLog(doc);
  const filteredPayments = paymentLog.filter(
    (p) =>
      (!selected || p.cardId === selected) &&
      (!historyMonth || p.date.startsWith(historyMonth)),
  );
  const monthOptions = [...new Set(paymentLog.map((p) => p.date.slice(0, 7)))]
    .sort()
    .reverse();
  const paidThisMonth = paymentLog
    .filter((p) => p.date.startsWith(todayIST().slice(0, 7)))
    .reduce((n, p) => n + p.amountMinor, 0);
  const overdue = dueBills.filter((x) => daysUntil(x.bill.dueDate) < 0);
  const dueSoon = dueBills.filter(
    (x) => daysUntil(x.bill.dueDate) >= 0 && daysUntil(x.bill.dueDate) <= 7,
  );
  const statementChecks = activeCards.filter((c) => {
    const bill = latestCardBill(doc, c.id);
    return !bill || bill.date < expectedCardStatement(c);
  });
  function matchesWallet(card: Card) {
    const bill = latestCardBill(doc, card.id);
    return (
      walletFilter === "all" ||
      (walletFilter === "no-bill"
        ? !bill
        : !!bill &&
          (walletFilter === "settled"
            ? statementBalance(bill) === 0
            : walletFilter === "overdue"
              ? statementBalance(bill) > 0 && daysUntil(bill.dueDate) < 0
              : walletFilter === "soon"
                ? statementBalance(bill) > 0 &&
                  daysUntil(bill.dueDate) >= 0 &&
                  daysUntil(bill.dueDate) <= 7
                : statementBalance(bill) > 0))
    );
  }
  const visibleCards = doc.cards.filter(
    (c) =>
      (view === "archived" ? c.archived : !c.archived) &&
      matchesWallet(c) &&
      `${c.name} ${c.issuer} ${c.last4}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const chosen =
    view === "history"
      ? doc.cards.find((c) => c.id === selected) || doc.cards[0]
      : visibleCards.find((c) => c.id === selected) || visibleCards[0];
  const latest = chosen ? latestCardBill(doc, chosen.id) : undefined;
  const bills = doc.statements
    .filter((s) => !selected || s.cardId === selected)
    .sort((a, b) => b.date.localeCompare(a.date));
  const billForPayment = doc.statements.find((b) => b.id === paymentBill);
  const locked = busy || conflict;
  function beginPayment(
    bill: CardStatement,
    mode: "full" | "minimum" | "custom" = "custom",
  ) {
    setSelected(bill.cardId);
    setPaymentBill(bill.id);
    setPaymentMode(mode);
    setPaymentAmount(
      (
        (mode === "minimum"
          ? Math.max(0, bill.minimumMinor - statementPaid(bill))
          : statementBalance(bill)) / 100
      ).toFixed(2),
    );
    setForm("payment");
    setMessage("");
    setReceipt(null);
  }
  function beginCard(card: Card | null = null) {
    setReceipt(null);
    setEditCard(card);
    setForm("card");
    setMessage("");
  }
  function beginBill(bill: CardStatement | null = null) {
    setReceipt(null);
    setWalletFilter("all");
    setQuery("");
    setEditBill(bill);
    setForm("statement");
    setMessage("");
  }
  if (auth === "checking")
    return (
      <main className="cards-app">
        <p role="status">Checking your sign-in…</p>
      </main>
    );
  if (auth === "signedout")
    return (
      <main className="cards-app cards-entry">
        <p className="cards-kicker">YOUR PRIVATE FINANCE SPACE</p>
        <h1>
          Every card.
          <br />
          One clear view.
        </h1>
        <p>
          Keep your limits, statement dates, bills and payment history together.
        </p>
        <a className="cards-button" href="/login?next=cards">
          Sign in to Cards
        </a>
        <a className="cards-secondary-link" href="/cards?demo=1">
          Explore a session-only demo →
        </a>
        <p className="cards-note">
          Use your existing owner login. Only the last four card digits are
          stored.
        </p>
      </main>
    );
  return (
    <main className="cards-app">
      <header className="cards-header">
        <a href="/cards" className="cards-brand">
          Cards<span>.</span>
        </a>
        <div>
          <span className="cards-kicker">
            {demo ? "DEMO · NOT SAVED" : "PRIVATE WORKSPACE"}
          </span>
          {!demo && (
            <button onClick={() => void db?.auth.signOut()}>Sign out</button>
          )}
        </div>
      </header>
      <nav className="cards-private-nav" aria-label="Private tools">
        <a href={demo ? "/organizer?demo=1" : "/organizer"}>Organizer</a>
        <a href={demo ? "/dashboard?demo=1" : "/dashboard"}>Dashboard</a>
        <a href="/subscriptions">Shared Plan</a>
        <a href="/cards" aria-current="page">
          Cards
        </a>
        <a href="/admin">Resume studio</a>
        <a href="/learning">Learning</a>
      </nav>
      <div className="cards-title">
        <div>
          <p className="cards-kicker">LESS GUESSWORK. MORE CLARITY.</p>
          <h1>Your cards, in order.</h1>
          <p>Know what’s billed, what’s paid and what comes next.</p>
        </div>
        <button
          className="cards-button"
          disabled={locked || !loaded}
          onClick={() => beginCard()}
        >
          + Add card
        </button>
      </div>
      {demo && (
        <p className="cards-notice">
          Demo mode. Nothing is saved online. Refreshing clears this session.
          Use sample details only.
        </p>
      )}
      <p className="cards-status" role="status">
        {message}
      </p>
      {conflict && (
        <p className="cards-notice">
          A newer version exists. Your current form stays here until you reload.
        </p>
      )}
      {(!loaded || conflict) && (
        <button disabled={busy} onClick={() => void load()}>
          Reload saved tracker
        </button>
      )}
      {loaded && (
        <>
          <section className="cards-metrics" aria-label="Cards summary">
            <div>
              <span>Active cards</span>
              <strong>{activeCards.length}</strong>
              <small>Amounts in INR</small>
            </div>
            <div>
              <span>Combined limits</span>
              <strong>{cardMoney(totalLimit)}</strong>
              <small>Individual card limits</small>
            </div>
            <div>
              <span>Latest bill balances</span>
              <strong>{cardMoney(totalBalance)}</strong>
              <small>After your recorded payments</small>
            </div>
            <div>
              <span>Next payment due</span>
              <strong>
                {dueBills[0] ? cardDate(dueBills[0].bill.dueDate) : "All clear"}
              </strong>
              <small>
                {dueBills[0]
                  ? `${dueBills[0].card.name} • ${dueBills[0].card.last4}`
                  : "No unpaid latest statements"}
              </small>
            </div>
          </section>
          {receipt && (
            <section className="cards-receipt" aria-label="Payment recorded">
              <span aria-hidden="true">✓</span>
              <div>
                <p className="cards-kicker">PAYMENT RECORDED</p>
                <h2>
                  {receipt.remaining === 0
                    ? "This bill is paid in full."
                    : "Payment added to your history."}
                </h2>
                <p>
                  {receipt.card} • {receipt.last4} · {cardMoney(receipt.amount)}{" "}
                  · {cardDate(receipt.date)}
                </p>
                <small>
                  {receipt.remaining === 0
                    ? "No remaining balance on this statement."
                    : `${cardMoney(receipt.remaining)} still outstanding.`}
                </small>
              </div>
              <button onClick={() => setReceipt(null)}>Dismiss receipt</button>
            </section>
          )}
          {activeCards.length > 0 && (
            <section className="cards-attention" aria-label="Bill attention">
              <button
                onClick={() => {
                  setView("overview");
                  setWalletFilter("overdue");
                }}
              >
                <strong>{overdue.length}</strong>
                <span>Overdue</span>
              </button>
              <button
                onClick={() => {
                  setView("overview");
                  setWalletFilter("soon");
                }}
              >
                <strong>{dueSoon.length}</strong>
                <span>Due within 7 days</span>
              </button>
              <div>
                <strong>{cardMoney(paidThisMonth)}</strong>
                <span>Payments recorded this month</span>
              </div>
            </section>
          )}
          <nav className="cards-view-tabs" aria-label="Cards sections">
            {(["overview", "history", "archived"] as const).map((tab) => (
              <button
                key={tab}
                aria-pressed={view === tab}
                onClick={() => {
                  setView(tab);
                  setForm(null);
                }}
              >
                {tab === "overview"
                  ? "Overview"
                  : tab === "history"
                    ? "History"
                    : "Archived"}
              </button>
            ))}
          </nav>
          {form === "card" && (
            <section className="cards-panel cards-form-panel">
              <div className="cards-section-head">
                <h2>{editCard ? "Edit card" : "Add a card"}</h2>
                <button onClick={() => setForm(null)} disabled={busy}>
                  Close
                </button>
              </div>
              <p className="cards-note">
                Enter only the last four digits. No full number, expiry date,
                CVV or PIN.
              </p>
              <form
                key={editCard?.id || "new"}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(async () => {
                    const card = cardSchema.parse({
                      id: editCard?.id || crypto.randomUUID(),
                      name: f.get("name"),
                      issuer: f.get("issuer"),
                      last4: f.get("last4"),
                      network: f.get("network"),
                      limitMinor: parseMoney(String(f.get("limit"))),
                      annualFeeMinor: parseMoney(String(f.get("fee") || "0")),
                      statementDay: Number(f.get("statementDay")),
                      dueDay: Number(f.get("dueDay")),
                      archived: editCard?.archived || false,
                    });
                    const next = copy(doc);
                    if (editCard)
                      next.cards = next.cards.map((c) =>
                        c.id === card.id ? card : c,
                      );
                    else next.cards.push(card);
                    await save(next);
                    setSelected(card.id);
                    setForm(null);
                  });
                }}
              >
                <div className="cards-fields">
                  <Field label="Card nickname">
                    <input
                      name="name"
                      required
                      maxLength={60}
                      placeholder="Everyday card"
                      defaultValue={editCard?.name}
                    />
                  </Field>
                  <Field label="Bank / issuer">
                    <input
                      name="issuer"
                      required
                      maxLength={60}
                      placeholder="Your bank"
                      defaultValue={editCard?.issuer}
                    />
                  </Field>
                  <Field label="Last four digits">
                    <input
                      name="last4"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      minLength={4}
                      maxLength={4}
                      required
                      autoComplete="off"
                      placeholder="1234"
                      defaultValue={editCard?.last4}
                    />
                  </Field>
                  <Field label="Network">
                    <select
                      name="network"
                      defaultValue={editCard?.network || "Visa"}
                    >
                      {["Visa", "Mastercard", "RuPay", "Amex", "Other"].map(
                        (n) => (
                          <option key={n}>{n}</option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="Credit limit (INR)">
                    <input
                      name="limit"
                      inputMode="decimal"
                      required
                      defaultValue={
                        editCard ? (editCard.limitMinor / 100).toFixed(2) : ""
                      }
                      placeholder="100000"
                    />
                  </Field>
                  <Field label="Annual fee (INR, optional)">
                    <input
                      name="fee"
                      inputMode="decimal"
                      defaultValue={
                        editCard
                          ? (editCard.annualFeeMinor / 100).toFixed(2)
                          : "0"
                      }
                    />
                  </Field>
                  <Field label="Statement generation day">
                    <input
                      name="statementDay"
                      type="number"
                      min={1}
                      max={31}
                      required
                      defaultValue={editCard?.statementDay || 10}
                    />
                  </Field>
                  <Field label="Usual payment due day">
                    <input
                      name="dueDay"
                      type="number"
                      min={1}
                      max={31}
                      required
                      defaultValue={editCard?.dueDay || 30}
                    />
                  </Field>
                </div>
                <p className="cards-note">
                  For shorter months, days 29–31 use the last day. Each bill’s
                  actual due date can be entered separately.
                </p>
                <button className="cards-button" disabled={locked}>
                  Save card
                </button>
              </form>
            </section>
          )}
          {form === "statement" && chosen && (
            <section className="cards-panel cards-form-panel">
              <div className="cards-section-head">
                <h2>
                  {editBill ? "Edit statement" : "Record statement"} ·{" "}
                  {chosen.name}
                </h2>
                <button onClick={() => setForm(null)} disabled={busy}>
                  Close
                </button>
              </div>
              <form
                key={editBill?.id || chosen.id + "bill"}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(async () => {
                    const next = copy(doc);
                    const bill = {
                      id: editBill?.id || crypto.randomUUID(),
                      cardId: chosen.id,
                      date: String(f.get("date")),
                      dueDate: String(f.get("dueDate")),
                      totalMinor: parseMoney(String(f.get("total"))),
                      minimumMinor: parseMoney(String(f.get("minimum") || "0")),
                      payments: editBill?.payments || [],
                    };
                    if (bill.date > todayIST())
                      throw new Error(
                        "Record an issued statement, not a future estimate.",
                      );
                    if (editBill)
                      next.statements = next.statements.map((s) =>
                        s.id === bill.id ? bill : s,
                      );
                    else next.statements.push(bill);
                    await save(next);
                    setForm(null);
                  });
                }}
              >
                <div className="cards-fields">
                  <Field label="Statement date">
                    <input
                      type="date"
                      name="date"
                      required
                      max={todayIST()}
                      defaultValue={editBill?.date || todayIST()}
                      onChange={(e) => {
                        const due = e.currentTarget.form?.elements.namedItem(
                          "dueDate",
                        ) as HTMLInputElement | null;
                        if (due && e.target.value)
                          due.value = suggestedDue(chosen, e.target.value);
                      }}
                    />
                  </Field>
                  <Field label="Actual payment due date">
                    <input
                      type="date"
                      name="dueDate"
                      required
                      defaultValue={
                        editBill?.dueDate || suggestedDue(chosen, todayIST())
                      }
                    />
                  </Field>
                  <Field label="Total bill (INR)">
                    <input
                      name="total"
                      inputMode="decimal"
                      required
                      defaultValue={
                        editBill ? (editBill.totalMinor / 100).toFixed(2) : ""
                      }
                    />
                  </Field>
                  <Field label="Minimum due (INR)">
                    <input
                      name="minimum"
                      inputMode="decimal"
                      required
                      defaultValue={
                        editBill
                          ? (editBill.minimumMinor / 100).toFixed(2)
                          : "0"
                      }
                    />
                  </Field>
                </div>
                <p className="cards-note">
                  Copy these amounts from your bank statement. Entering a bill
                  does not make a payment.
                </p>
                <button className="cards-button" disabled={locked}>
                  Save statement
                </button>
              </form>
            </section>
          )}
          {form === "payment" && billForPayment && (
            <section className="cards-panel cards-form-panel">
              <div className="cards-section-head">
                <h2>
                  Record payment ·{" "}
                  {doc.cards.find((c) => c.id === billForPayment.cardId)?.name}
                </h2>
                <button onClick={() => setForm(null)} disabled={busy}>
                  Close
                </button>
              </div>
              <p>
                Statement {cardDate(billForPayment.date)} ·{" "}
                {cardMoney(statementBalance(billForPayment))} remaining
              </p>
              <p className="cards-note">
                Already paid through your bank? Confirm the amount and date
                below. This action only updates your tracker.
              </p>
              <form
                key={billForPayment.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(async () => {
                    await save(
                      recordCardPayment(
                        doc,
                        billForPayment.id,
                        parseMoney(String(f.get("amount"))),
                        String(f.get("date")),
                        String(f.get("note") || ""),
                      ),
                    );
                    const card = doc.cards.find(
                      (c) => c.id === billForPayment.cardId,
                    )!;
                    const amount = parseMoney(String(f.get("amount")));
                    setReceipt({
                      card: card.name,
                      last4: card.last4,
                      amount,
                      date: String(f.get("date")),
                      remaining: statementBalance(billForPayment) - amount,
                    });
                    setForm(null);
                  });
                }}
              >
                <div
                  className="cards-payment-presets"
                  aria-label="Payment amount shortcuts"
                >
                  <button
                    type="button"
                    aria-pressed={paymentMode === "full"}
                    onClick={() => {
                      setPaymentMode("full");
                      setPaymentAmount(
                        (statementBalance(billForPayment) / 100).toFixed(2),
                      );
                    }}
                  >
                    Full balance{" "}
                    <strong>
                      {cardMoney(statementBalance(billForPayment))}
                    </strong>
                  </button>
                  <button
                    type="button"
                    disabled={
                      billForPayment.minimumMinor <=
                      statementPaid(billForPayment)
                    }
                    aria-pressed={paymentMode === "minimum"}
                    onClick={() => {
                      setPaymentMode("minimum");
                      setPaymentAmount(
                        (
                          Math.max(
                            0,
                            billForPayment.minimumMinor -
                              statementPaid(billForPayment),
                          ) / 100
                        ).toFixed(2),
                      );
                    }}
                  >
                    Minimum remaining{" "}
                    <strong>
                      {cardMoney(
                        Math.max(
                          0,
                          billForPayment.minimumMinor -
                            statementPaid(billForPayment),
                        ),
                      )}
                    </strong>
                  </button>
                  <button
                    type="button"
                    aria-pressed={paymentMode === "custom"}
                    onClick={() => setPaymentMode("custom")}
                  >
                    Custom amount
                  </button>
                </div>
                <div className="cards-fields">
                  <Field label="Amount paid (INR)">
                    <input
                      name="amount"
                      inputMode="decimal"
                      required
                      value={paymentAmount}
                      onChange={(e) => {
                        setPaymentAmount(e.target.value);
                        setPaymentMode("custom");
                      }}
                    />
                  </Field>
                  <Field label="Payment date">
                    <input
                      name="date"
                      type="date"
                      required
                      min={billForPayment.date}
                      max={todayIST()}
                      defaultValue={todayIST()}
                    />
                  </Field>
                  <Field label="Payment note (optional)">
                    <input
                      name="note"
                      maxLength={80}
                      placeholder="Bank transfer"
                      autoComplete="off"
                    />
                  </Field>
                </div>
                <button className="cards-button" disabled={locked}>
                  {paymentMode === "full"
                    ? "Confirm full payment"
                    : "Save payment"}
                </button>
              </form>
            </section>
          )}
          {view !== "history" && (
            <>
              <div className="cards-section-head">
                <h2>
                  {view === "archived" ? "Archived cards" : "Your wallet"}
                </h2>
                <label className="cards-search">
                  Find a card
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name, bank or last four"
                  />
                </label>
              </div>
              <div className="cards-wallet-filters" aria-label="Filter cards">
                {[
                  { value: "all", label: "All cards" },
                  { value: "unpaid", label: "Outstanding" },
                  { value: "overdue", label: "Overdue" },
                  { value: "soon", label: "Due this week" },
                  { value: "settled", label: "Paid" },
                  { value: "no-bill", label: "No statement" },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    aria-pressed={walletFilter === filter.value}
                    onClick={() => setWalletFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <section className="cards-wallet" aria-label="Your cards">
                {visibleCards.map((c) => {
                  const bill = latestCardBill(doc, c.id);
                  return (
                    <button
                      className="cards-wallet-item"
                      key={c.id}
                      aria-pressed={chosen?.id === c.id}
                      onClick={() => {
                        setSelected(c.id);
                        setForm(null);
                      }}
                    >
                      <span>
                        {c.issuer}
                        <small>{c.network}</small>
                      </span>
                      <strong>{c.name}</strong>
                      <span className="cards-digits">
                        •••• &nbsp; {c.last4}
                      </span>
                      <span className="cards-wallet-bottom">
                        <span>
                          Limit<strong>{cardMoney(c.limitMinor)}</strong>
                        </span>
                        <span>
                          {c.archived
                            ? "Archived"
                            : bill
                              ? dueText(bill)
                              : "No statements yet"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </section>
              {!visibleCards.length && (
                <section className="cards-panel cards-empty">
                  <h2>
                    {doc.cards.length
                      ? "No matching cards."
                      : "Start with your first card."}
                  </h2>
                  <p>
                    {doc.cards.length
                      ? "Try a different name, issuer or last four digits."
                      : "Add its limit and billing schedule, then record the latest statement."}
                  </p>
                  {!doc.cards.length && (
                    <button
                      className="cards-button"
                      disabled={locked}
                      onClick={() => beginCard()}
                    >
                      Add your first card
                    </button>
                  )}
                </section>
              )}
              {chosen && (
                <section className="cards-detail-grid">
                  <section className="cards-panel">
                    <div className="cards-section-head">
                      <div>
                        <p className="cards-kicker">
                          {chosen.issuer} · •••• {chosen.last4}
                        </p>
                        <h2>{chosen.name}</h2>
                      </div>
                      <button
                        disabled={locked}
                        onClick={() => beginCard(chosen)}
                      >
                        Edit card
                      </button>
                    </div>
                    {latest ? (
                      <>
                        <div className="cards-bill-hero">
                          <span>
                            Latest statement · {cardDate(latest.date)}
                          </span>
                          <strong>
                            {statementBalance(latest) === 0
                              ? "Paid in full"
                              : cardMoney(statementBalance(latest))}
                          </strong>
                          <span
                            className={
                              statementBalance(latest) > 0 &&
                              daysUntil(latest.dueDate) < 0
                                ? "cards-overdue"
                                : ""
                            }
                          >
                            {dueText(latest)}
                          </span>
                        </div>
                        <dl className="cards-facts">
                          <div>
                            <dt>Payment due</dt>
                            <dd>{cardDate(latest.dueDate)}</dd>
                          </div>
                          <div>
                            <dt>Minimum remaining</dt>
                            <dd>
                              {cardMoney(
                                Math.max(
                                  0,
                                  latest.minimumMinor - statementPaid(latest),
                                ),
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Full statement</dt>
                            <dd>{cardMoney(latest.totalMinor)}</dd>
                          </div>
                          <div>
                            <dt>Payments recorded</dt>
                            <dd>{cardMoney(statementPaid(latest))}</dd>
                          </div>
                        </dl>
                        {statementBalance(latest) > 0 &&
                          latest.minimumMinor > 0 &&
                          statementPaid(latest) >= latest.minimumMinor && (
                            <p className="cards-notice">
                              Minimum recorded as paid. The remaining statement
                              balance is still outstanding.
                            </p>
                          )}
                        <div className="cards-actions">
                          <button
                            className="cards-button"
                            disabled={locked || statementBalance(latest) === 0}
                            onClick={() => {
                              beginPayment(latest);
                            }}
                          >
                            Record payment
                          </button>
                          <button
                            disabled={locked || !statementBalance(latest)}
                            onClick={() => beginPayment(latest, "full")}
                          >
                            Mark bill paid
                          </button>
                          <button
                            disabled={!statementBalance(latest)}
                            onClick={() =>
                              downloadCards(
                                cardCalendar(chosen, latest),
                                "card-payment.ics",
                                "text/calendar;charset=utf-8",
                              )
                            }
                          >
                            Add due date to calendar
                          </button>
                        </div>
                        <p className="cards-note">
                          Latest statement balance only. Unbilled spending and
                          bank adjustments are not included.
                        </p>
                      </>
                    ) : (
                      <div className="cards-empty">
                        <h3>No statement recorded.</h3>
                        <p>
                          Add the latest bank bill to see its balance and due
                          date.
                        </p>
                      </div>
                    )}
                    <div className="cards-actions">
                      <button
                        disabled={locked || chosen.archived}
                        onClick={() => beginBill()}
                      >
                        + Record statement
                      </button>
                      <button
                        onClick={() => {
                          setView("history");
                          setSelected(chosen.id);
                          setForm(null);
                        }}
                      >
                        View all history
                      </button>
                    </div>
                  </section>
                  <aside className="cards-panel">
                    <p className="cards-kicker">BILLING RHYTHM</p>
                    <h2>What’s next</h2>
                    <dl className="cards-facts cards-facts-stack">
                      <div>
                        <dt>Next expected statement</dt>
                        <dd>{cardDate(cardSchedule(chosen).statementDate)}</dd>
                      </div>
                      <div>
                        <dt>Expected due date for that statement</dt>
                        <dd>{cardDate(cardSchedule(chosen).dueDate)}</dd>
                      </div>
                      <div>
                        <dt>Annual fee recorded</dt>
                        <dd>{cardMoney(chosen.annualFeeMinor)}</dd>
                      </div>
                    </dl>
                    <p className="cards-note">
                      Schedule estimates from your day settings. The actual bank
                      statement takes priority.
                    </p>
                    {latest && (
                      <div className="cards-utilization">
                        <span>Latest statement / credit limit</span>
                        <strong>
                          {Math.round(
                            (latest.totalMinor / chosen.limitMinor) * 100,
                          )}
                          %
                        </strong>
                        <progress
                          max={chosen.limitMinor}
                          value={Math.min(chosen.limitMinor, latest.totalMinor)}
                          aria-label="Statement utilization"
                        />
                        <small>
                          Statement utilization, not a live bank balance.
                        </small>
                      </div>
                    )}
                    <button
                      disabled={locked}
                      onClick={() =>
                        void act(async () => {
                          if (
                            !chosen.archived &&
                            latest &&
                            statementBalance(latest) > 0
                          )
                            throw new Error(
                              "This card has an unpaid latest bill. Keep it active until it is settled.",
                            );
                          if (
                            !confirm(
                              chosen.archived
                                ? "Restore this card?"
                                : "Archive this card? All history stays available.",
                            )
                          )
                            return;
                          const next = copy(doc);
                          next.cards = next.cards.map((c) =>
                            c.id === chosen.id
                              ? { ...c, archived: !c.archived }
                              : c,
                          );
                          await save(next);
                          setView(chosen.archived ? "overview" : "archived");
                        })
                      }
                    >
                      {chosen.archived ? "Restore card" : "Archive card"}
                    </button>
                  </aside>
                </section>
              )}
              {view === "overview" && dueBills.length > 0 && (
                <section className="cards-panel">
                  <p className="cards-kicker">UPCOMING & OVERDUE</p>
                  <h2>Your payment queue</h2>
                  {dueBills.map(({ card, bill }) => (
                    <button
                      className="cards-queue-row"
                      key={bill.id}
                      onClick={() => {
                        beginPayment(bill);
                      }}
                    >
                      <span>
                        <strong>
                          {card.name} · {card.last4}
                        </strong>
                        <small>
                          {cardDate(bill.dueDate)} · {dueText(bill)}
                        </small>
                      </span>
                      <strong>{cardMoney(statementBalance(bill))} →</strong>
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
          {view === "history" && (
            <section className="cards-panel">
              <div className="cards-section-head">
                <div>
                  <p className="cards-kicker">STATEMENTS & PAYMENTS</p>
                  <h2>Your paper trail.</h2>
                </div>
                <label className="cards-search">
                  History card
                  <select
                    value={selected}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setForm(null);
                    }}
                  >
                    <option value="">All cards</option>
                    {doc.cards.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name} • {c.last4}
                        {c.archived ? " · archived" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="cards-history-controls">
                <div className="cards-wallet-filters">
                  <button
                    aria-pressed={historyMode === "bills"}
                    onClick={() => setHistoryMode("bills")}
                  >
                    Statements
                  </button>
                  <button
                    aria-pressed={historyMode === "payments"}
                    onClick={() => setHistoryMode("payments")}
                  >
                    Payment log
                  </button>
                </div>
                {historyMode === "payments" && (
                  <label className="cards-search">
                    Payment month
                    <select
                      value={historyMonth}
                      onChange={(e) => setHistoryMonth(e.target.value)}
                    >
                      <option value="">All months</option>
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {historyMode === "payments" && (
                <div className="cards-payment-log">
                  {!filteredPayments.length && (
                    <p className="cards-empty">
                      No payments recorded for this selection.
                    </p>
                  )}
                  {filteredPayments.map((payment) => (
                    <article
                      key={payment.cardId + payment.statementDate + payment.id}
                    >
                      <span className="cards-log-check" aria-hidden="true">
                        ✓
                      </span>
                      <div>
                        <h3>
                          {payment.cardName} • {payment.last4}
                        </h3>
                        <p>
                          {cardDate(payment.date)} · Statement{" "}
                          {cardDate(payment.statementDate)}
                        </p>
                        {payment.note && <small>{payment.note}</small>}
                      </div>
                      <strong>{cardMoney(payment.amountMinor)}</strong>
                    </article>
                  ))}
                </div>
              )}
              <div hidden={historyMode !== "bills"}>
                {!bills.length && (
                  <p className="cards-empty">
                    No statements recorded for this selection.
                  </p>
                )}
                {bills.map((bill) => {
                  const card = doc.cards.find((c) => c.id === bill.cardId)!;
                  return (
                    <article className="cards-history-bill" key={bill.id}>
                      <div className="cards-section-head">
                        <div>
                          <h3>
                            {card.name} · {card.last4}
                          </h3>
                          <p>
                            Statement {cardDate(bill.date)} · Due{" "}
                            {cardDate(bill.dueDate)}
                          </p>
                        </div>
                        <span className="cards-bill-state">
                          {dueText(bill)}
                        </span>
                      </div>
                      <dl className="cards-facts">
                        <div>
                          <dt>Total billed</dt>
                          <dd>{cardMoney(bill.totalMinor)}</dd>
                        </div>
                        <div>
                          <dt>Still outstanding</dt>
                          <dd>{cardMoney(statementBalance(bill))}</dd>
                        </div>
                      </dl>
                      <ol className="cards-payment-history">
                        {bill.payments.map((payment) => (
                          <li key={payment.id}>
                            <span>
                              <strong>{cardMoney(payment.amountMinor)}</strong>
                              <small>
                                {cardDate(payment.date)}
                                {payment.note ? " · " + payment.note : ""}
                              </small>
                            </span>
                            <button
                              disabled={locked}
                              onClick={() =>
                                void act(async () => {
                                  if (
                                    !confirm(
                                      "Remove this recorded payment? The bill balance will increase. This does not reverse a bank payment.",
                                    )
                                  )
                                    return;
                                  const next = copy(doc);
                                  next.statements.find(
                                    (s) => s.id === bill.id,
                                  )!.payments = bill.payments.filter(
                                    (p) => p.id !== payment.id,
                                  );
                                  await save(next);
                                })
                              }
                            >
                              Correct / remove
                            </button>
                          </li>
                        ))}
                      </ol>
                      <div className="cards-actions">
                        <button
                          disabled={locked || !statementBalance(bill)}
                          onClick={() => {
                            beginPayment(bill);
                          }}
                        >
                          Record payment
                        </button>
                        <button
                          disabled={locked}
                          onClick={() => {
                            setSelected(card.id);
                            beginBill(bill);
                          }}
                        >
                          Edit statement
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="cards-note">
                Older statements may carry into later bills. Totals on the
                dashboard use only each card’s latest statement to avoid adding
                carried balances twice.
              </p>
            </section>
          )}
          {view === "overview" && statementChecks.length > 0 && (
            <section className="cards-panel cards-statement-checks">
              <p className="cards-kicker">CHECK YOUR BANK APP</p>
              <h2>Ready for a new statement?</h2>
              <p className="cards-note">
                These are estimates from your saved schedule. Confirm that a
                bill was issued before recording it.
              </p>
              {statementChecks.map((card) => (
                <div key={card.id}>
                  <span>
                    <strong>
                      {card.name} • {card.last4}
                    </strong>
                    <small>
                      Expected around {cardDate(expectedCardStatement(card))}
                    </small>
                  </span>
                  <button
                    disabled={locked}
                    onClick={() => {
                      setSelected(card.id);
                      beginBill();
                    }}
                  >
                    Record bill for {card.name}
                  </button>
                </div>
              ))}
            </section>
          )}
          <div className="cards-bottom-actions">
            <button
              disabled={!paymentLog.length}
              onClick={() =>
                downloadCards(cardPaymentsCSV(doc), "card-payments.csv")
              }
            >
              Export payments
            </button>
            <button
              disabled={!doc.statements.length}
              onClick={() =>
                downloadCards(cardsCSV(doc), "card-statements.csv")
              }
            >
              Export statement history
            </button>
            <button
              disabled={!doc.cards.length}
              onClick={() =>
                downloadCards(
                  JSON.stringify(doc, null, 2),
                  "cards-backup.json",
                  "application/json",
                )
              }
            >
              Download private backup
            </button>
            {!demo && (
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Reload online? Any unfinished form will be replaced.",
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
      <footer className="cards-footer">
        <p>Private, manual tracking · INR · Dates in IST</p>
        <p>
          Record payments after paying through your bank. This tracker does not
          connect to your bank, move money or send automatic reminders. Calendar
          files can add reminders to your calendar.
        </p>
      </footer>
    </main>
  );
}
