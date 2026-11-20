"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  chargeTypes,
  detectMapping,
  duplicateKey,
  normalizeRows,
  parseDelimited,
  spendCategories,
  transactionsCSV,
  type Mapping,
  type SpendDocument,
  type SpendTransaction,
} from "@/lib/spend/analyzer";
import { summarizeTransactions } from "@/lib/spend/analyzer";
import { decryptSpend, encryptSpend } from "@/lib/spend/backup";
import { pdfGridRows, pdfTable, type PDFLine } from "@/lib/spend/pdf";
import { readStatementFile, type StatementSheet } from "@/lib/spend/files";
const empty = (): SpendDocument => ({
  version: 1,
  sources: [],
  transactions: [],
});
function download(content: string, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
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
function Bars({
  title,
  items,
  format,
}: {
  title: string;
  items: { label: string; amountMinor: number }[];
  format: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.amountMinor));
  return (
    <section className="cards-panel spend-chart">
      <h3>{title}</h3>
      {!items.length ? (
        <p className="cards-note">No matching transactions.</p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.label}>
              <div>
                <span title={i.label}>{i.label}</span>
                <strong>{format(i.amountMinor)}</strong>
              </div>
              <div className="spend-track">
                <span style={{ width: `${(i.amountMinor / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export default function SpendAnalyzer() {
  const [doc, setDoc] = useState<SpendDocument>(empty);
  const [view, setView] = useState<
    "import" | "analysis" | "transactions" | "backup"
  >("import");
  const [file, setFile] = useState<File | null>(null),
    [pdfPassword, setPdfPassword] = useState("");
  const [pending, setPending] = useState<{
    sheets: StatementSheet[];
    name: string;
    warnings: string[];
    id: string;
    pdfPages?: PDFLine[][];
    pdfWidths?: number[];
  } | null>(null);
  const [boundaries, setBoundaries] = useState("18,78,94");
  const [tableText, setTableText] = useState("");
  const [sheet, setSheet] = useState(0),
    [mapping, setMapping] = useState<Mapping | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [currency, setCurrency] = useState<SpendTransaction["currency"]>("INR"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [source, setSource] = useState("");
  const [search, setSearch] = useState(""),
    [feesOnly, setFeesOnly] = useState(false),
    [page, setPage] = useState(0);
  const [edit, setEdit] = useState<SpendTransaction | null>(null),
    [editAmount, setEditAmount] = useState("");
  const [passphrase, setPassphrase] = useState(""),
    [backup, setBackup] = useState<File | null>(null);
  const sequence = useRef(0),
    controller = useRef<AbortController | null>(null),
    fileInput = useRef<HTMLInputElement>(null),
    backupInput = useRef<HTMLInputElement>(null),
    editorRef = useRef<HTMLFormElement>(null);
  useEffect(
    () => () => {
      sequence.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!doc.transactions.length) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [doc.transactions.length]);
  useEffect(() => {
    if (!edit) return;
    const frame = requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
      editorRef.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [edit?.id]);
  const preview = useMemo(() => {
    if (!pending || !mapping) return null;
    try {
      return {
        ...normalizeRows(pending.sheets[sheet].rows, mapping, pending.id),
        error: "",
      };
    } catch (e) {
      return { transactions: [], issues: [], error: (e as Error).message };
    }
  }, [pending, mapping, sheet]);
  const filtered = useMemo(
    () =>
      doc.transactions.filter(
        (t) =>
          t.currency === currency &&
          (!from || t.date >= from) &&
          (!to || t.date <= to) &&
          (!source || t.sourceId === source),
      ),
    [doc, currency, from, to, source],
  );
  const totals = useMemo(() => summarizeTransactions(filtered), [filtered]);
  const visible = useMemo(
    () =>
      filtered
        .filter(
          (t) =>
            (!feesOnly || t.chargeType !== "none") &&
            (!search ||
              `${t.description} ${t.category} ${t.date}`
                .toLowerCase()
                .includes(search.toLowerCase())),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [filtered, search, feesOnly],
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / 30));
  const currentPage = Math.min(page, pageCount - 1);
  const duplicateIds = useMemo(() => {
    const keys = new Set<string>(),
      ids = new Set<string>();
    for (const t of doc.transactions) {
      const key = duplicateKey(t);
      if (keys.has(key)) ids.add(t.id);
      else keys.add(key);
    }
    return ids;
  }, [doc]);
  const format = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(
      n / 100,
    );
  const update = (t: SpendTransaction) =>
    setDoc((d) => ({
      ...d,
      transactions: d.transactions.map((old) => (old.id === t.id ? t : old)),
    }));
  const fail = (e: unknown) => {
    setError(e instanceof Error ? e.message : "This file could not be read.");
    setMessage("");
  };
  async function read() {
    if (!file) return;
    const epoch = ++sequence.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setPending(null);
    setTableText("");
    setMessage("Reading on this device…");
    try {
      const result = await readStatementFile(
        file,
        pdfPassword,
        (m) => {
          if (epoch === sequence.current) setMessage(m);
        },
        abort.signal,
      );
      if (epoch !== sequence.current) return;
      if (!result.sheets.length || !result.sheets[0].rows.length)
        throw Error("No rows found in this file.");
      setPending({
        ...result,
        name: file.name.slice(0, 200),
        id: crypto.randomUUID(),
      });
      setSheet(0);
      setMapping(detectMapping(result.sheets[0].rows));
      setPdfPassword("");
      setMessage("Check the column mapping and preview, then import.");
    } catch (e) {
      if (epoch === sequence.current) fail(e);
    } finally {
      if (epoch === sequence.current) setBusy(false);
    }
  }
  function clear() {
    if (
      (doc.transactions.length || pending) &&
      !confirm(
        "Clear all statement data from this session? Download an encrypted backup first if you want to keep it.",
      )
    )
      return;
    sequence.current++;
    controller.current?.abort();
    setBusy(false);
    setDoc(empty());
    setView("import");
    setPending(null);
    setTableText("");
    setFile(null);
    setBackup(null);
    setPdfPassword("");
    setPassphrase("");
    setEdit(null);
    setError("");
    setMessage("Statement data cleared from this session.");
    setSource("");
    setFrom("");
    setTo("");
    setSearch("");
    setPage(0);
    if (fileInput.current) fileInput.current.value = "";
    if (backupInput.current) backupInput.current.value = "";
  }
  async function saveBackup() {
    const epoch = ++sequence.current;
    setError("");
    setBusy(true);
    try {
      const encrypted = await encryptSpend(doc, passphrase);
      if (epoch !== sequence.current) return;
      download(encrypted, "spend-analysis.spendvault");
      setPassphrase("");
      setMessage(
        "Encrypted backup downloaded. Keep its passphrase separately; it cannot be recovered.",
      );
    } catch (e) {
      if (epoch === sequence.current) fail(e);
    } finally {
      if (epoch === sequence.current) setBusy(false);
    }
  }
  async function restore() {
    if (!backup || backup.size > 20000000) {
      setError("Choose an encrypted backup smaller than 20 MB.");
      return;
    }
    if (
      doc.transactions.length &&
      !confirm("Replace this session with the encrypted backup?")
    )
      return;
    const epoch = ++sequence.current;
    controller.current?.abort();
    setBusy(true);
    setError("");
    try {
      const restored = await decryptSpend(await backup.text(), passphrase);
      if (epoch !== sequence.current) return;
      setDoc(restored);
      setView("analysis");
      setCurrency(restored.transactions[0]?.currency || "INR");
      setSource("");
      setFrom("");
      setTo("");
      setPending(null);
      setTableText("");
      setEdit(null);
      setPassphrase("");
      setMessage(
        "Backup unlocked locally. Review categories before relying on totals.",
      );
    } catch (e) {
      if (epoch === sequence.current) fail(e);
    } finally {
      if (epoch === sequence.current) setBusy(false);
    }
  }
  function applyPDFLayout() {
    if (!pending?.pdfPages || !pending.pdfWidths) return;
    try {
      const rows = pdfGridRows(
        pending.pdfPages,
        pending.pdfWidths,
        boundaries.split(",").map((n) => Number(n.trim())),
      );
      const m = detectMapping(rows);
      setPending({
        ...pending,
        sheets: [{ name: "Custom PDF columns", rows }],
      });
      setSheet(0);
      setMapping({
        ...m,
        date: 0,
        description: Math.min(1, rows[0].length - 1),
        amount: Math.max(0, rows[0].length - 2),
        direction: rows[0].length - 1,
        mode: "single",
      });
      setError("");
      setMessage(
        "Custom columns ready. Select the date, description and amount columns and check the preview.",
      );
    } catch (e) {
      fail(e);
    }
  }
  function applyTableText() {
    if (!pending) return;
    try {
      const rows = parseDelimited(tableText);
      if (rows.length < 2)
        throw Error("Add a header row and at least one transaction row.");
      setPending({ ...pending, sheets: [{ name: "Corrected table", rows }] });
      setSheet(0);
      setMapping(detectMapping(rows));
      setError("");
      setTableText("");
    } catch (e) {
      fail(e);
    }
  }
  const col = (
    key: "date" | "description" | "debit" | "credit" | "amount" | "direction",
    label: string,
  ) =>
    mapping &&
    pending && (
      <Field label={label}>
        <select
          value={mapping[key]}
          onChange={(e) =>
            setMapping({ ...mapping, [key]: Number(e.target.value) })
          }
        >
          <option value={-1}>Not mapped</option>
          {(pending.sheets[sheet].rows[mapping.headerRow] || []).map((c, i) => (
            <option key={i} value={i}>
              {i + 1}: {c.slice(0, 65) || "Unnamed column"}
            </option>
          ))}
        </select>
      </Field>
    );
  return (
    <section className="spend-analyzer" aria-label="Spend Analyzer">
      <div className="spend-toolbar">
        <span className="spend-badge">
          LOCAL · PRIVATE
          {doc.transactions.length
            ? ` · ${doc.transactions.length} transactions`
            : ""}
        </span>
        {!!doc.transactions.length && (
          <button onClick={clear}>Clear session</button>
        )}
      </div>
      <nav className="spend-view-nav" aria-label="Analyzer views">
        {[
          { id: "import", label: "Statements" },
          { id: "analysis", label: "Summary" },
          { id: "transactions", label: "Transactions" },
          { id: "backup", label: "Backup" },
        ].map((item) => (
          <button
            key={item.id}
            aria-pressed={view === item.id}
            disabled={
              (item.id === "analysis" || item.id === "transactions") &&
              !doc.transactions.length
            }
            onClick={() => setView(item.id as typeof view)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <p className="spend-privacy">
        Nothing is uploaded. Data clears when you leave or refresh.{" "}
        <button className="spend-text-button" onClick={() => setView("backup")}>
          Save an encrypted backup
        </button>{" "}
        to keep it.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {error && (
        <p className="cards-notice" role="alert">
          {error}
        </p>
      )}
      <div hidden={view !== "import"} className="spend-view-panel">
        <section className="cards-panel">
          <h3>Add a statement</h3>
          <p className="cards-note">
            CSV, XLSX or text-based PDF · up to 20 MB. Scanned PDFs need a bank
            CSV/XLSX export. PDF layouts vary; always compare the preview and
            imported totals with your statement.
          </p>
          <div className="spend-fields">
            <Field label="Statement file">
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.txt,.xlsx,.pdf"
                disabled={busy}
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setPending(null);
                  setTableText("");
                  setPdfPassword("");
                  setError("");
                }}
              />
            </Field>
            <Field label="PDF password (only if needed)">
              <input
                type="password"
                autoComplete="off"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
              />
            </Field>
          </div>
          <div className="spend-actions">
            <button disabled={!file || busy} onClick={read}>
              {busy ? "Working locally…" : "Read statement"}
            </button>
            {busy && (
              <button
                onClick={() => {
                  sequence.current++;
                  controller.current?.abort();
                  setBusy(false);
                  setMessage("Cancelled.");
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </section>
        {pending && mapping && preview && (
          <section className="cards-panel spend-import">
            <h3>Check your import</h3>
            {pending.warnings.map((w) => (
              <p className="cards-notice" key={w}>
                {w}
              </p>
            ))}
            {pending.pdfPages && (
              <details className="spend-layout-editor">
                <summary>Layout not right? Adjust PDF columns</summary>
                <p className="cards-note">
                  Works with readable PDFs from any bank. Column positions are
                  percentages across the page: for example, 18,78,94 makes four
                  columns. Adjust the boundaries, then map the date,
                  description, amount and D/C columns below. Changing layout
                  does not import anything.
                </p>
                <Field label="Column boundaries (%)">
                  <input
                    value={boundaries}
                    onChange={(e) => setBoundaries(e.target.value)}
                    placeholder="18,78,94"
                  />
                </Field>
                <div className="spend-table-wrap">
                  <table>
                    <caption>Extracted columns · first 8 rows</caption>
                    <tbody>
                      {pending.sheets[sheet].rows.slice(0, 8).map((row, i) => (
                        <tr key={i}>
                          {row.map((v, j) => (
                            <td key={j}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="spend-actions">
                  <button onClick={applyPDFLayout}>Apply column layout</button>
                  <button
                    onClick={() => {
                      const result = pdfTable(pending.pdfPages!);
                      setPending({
                        ...pending,
                        sheets: [
                          { name: "PDF transactions", rows: result.rows },
                        ],
                      });
                      setSheet(0);
                      setMapping(detectMapping(result.rows));
                      setError("");
                    }}
                  >
                    Use automatic detection
                  </button>
                </div>
              </details>
            )}
            <details className="spend-layout-editor">
              <summary>View or correct the extracted table</summary>
              <p className="cards-note">
                All corrections stay on this device. Check source rows here when
                an amount, date or column is missing. You can also paste a CSV
                copied from your bank export. Quoted values can contain commas.
              </p>
              <button
                onClick={() =>
                  setTableText(
                    pending.sheets[sheet].rows
                      .map((row) =>
                        row
                          .map((v) => '"' + v.replaceAll('"', '""') + '"')
                          .join(","),
                      )
                      .join("\n"),
                  )
                }
              >
                Load extracted rows
              </button>
              <Field label="Editable statement table (CSV)">
                <textarea
                  rows={10}
                  value={tableText}
                  onChange={(e) => setTableText(e.target.value)}
                  spellCheck={false}
                />
              </Field>
              <button disabled={!tableText.trim()} onClick={applyTableText}>
                Apply corrected table
              </button>
            </details>
            <div className="spend-fields">
              <Field label="Worksheet">
                <select
                  value={sheet}
                  onChange={(e) => {
                    const index = Number(e.target.value);
                    setSheet(index);
                    setMapping(detectMapping(pending.sheets[index].rows));
                  }}
                >
                  {pending.sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Header row number">
                <input
                  type="number"
                  min={1}
                  max={pending.sheets[sheet].rows.length}
                  value={mapping.headerRow + 1}
                  onChange={(e) => {
                    const index = Math.max(
                      0,
                      Math.min(
                        pending.sheets[sheet].rows.length - 1,
                        Number(e.target.value) - 1,
                      ),
                    );
                    setMapping({
                      ...detectMapping(pending.sheets[sheet].rows.slice(index)),
                      headerRow: index,
                    });
                  }}
                />
              </Field>
              <Field label="Amount layout">
                <select
                  value={mapping.mode}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      mode: e.target.value as Mapping["mode"],
                    })
                  }
                >
                  <option value="separate">
                    Separate debit / credit columns
                  </option>
                  <option value="single">One amount column</option>
                </select>
              </Field>
              {col("date", "Date column")}
              {col("description", "Description column")}
              {mapping.mode === "separate" ? (
                <>
                  {col("debit", "Debit column")}
                  {col("credit", "Credit column")}
                </>
              ) : (
                <>
                  {col("amount", "Amount column")}
                  {col("direction", "Debit / credit indicator column")}
                  <Field label="Signed amount convention">
                    <select
                      value={mapping.sign}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          sign: e.target.value as Mapping["sign"],
                        })
                      }
                    >
                      <option value="positive-debit">
                        Positive = debit, negative = credit
                      </option>
                      <option value="negative-debit">
                        Negative = debit, positive = credit
                      </option>
                    </select>
                  </Field>
                </>
              )}
              <Field label="Date order">
                <select
                  value={mapping.dateOrder}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      dateOrder: e.target.value as Mapping["dateOrder"],
                    })
                  }
                >
                  <option value="DMY">Day / month / year</option>
                  <option value="MDY">Month / day / year</option>
                </select>
              </Field>
              <Field label="Year for dates without a year">
                <input
                  type="number"
                  min={1970}
                  max={2100}
                  value={mapping.year}
                  onChange={(e) =>
                    setMapping({ ...mapping, year: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Statement currency">
                <select
                  value={mapping.currency}
                  onChange={(e) =>
                    setMapping({
                      ...mapping,
                      currency: e.target.value as Mapping["currency"],
                    })
                  }
                >
                  {["INR", "USD", "EUR", "GBP", "AED", "SAR"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="cards-note">
              Currency is assigned to all rows in this import. For
              foreign-currency cards, map the billed amount column. CR/DR
              markers and the indicator column override the signed convention.
              Balance columns are never added to spending.
            </p>
            {preview.error && <p role="alert">{preview.error}</p>}
            <p>
              <strong>{preview.transactions.length} transactions ready</strong>{" "}
              · {preview.issues.length} rows skipped
            </p>
            <details>
              <summary>View skipped rows ({preview.issues.length})</summary>
              <ul className="spend-issues">
                {preview.issues.slice(0, 100).map((i) => (
                  <li key={i.row}>
                    Row {i.row}: {i.reason}
                  </li>
                ))}
              </ul>
              {preview.issues.length > 100 && (
                <p>Showing the first 100 issues. Check the original file.</p>
              )}
            </details>
            <div className="spend-table-wrap">
              <table>
                <caption>Preview · first 12 transactions</caption>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Direction</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.transactions.slice(0, 12).map((t) => (
                    <tr key={t.id}>
                      <td>{t.date}</td>
                      <td>
                        {t.description}
                        {t.importNote && <small>{t.importNote}</small>}
                        {t.excluded && (
                          <small>Excluded from totals until reviewed</small>
                        )}
                      </td>
                      <td>{t.direction}</td>
                      <td>
                        {t.currency} {(t.amountMinor / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              disabled={!preview.transactions.length || !!preview.error || busy}
              onClick={() => {
                if (
                  doc.sources.length >= 50 ||
                  doc.transactions.length + preview.transactions.length > 20000
                ) {
                  setError(
                    "Session limit: 50 imports and 20,000 transactions. Start a new session after backing up.",
                  );
                  return;
                }
                setDoc((d) => ({
                  ...d,
                  sources: [
                    ...d.sources,
                    { id: pending.id, name: pending.name },
                  ],
                  transactions: [...d.transactions, ...preview.transactions],
                }));
                setCurrency(mapping.currency);
                setView("analysis");
                setPending(null);
                setTableText("");
                setFile(null);
                if (fileInput.current) fileInput.current.value = "";
                setPage(0);
                setMessage(
                  "Imported locally. Review suggested categories in Transactions.",
                );
              }}
            >
              Confirm import
            </button>
          </section>
        )}
      </div>
      {!!doc.transactions.length && (
        <>
          <div hidden={view !== "analysis"} className="spend-view-panel">
            <section className="cards-panel">
              <div className="spend-section-heading">
                <h3>Your analysis</h3>
                <span>{doc.transactions.length} imported transactions</span>
              </div>
              <details className="spend-filter-options">
                <summary>
                  Filters · {currency}
                  {from || to
                    ? ` · ${from || "Start"} to ${to || "Today"}`
                    : " · All dates"}
                  {source ? " · One statement" : ""}
                </summary>
                <div className="spend-fields">
                  <Field label="Analysis currency">
                    <select
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value as typeof currency);
                        setPage(0);
                      }}
                    >
                      {[
                        ...new Set(doc.transactions.map((t) => t.currency)),
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="From date">
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        setPage(0);
                      }}
                    />
                  </Field>
                  <Field label="To date">
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => {
                        setTo(e.target.value);
                        setPage(0);
                      }}
                    />
                  </Field>
                  <Field label="Statement">
                    <select
                      value={source}
                      onChange={(e) => {
                        setSource(e.target.value);
                        setPage(0);
                      }}
                    >
                      <option value="">All imported statements</option>
                      {doc.sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {from && to && from > to && (
                  <p role="alert">From date must be before the to date.</p>
                )}
                <p className="cards-note">
                  Totals use the currency, date and statement filters above;
                  currencies are never combined. Transaction search below does
                  not change these totals.
                </p>
              </details>
            </section>
            <div className="spend-metrics" aria-label="Statement totals">
              {[
                ["Spending excluding fees / transfers", totals.purchases],
                ["Fees, interest & posted tax", totals.charges],
                ["Transfers & card payments", totals.transfers],
                ["All credits / refunds", totals.credits],
              ].map(([label, amount]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{format(Number(amount))}</strong>
                </div>
              ))}
            </div>
            <p className="spend-reconcile">
              Total debits: <strong>{format(totals.outflows)}</strong> =
              spending + charges + transfers. Fee reversals / credits:{" "}
              <strong>{format(totals.chargeCredits)}</strong>. Credits can
              include income or bill repayments; they are shown separately.
            </p>
            <div className="spend-charts">
              <Bars
                title="Where you spent"
                items={totals.categories}
                format={format}
              />
              <Bars
                title="Fees & charges"
                items={totals.chargesByType}
                format={format}
              />
              <Bars
                title="Monthly outflows · latest 12 months"
                items={totals.months.slice(-12)}
                format={format}
              />
              <Bars
                title="Top payment descriptions"
                items={totals.merchants.slice(0, 10)}
                format={format}
              />
            </div>
          </div>
          <div hidden={view !== "transactions"} className="spend-view-panel">
            <section className="cards-panel">
              <h3>Transactions</h3>
              <p className="cards-note">
                {currency} · {from || "All dates"}
                {to ? ` to ${to}` : ""} ·{" "}
                {source
                  ? doc.sources.find((s) => s.id === source)?.name
                  : "All statements"}
                .{" "}
                <button
                  className="spend-text-button"
                  onClick={() => setView("analysis")}
                >
                  Change filters
                </button>
              </p>
              <p className="cards-note">
                Labels use simple rules, not AI. Edit incorrect categories and
                charge types. Excluding a row removes it from totals but keeps
                it in your history and backup.
              </p>
              {!!duplicateIds.size && (
                <p className="cards-notice">
                  {duplicateIds.size} possible repeated transactions. Flagged
                  rows stay included until you review and exclude them;
                  identical purchases can be genuine.
                </p>
              )}
              <div className="spend-fields">
                <Field label="Search transactions">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Description, category or date"
                  />
                </Field>
                <label className="spend-check">
                  <input
                    type="checkbox"
                    checked={feesOnly}
                    onChange={(e) => {
                      setFeesOnly(e.target.checked);
                      setPage(0);
                    }}
                  />
                  Only fees & charges
                </label>
              </div>
              {edit && (
                <form
                  className="spend-editor"
                  ref={editorRef}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const amount = Number(editAmount);
                    if (
                      !Number.isFinite(amount) ||
                      amount <= 0 ||
                      amount > 1e10 ||
                      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001
                    ) {
                      setError(
                        "Enter a positive amount with up to two decimal places.",
                      );
                      return;
                    }
                    update({
                      ...edit,
                      amountMinor: Math.round(amount * 100),
                      reviewed: true,
                    });
                    setEdit(null);
                    setError("");
                  }}
                >
                  <h4>Edit transaction</h4>
                  <div className="spend-fields">
                    <Field label="Transaction date">
                      <input
                        required
                        type="date"
                        min="1970-01-01"
                        max="2100-12-31"
                        value={edit.date}
                        onChange={(e) =>
                          setEdit({ ...edit, date: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Transaction description">
                      <input
                        required
                        maxLength={2000}
                        value={edit.description}
                        onChange={(e) =>
                          setEdit({ ...edit, description: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Transaction amount">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                    </Field>
                    <Field label="Transaction direction">
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
                    </Field>
                    <Field label="Transaction category">
                      <select
                        value={edit.category}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            category: e.target.value as typeof edit.category,
                          })
                        }
                      >
                        {spendCategories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Charge type">
                      <select
                        value={edit.chargeType}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            chargeType: e.target
                              .value as typeof edit.chargeType,
                            ...(e.target.value !== "none"
                              ? { category: "Fees & charges" as const }
                              : {}),
                          })
                        }
                      >
                        {chargeTypes.map((c) => (
                          <option key={c} value={c}>
                            {c === "none" ? "Not a fee / charge" : c}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="spend-actions">
                    <button type="submit">Save transaction</button>
                    <button type="button" onClick={() => setEdit(null)}>
                      Cancel edit
                    </button>
                  </div>
                </form>
              )}
              <div className="spend-table-wrap">
                <table className="spend-ledger">
                  <caption>
                    {visible.length} matching transactions · {totals.count}{" "}
                    included in totals
                  </caption>
                  <thead>
                    <tr>
                      <th>Date / status</th>
                      <th>Description / category</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible
                      .slice(currentPage * 30, (currentPage + 1) * 30)
                      .map((t) => (
                        <tr
                          key={t.id}
                          className={t.excluded ? "spend-excluded" : ""}
                        >
                          <td>
                            {t.date}
                            <small>
                              {t.excluded
                                ? "Excluded"
                                : t.reviewed
                                  ? "Reviewed"
                                  : "Needs review"}
                              {duplicateIds.has(t.id)
                                ? " · Possible duplicate"
                                : ""}
                            </small>
                          </td>
                          <td>
                            {t.description}
                            {t.importNote && <small>{t.importNote}</small>}
                            <small>
                              {t.category}
                              {t.chargeType !== "none"
                                ? " · " + t.chargeType
                                : ""}
                            </small>
                          </td>
                          <td>
                            {t.direction === "credit" ? "+ " : "− "}
                            {format(t.amountMinor)}
                            <small>{t.direction}</small>
                          </td>
                          <td>
                            <div className="spend-row-actions">
                              <button
                                onClick={() => {
                                  setEdit({ ...t });
                                  setEditAmount(
                                    (t.amountMinor / 100).toFixed(2),
                                  );
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  update({ ...t, excluded: !t.excluded })
                                }
                              >
                                {t.excluded ? "Include" : "Exclude"}
                              </button>
                              <button
                                aria-pressed={t.reviewed}
                                onClick={() =>
                                  update({ ...t, reviewed: !t.reviewed })
                                }
                              >
                                {t.reviewed ? "Undo review" : "Reviewed"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="spend-actions">
                <button
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage + 1} of {pageCount}
                </span>
                <button
                  disabled={currentPage + 1 >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
              <details>
                <summary>Manage imported statements</summary>
                {doc.sources.map((s) => (
                  <div className="spend-source" key={s.id}>
                    <span>{s.name}</span>
                    <button
                      onClick={() => {
                        if (
                          !confirm(
                            `Remove ${s.name} and its transactions from this session?`,
                          )
                        )
                          return;
                        setDoc((d) => ({
                          ...d,
                          sources: d.sources.filter((x) => x.id !== s.id),
                          transactions: d.transactions.filter(
                            (t) => t.sourceId !== s.id,
                          ),
                        }));
                        if (source === s.id) setSource("");
                        setEdit(null);
                      }}
                    >
                      Remove statement
                    </button>
                  </div>
                ))}
              </details>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Download a plaintext CSV? Anyone with this file can read its transaction details.",
                    )
                  )
                    download(
                      transactionsCSV(doc.transactions),
                      "spend-transactions.csv",
                      "text/csv;charset=utf-8",
                    );
                }}
              >
                Export all transactions (unencrypted CSV)
              </button>
            </section>
          </div>
        </>
      )}
      <section hidden={view !== "backup"} className="cards-panel">
        <h3>Keep a private backup</h3>
        <p className="cards-note">
          Optional password-encrypted file, saved to your device. Contains
          normalized transactions and statement filenames, not the original
          statement or its PDF password. Nothing is saved to your account. You
          need this file and its passphrase to restore later.
        </p>
        <div className="spend-fields">
          <Field label="Backup passphrase">
            <input
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="At least 10 characters for a new backup"
            />
          </Field>
          <Field label="Encrypted backup file">
            <input
              ref={backupInput}
              type="file"
              accept=".spendvault"
              disabled={busy}
              onChange={(e) => setBackup(e.target.files?.[0] || null)}
            />
          </Field>
        </div>
        <div className="spend-actions">
          <button
            disabled={
              busy || !doc.transactions.length || passphrase.length < 10
            }
            onClick={saveBackup}
          >
            Download encrypted backup
          </button>
          <button disabled={busy || !backup || !passphrase} onClick={restore}>
            Unlock backup locally
          </button>
        </div>
      </section>
    </section>
  );
}
