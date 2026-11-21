import { z } from "zod";
export const spendCategories = [
  "Shopping",
  "Food & dining",
  "Groceries",
  "Transport",
  "Travel",
  "Entertainment",
  "Bills & EMI",
  "Health",
  "Cash withdrawal",
  "Transfers & payments",
  "Fees & charges",
  "Other",
  "Credits / refunds",
] as const;
export const chargeTypes = [
  "none",
  "Annual / renewal fee",
  "Late / penalty fee",
  "Interest / finance charge",
  "Forex / currency markup",
  "Cash advance fee",
  "Processing / service fee",
  "Tax on charges",
  "Other fee",
] as const;
export type ChargeType = (typeof chargeTypes)[number];
export const transactionSchema = z
  .object({
    id: z.string().max(100),
    sourceId: z.string().max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().max(2000),
    amountMinor: z.number().int().min(1).max(1000000000000),
    direction: z.enum(["debit", "credit"]),
    currency: z.enum(["INR", "USD", "EUR", "GBP", "AED", "SAR"]),
    category: z.enum(spendCategories),
    chargeType: z.enum(chargeTypes),
    excluded: z.boolean(),
    reviewed: z.boolean(),
    importNote: z.string().max(500).optional(),
  })
  .strict();
export const spendDocumentSchema = z
  .object({
    version: z.literal(1),
    sources: z
      .array(
        z
          .object({ id: z.string().max(100), name: z.string().max(200) })
          .strict(),
      )
      .max(50),
    transactions: z.array(transactionSchema).max(20000),
  })
  .strict();
export type SpendTransaction = z.infer<typeof transactionSchema>;
export type SpendDocument = z.infer<typeof spendDocumentSchema>;
export type Mapping = {
  headerRow: number;
  date: number;
  description: number;
  debit: number;
  credit: number;
  amount: number;
  direction: number;
  mode: "separate" | "single";
  sign: "positive-debit" | "negative-debit";
  dateOrder: "DMY" | "MDY";
  year: number;
  currency: SpendTransaction["currency"];
};
export type Issue = { row: number; reason: string };
export function parseDelimited(text: string): string[][] {
  if (text.length > 20000000)
    throw Error("The text file is too large. Limit each file to 20 MB.");
  // Detect separators outside quoted fields; commas inside amounts/narrations
  // must not turn a semicolon/tab export into a comma-separated file.
  const candidates = [",", ";", "\t"];
  const delimiter = candidates
    .map((d) => {
      const counts: number[] = [];
      let quoted = false,
        count = 0;
      for (
        let i = 0;
        i < Math.min(text.length, 65536) && counts.length < 40;
        i++
      ) {
        const c = text[i];
        if (c === '"') {
          if (quoted && text[i + 1] === '"') i++;
          else quoted = !quoted;
        } else if (!quoted && c === d) count++;
        else if (!quoted && c === "\n") {
          counts.push(count);
          count = 0;
        }
      }
      counts.push(count);
      const frequencies = new Map<number, number>();
      for (const n of counts)
        if (n > 0) frequencies.set(n, (frequencies.get(n) || 0) + 1);
      return {
        d,
        score: Math.max(
          0,
          ...[...frequencies].map(
            ([n, frequency]) => frequency * 100 + Math.min(n, 99),
          ),
        ),
      };
    })
    .sort((a, b) => b.score - a.score)[0].d;
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted) quoted = false;
      else if (!cell.trim()) quoted = true;
      else cell += c;
    } else if (c === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
    if (rows.length > 25000)
      throw Error("Too many rows. Limit a file to 25,000 rows.");
  }
  if (quoted)
    throw Error(
      "The CSV has an unfinished quoted field. Export it again from your bank.",
    );
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const dateNames = [
  "date",
  "transactiondate",
  "txndate",
  "postingdate",
  "valuedate",
  "transdate",
];
const descNames = [
  "description",
  "transactiondescription",
  "narration",
  "particulars",
  "details",
  "transactiondetails",
  "merchant",
  "remarks",
];
export function detectMapping(rows: string[][]): Mapping {
  let headerRow = rows.findIndex(
    (r, i) =>
      i < 40 &&
      r.some((c) => dateNames.includes(normalized(c))) &&
      r.some((c) => descNames.includes(normalized(c))),
  );
  if (headerRow < 0) headerRow = 0;
  const names = (rows[headerRow] || []).map(normalized),
    find = (aliases: string[]) => names.findIndex((n) => aliases.includes(n));
  const debit = find([
      "debit",
      "debitamount",
      "withdrawal",
      "withdrawals",
      "withdrawalamt",
      "withdrawalamount",
      "dr",
      "amountdr",
    ]),
    credit = find([
      "credit",
      "creditamount",
      "deposit",
      "deposits",
      "depositamt",
      "depositamount",
      "cr",
      "amountcr",
    ]);
  return {
    headerRow,
    date: find(dateNames),
    description: find(descNames),
    debit,
    credit,
    amount: find([
      "amount",
      "transactionamount",
      "amountinr",
      "billingamount",
      "netamount",
    ]),
    direction: find([
      "type",
      "drcr",
      "debitcredit",
      "transactiontype",
      "crdr",
      "dc",
    ]),
    mode: debit >= 0 || credit >= 0 ? "separate" : "single",
    sign: "positive-debit",
    dateOrder: "DMY",
    year: new Date().getFullYear(),
    currency: "INR",
  };
}
export function parseAmount(raw: string): {
  minor: number;
  negative: boolean;
  marker: "debit" | "credit" | null;
} | null {
  let value = raw.trim().replace(/^Rs\.?\s*/i, "");
  if (!value || /^(?:-|—|nil|n\/a)$/i.test(value)) return null;
  const marker = /CR\s*$/i.test(value)
    ? "credit"
    : /DR\s*$/i.test(value)
      ? "debit"
      : null;
  const negative = /^-|^\(|-$/.test(value);
  value = value
    .replace(/(?:CR|DR)\s*$/i, "")
    .replace(/\b(?:INR|USD|EUR|GBP|AED|SAR)\b/gi, "")
    .replace(/[₹$£€(),\s]/g, "")
    .replace(/^-|^\+|-$/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw Error("Amount is not a number with up to two decimal places.");
  const [whole, frac = ""] = value.split("."),
    minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > 1000000000000)
    throw Error("Amount exceeds the supported range.");
  return { minor, negative, marker };
}
export function parseStatementDate(
  raw: string,
  order: "DMY" | "MDY",
  year: number,
): string | null {
  const text = raw
    .trim()
    .replace(/^(\d{1,2})\s+([a-z]{3,9})\s+(\d{2,4})(?=\s|$)/i, "$1-$2-$3")
    .replace(/\./g, "/")
    .split(/[T ]/)[0];
  let d: number, m: number, y: number;
  let parts = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (parts) {
    y = Number(parts[1]);
    m = Number(parts[2]);
    d = Number(parts[3]);
  } else {
    parts = /^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/.exec(text);
    if (parts) {
      d = Number(parts[order === "DMY" ? 1 : 2]);
      m = Number(parts[order === "DMY" ? 2 : 1]);
      y = parts[3] ? Number(parts[3]) : year;
    } else {
      parts = /^(\d{1,2})[-/]([a-z]{3,9})[-/](\d{2,4})$/i.exec(text);
      if (!parts) return null;
      d = Number(parts[1]);
      m =
        [
          "jan",
          "feb",
          "mar",
          "apr",
          "may",
          "jun",
          "jul",
          "aug",
          "sep",
          "oct",
          "nov",
          "dec",
        ].indexOf(parts[2].slice(0, 3).toLowerCase()) + 1;
      y = Number(parts[3]);
    }
  }
  if (y < 100) y += y >= 70 ? 1900 : 2000;
  if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCDate() === d && date.getUTCMonth() === m - 1
    ? date.toISOString().slice(0, 10)
    : null;
}
export function suggestLabels(
  description: string,
  direction: "debit" | "credit",
): { category: SpendTransaction["category"]; chargeType: ChargeType } {
  const s = description.toLowerCase();
  let chargeType: ChargeType = "none";
  if (
    /\b(?:cgst|sgst|igst)\b|^(?:gst|tax)\b|gst.*(?:fee|charge|interest)/.test(s)
  )
    chargeType = "Tax on charges";
  else if (
    /annual.*(?:fee|charge)|renewal.*(?:fee|charge)|membership.*fee/.test(s)
  )
    chargeType = "Annual / renewal fee";
  else if (
    /late.*(?:fee|charge|payment)|over.?limit.*(?:fee|charge)|penalt|cheque.*return.*charge|bounce.*charge/.test(
      s,
    )
  )
    chargeType = "Late / penalty fee";
  else if (
    /finance.*charge|interest\s+on\s+emi|interest.*(?:charge|debit)|(?:debit|purchase|cash).*interest|^interest$/.test(
      s,
    )
  )
    chargeType = "Interest / finance charge";
  else if (
    /forex|foreign.*(?:mark.?up|fee|charge)|currency.*(?:mark.?up|fee)|\bdcc\b/.test(
      s,
    )
  )
    chargeType = "Forex / currency markup";
  else if (/cash.*(?:advance|withdrawal).*(?:fee|charge)/.test(s))
    chargeType = "Cash advance fee";
  else if (
    /(?:proc|processing).*fee|processing.*charge|convenience.*fee|service.*charge|fuel.*surcharge|surcharge/.test(
      s,
    )
  )
    chargeType = "Processing / service fee";
  else if (/\bfee\b|\bcharges?\b/.test(s)) chargeType = "Other fee";
  if (chargeType !== "none") return { category: "Fees & charges", chargeType };
  const checks: [RegExp, SpendTransaction["category"]][] = [
    [
      /transfer\s+to\s+(?:merchant\s+)?emi|credit.?card.*(?:payment|bill)|payment.*(?:received|thank|card)|\b(?:neft|imps|rtgs)\b|self.?transfer/,
      "Transfers & payments",
    ],
    [/\batm\b|cash withdrawal/, "Cash withdrawal"],
    [/swiggy|zomato|restaurant|cafe|coffee|dining/, "Food & dining"],
    [
      /grocery|groceries|supermarket|bigbasket|blinkit|zepto|dmart/,
      "Groceries",
    ],
    [/uber|ola\b|metro|petrol|fuel|toll|parking/, "Transport"],
    [/hotel|airline|flight|irctc|railway|booking\.com/, "Travel"],
    [/netflix|spotify|youtube|cinema|movie|hotstar/, "Entertainment"],
    [/hospital|pharmacy|medical|clinic/, "Health"],
    [
      /electric|broadband|telecom|recharge|insurance|\bemi\b|loan/,
      "Bills & EMI",
    ],
    [/amazon|flipkart|myntra|shopping|retail/, "Shopping"],
  ];
  const match = checks.find(([pattern]) => pattern.test(s));
  return {
    category:
      match?.[1] || (direction === "credit" ? "Credits / refunds" : "Other"),
    chargeType,
  };
}
export function normalizeRows(
  rows: string[][],
  mapping: Mapping,
  sourceId: string,
) {
  if (mapping.date < 0 || mapping.description < 0)
    throw Error("Choose a date column and a description column.");
  if (mapping.mode === "single" && mapping.amount < 0)
    throw Error("Choose an amount column.");
  if (mapping.mode === "separate" && mapping.debit < 0 && mapping.credit < 0)
    throw Error("Choose a debit or credit column.");
  const transactions: SpendTransaction[] = [],
    issues: Issue[] = [];
  const header = rows[mapping.headerRow].map((s) => s.trim().toLowerCase());
  const noteIndex = header.indexOf("import note"),
    excludedIndex = header.indexOf("exclude from totals");
  for (let i = mapping.headerRow + 1; i < rows.length; i++) {
    const row = rows[i],
      description = (row[mapping.description] || "").trim();
    try {
      const date = parseStatementDate(
        row[mapping.date] || "",
        mapping.dateOrder,
        mapping.year,
      );
      if (!date) {
        issues.push({
          row: i + 1,
          reason:
            "No valid transaction date. Header, summary or unrecognized date row.",
        });
        continue;
      }
      if (
        !description ||
        /opening balance|closing balance|brought forward|carried forward|total amount due|minimum amount due/i.test(
          description,
        )
      ) {
        issues.push({
          row: i + 1,
          reason: "Balance/summary row or missing description; not imported.",
        });
        continue;
      }
      let amountMinor = 0,
        direction: "debit" | "credit" = "debit";
      if (mapping.mode === "separate") {
        const debit =
            mapping.debit < 0 ? null : parseAmount(row[mapping.debit] || ""),
          credit =
            mapping.credit < 0 ? null : parseAmount(row[mapping.credit] || "");
        if (debit?.minor && credit?.minor)
          throw Error(
            "Both debit and credit contain amounts; review this row in the source.",
          );
        if (debit?.negative || credit?.negative)
          throw Error(
            "A debit/credit column contains a negative value; use single-amount mapping or review the source.",
          );
        amountMinor = debit?.minor || credit?.minor || 0;
        direction = debit?.minor ? "debit" : "credit";
      } else {
        const amount = parseAmount(row[mapping.amount] || "");
        if (!amount?.minor) throw Error("No non-zero transaction amount.");
        amountMinor = amount.minor;
        const type = (row[mapping.direction] || "").trim();
        if (
          type &&
          !amount.marker &&
          !/^(?:cr|c|credit|deposit|refund|dr|d|debit|withdrawal|m)$/i.test(
            type,
          )
        )
          throw Error(
            "Unrecognised debit/credit indicator. Correct this row or choose the proper direction column before importing.",
          );
        direction =
          amount.marker ||
          (/^(?:cr|c|credit|deposit|refund)$/i.test(type)
            ? "credit"
            : /^(?:dr|d|debit|withdrawal)$/i.test(type)
              ? "debit"
              : mapping.sign === "positive-debit"
                ? amount.negative
                  ? "credit"
                  : "debit"
                : amount.negative
                  ? "debit"
                  : "credit");
      }
      if (!amountMinor)
        throw Error("Zero/empty amount; not included in totals.");
      const labels = suggestLabels(description, direction);
      const specialEMI =
        /^(?:M)$/i.test((row[mapping.direction] || "").trim()) ||
        /transfer\s+to\s+(?:merchant\s+)?emi/i.test(description);
      let importNote =
        (noteIndex >= 0 ? (row[noteIndex] || "").slice(0, 500) : "") ||
        (specialEMI
          ? "EMI installment/conversion entry: excluded from spending until reviewed. Check its direction and use Include only if appropriate."
          : "");

      const missingOCRDirection =
        importNote.includes("OCR") &&
        mapping.mode === "single" &&
        mapping.direction >= 0 &&
        !(row[mapping.direction] || "").trim();
      if (missingOCRDirection)
        importNote = (
          "OCR direction is blank: excluded until checked and corrected. " +
          importNote
        ).slice(0, 500);
      transactions.push(
        transactionSchema.parse({
          id: sourceId + "-" + i,
          sourceId,
          date,
          description: description.slice(0, 2000),
          amountMinor,
          direction,
          currency: mapping.currency,
          ...labels,
          excluded:
            missingOCRDirection ||
            specialEMI ||
            (excludedIndex >= 0 &&
              /^(?:true|yes|1)$/i.test(row[excludedIndex] || "")),
          reviewed: false,
          ...(importNote ? { importNote } : {}),
        }),
      );
    } catch (e) {
      issues.push({ row: i + 1, reason: (e as Error).message });
    }
  }
  return { transactions, issues };
}
export const duplicateKey = (t: SpendTransaction) =>
  [
    t.date,
    t.description.toLowerCase().replace(/\s+/g, " ").trim(),
    t.amountMinor,
    t.direction,
    t.currency,
  ].join("|");
export function summarizeTransactions(rows: SpendTransaction[]) {
  if (new Set(rows.filter((t) => !t.excluded).map((t) => t.currency)).size > 1)
    throw Error("Select one currency before calculating totals.");
  const active = rows.filter((t) => !t.excluded),
    debits = active.filter((t) => t.direction === "debit"),
    credits = active.filter((t) => t.direction === "credit");
  const sum = (items: SpendTransaction[]) =>
      items.reduce((n, t) => n + t.amountMinor, 0),
    fees = debits.filter((t) => t.chargeType !== "none"),
    feeCredits = credits.filter((t) => t.chargeType !== "none"),
    transfers = debits.filter(
      (t) => t.chargeType === "none" && t.category === "Transfers & payments",
    ),
    purchases = debits.filter(
      (t) => t.chargeType === "none" && t.category !== "Transfers & payments",
    );
  const group = (
    items: SpendTransaction[],
    key: (t: SpendTransaction) => string,
  ) => {
    const values = new Map<
      string,
      { label: string; amountMinor: number; count: number }
    >();
    for (const t of items) {
      const label = key(t),
        v = values.get(label) || { label, amountMinor: 0, count: 0 };
      v.amountMinor += t.amountMinor;
      v.count++;
      values.set(label, v);
    }
    return [...values.values()].sort((a, b) => b.amountMinor - a.amountMinor);
  };
  return {
    outflows: sum(debits),
    credits: sum(credits),
    purchases: sum(purchases),
    charges: sum(fees),
    chargeCredits: sum(feeCredits),
    transfers: sum(transfers),
    count: active.length,
    categories: group(purchases, (t) => t.category),
    merchants: group(purchases, (t) => t.description),
    chargesByType: group(fees, (t) => t.chargeType),
    months: group(debits, (t) => t.date.slice(0, 7)).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  };
}
export function transactionsCSV(rows: SpendTransaction[]) {
  const cell = (s: string) =>
    '"' + (/^[\s]*[=+\-@]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      [
        "Date",
        "Description",
        "Debit/Credit",
        "Amount",
        "Currency",
        "Category",
        "Charge type",
        "Excluded",
        "Reviewed",
        "Import note",
      ],
      ...rows.map((t) => [
        t.date,
        t.description,
        t.direction,
        (t.amountMinor / 100).toFixed(2),
        t.currency,
        t.category,
        t.chargeType,
        String(t.excluded),
        String(t.reviewed),
        t.importNote || "",
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
