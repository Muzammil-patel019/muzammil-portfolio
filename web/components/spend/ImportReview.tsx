"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  duplicateKey,
  parseAmount,
  parseStatementDate,
  summarizeTransactions,
  suggestLabels,
  transactionSchema,
  type SpendTransaction,
} from "@/lib/spend/analyzer";
export default function ImportReview({
  transactions,
  currency,
  onUpdate,
}: {
  transactions: SpendTransaction[];
  currency: string;
  onUpdate: (row: SpendTransaction) => void;
}) {
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const [edit, setEdit] = useState<SpendTransaction | null>(null),
    [amount, setAmount] = useState(""),
    [error, setError] = useState("");
  const [expectedDebit, setExpectedDebit] = useState(""),
    [expectedCredit, setExpectedCredit] = useState("");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!edit) return;
    const frame = requestAnimationFrame(() => {
      form.current?.scrollIntoView({ block: "center", behavior: "instant" });
      form.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [edit?.id]);
  const duplicates = useMemo(() => {
    const seen = new Set<string>(),
      ids = new Set<string>();
    for (const t of transactions) {
      const k = duplicateKey(t);
      if (seen.has(k)) ids.add(t.id);
      else seen.add(k);
    }
    return ids;
  }, [transactions]);
  const totals = useMemo(
    () => summarizeTransactions(transactions),
    [transactions],
  );
  const flagged = transactions.filter(
    (t) => t.excluded || t.importNote || duplicates.has(t.id),
  );
  const flaggedIds = new Set(flagged.map((t) => t.id));
  const shown = transactions.filter(
    (t) =>
      (filter !== "flagged" || flaggedIds.has(t.id)) &&
      (filter !== "excluded" || t.excluded) &&
      (filter !== "unreviewed" || !t.reviewed) &&
      (!search ||
        `${t.description} ${t.date}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const current = Math.min(page, Math.max(0, Math.ceil(shown.length / 20) - 1));
  const money = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
      n / 100,
    );
  function compare(raw: string, actual: number) {
    if (!raw.trim()) return null;
    try {
      const n = parseAmount(raw);
      if (!n || n.negative) return "Enter a non-negative transaction total.";
      const delta = actual - n.minor;
      return delta === 0
        ? "Matches the included transaction total."
        : `Difference: ${money(Math.abs(delta))} ${delta > 0 ? "above" : "below"} the figure you entered. Review excluded or missing rows.`;
    } catch {
      return "Enter a valid amount with up to two decimal places.";
    }
  }
  return (
    <section
      className="spend-import-review"
      aria-label="Review extracted transactions"
    >
      <div className="spend-import-summary">
        <div>
          <span>Included debits</span>
          <strong>{money(totals.outflows)}</strong>
        </div>
        <div>
          <span>Included credits</span>
          <strong>{money(totals.credits)}</strong>
        </div>
        <div>
          <span>Needs attention</span>
          <strong>{flagged.length}</strong>
        </div>
      </div>
      <p className="cards-note">
        {totals.count} included · {transactions.length - totals.count} excluded.
        Edit wrong amounts, dates or directions here before importing. Flagged
        rows keep their source notes.
      </p>
      <div className="spend-fields">
        <label className="cards-field">
          <span>Preview rows</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All rows</option>
            <option value="flagged">Flagged rows</option>
            <option value="excluded">Excluded rows</option>
            <option value="unreviewed">Not reviewed yet</option>
          </select>
        </label>
        <label className="cards-field">
          <span>Search preview</span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Description or date"
          />
        </label>
      </div>
      {edit && (
        <form
          className="spend-editor"
          ref={form}
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const parsed = parseAmount(amount);
              if (!parsed || !parsed.minor || parsed.negative)
                throw Error("Enter a positive amount.");
              if (parseStatementDate(edit.date, "DMY", 2000) !== edit.date)
                throw Error("Enter a valid transaction date.");
              onUpdate(
                transactionSchema.parse({
                  ...edit,
                  ...suggestLabels(
                    edit.description,
                    parsed.marker || edit.direction,
                  ),
                  amountMinor: parsed.minor,
                  direction: parsed.marker || edit.direction,
                  reviewed: true,
                }),
              );
              setEdit(null);
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <h4>Correct extracted row</h4>
          <div className="spend-fields">
            <label className="cards-field">
              <span>Preview transaction date</span>
              <input
                type="date"
                required
                value={edit.date}
                onChange={(e) => setEdit({ ...edit, date: e.target.value })}
              />
            </label>
            <label className="cards-field">
              <span>Preview description</span>
              <input
                required
                maxLength={2000}
                value={edit.description}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
              />
            </label>
            <label className="cards-field">
              <span>Preview amount</span>
              <input
                type="text"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="cards-field">
              <span>Preview direction</span>
              <select
                value={edit.direction}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    direction: e.target.value as "debit" | "credit",
                  })
                }
              >
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </label>
          </div>
          <label className="spend-check">
            <input
              type="checkbox"
              checked={!edit.excluded}
              onChange={(e) =>
                setEdit({ ...edit, excluded: !e.target.checked })
              }
            />
            Include this corrected row in totals
          </label>
          {edit.importNote && (
            <p className="cards-note">Source note: {edit.importNote}</p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="spend-actions">
            <button type="submit">Save preview correction</button>
            <button
              type="button"
              onClick={() => {
                setEdit(null);
                setError("");
              }}
            >
              Cancel correction
            </button>
          </div>
        </form>
      )}
      <div className="spend-table-wrap">
        <table className="spend-preview-ledger">
          <caption>Review preview · {shown.length} matching rows</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / status</th>
              <th>Amount</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(current * 20, (current + 1) * 20).map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>
                  {t.description}
                  <small>
                    {t.excluded
                      ? "Excluded from totals"
                      : t.reviewed
                        ? "Reviewed"
                        : "Not reviewed"}
                    {duplicates.has(t.id) ? " · Possible duplicate" : ""}
                  </small>
                  {t.importNote && <small>{t.importNote}</small>}
                </td>
                <td>
                  {t.currency} {(t.amountMinor / 100).toFixed(2)}
                  <small>{t.direction}</small>
                </td>
                <td>
                  <button
                    onClick={() => {
                      setEdit({ ...t });
                      setAmount((t.amountMinor / 100).toFixed(2));
                      setError("");
                    }}
                  >
                    Correct row
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="spend-actions">
        <button disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous preview page
        </button>
        <span>
          {current + 1} / {Math.max(1, Math.ceil(shown.length / 20))}
        </span>
        <button
          disabled={(current + 1) * 20 >= shown.length}
          onClick={() => setPage(current + 1)}
        >
          Next preview page
        </button>
      </div>
      <details>
        <summary>Compare transaction totals (optional)</summary>
        <p className="cards-note">
          Use the statement’s transaction debit/credit totals, not its total
          amount due or opening balance. These figures are compared with
          included rows only; exclusions can explain a difference. Comparison
          never changes amounts automatically.
        </p>
        <div className="spend-fields">
          <label className="cards-field">
            <span>Expected transaction debit total</span>
            <input
              type="text"
              inputMode="decimal"
              value={expectedDebit}
              onChange={(e) => setExpectedDebit(e.target.value)}
            />
          </label>
          <label className="cards-field">
            <span>Expected transaction credit total</span>
            <input
              type="text"
              inputMode="decimal"
              value={expectedCredit}
              onChange={(e) => setExpectedCredit(e.target.value)}
            />
          </label>
        </div>
        {expectedDebit && (
          <p role="status">Debits: {compare(expectedDebit, totals.outflows)}</p>
        )}
        {expectedCredit && (
          <p role="status">
            Credits: {compare(expectedCredit, totals.credits)}
          </p>
        )}
      </details>
    </section>
  );
}
