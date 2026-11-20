import { parseAmount, parseStatementDate } from "./analyzer";
export type PDFLine = { cells: { text: string; x: number; width: number }[] };
type Cell = PDFLine["cells"][number];
type Layout = {
  debit?: Cell;
  credit?: Cell;
  amount?: Cell;
  balance?: Cell;
  points?: Cell;
  description?: Cell;
};
const clean = (s: string) =>
  s
    .replace(/[\u00a0\u202f|]/g, " ")
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const lineText = (l: PDFLine) => clean(l.cells.map((c) => c.text).join(" "));
const dateToken = String.raw`(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3,9})(?:[-/.]\d{2,4})?|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|\d{1,2}[A-Za-z]{3}\d{2,4})`;
const datePrefix = new RegExp(
  `^(?:\\d{1,3}[.)]?\\s+)?(${dateToken})(?=\\s|$)\\s*(.*)$`,
  "i",
);
const nextDate = new RegExp(`^(${dateToken})(?=\\s|$)\\s*`, "i");
export function pdfDatePrefix(text: string) {
  const match = datePrefix.exec(clean(text));
  if (!match) return null;
  const date = match[1]
    .replace(/\./g, "/")
    .replace(/^(\d{1,2})([A-Za-z]{3})(\d{2,4})$/, "$1-$2-$3");
  if (
    !parseStatementDate(date, "DMY", 2000) &&
    !parseStatementDate(date, "MDY", 2000)
  )
    return null;
  let rest = match[2];
  // Transaction date and posting date can both precede the description.
  rest = rest.replace(nextDate, "").replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/, "");
  return { date, rest };
}
function layoutAt(lines: PDFLine[], index: number): Layout | null {
  const cells = lines
    .slice(Math.max(0, index - 1), index + 2)
    .flatMap((l) => l.cells);
  const description = cells.find((c) =>
    /^(?:transaction|txn)?(?:description|details|particulars|narration)$/.test(
      key(c.text),
    ),
  );
  const date = cells.some((c) =>
    /^(?:transaction|txn|posting|value)?date$/.test(key(c.text)),
  );
  if (!description || !date) return null;
  const debit = cells.find((c) =>
    /^(?:debit|withdrawals?)(?:amount|amt)?(?:inr|rs)?$/.test(key(c.text)),
  );
  const credit = cells.find((c) =>
    /^(?:credit|deposits?)(?:amount|amt)?(?:inr|rs)?$/.test(key(c.text)),
  );
  const amount = cells.find((c) =>
    /^(?:transaction|txn|billed|billing)?amount(?:inr|rs|inrs|rupees)?$/.test(
      key(c.text),
    ),
  );
  if (!(debit && credit) && !amount) return null;
  return {
    description,
    debit,
    credit,
    amount,
    balance: cells.find((c) =>
      /^(?:closing|running|available)?balance(?:inr|rs)?$/.test(key(c.text)),
    ),
    points: cells.find((c) =>
      /^(?:reward|rewards|earned)?points(?:earned)?$|^mcc$|^cashback(?:earned)?$/.test(
        key(c.text),
      ),
    ),
  };
}
const center = (c: Cell) => c.x + c.width / 2;
function amountCells(cells: Cell[]) {
  return cells.flatMap((c) => {
    const s = clean(c.text);
    const tokens = [
      ...s.matchAll(
        /(?:INR|Rs\.?|[₹$£€])?\s*[+\-]?\(?\d[\d,]*\.\d{2}\)?\s*(?:CR|DR)?/gi,
      ),
    ];
    if (
      !tokens.length &&
      /^(?:[₹$£€]\s*)?[+\-]?\(?\d[\d,]*\)?\s*(?:CR|DR)?$/i.test(s)
    )
      return [{ ...c, text: s }];
    return tokens.map((t) => ({
      text: t[0].trim(),
      x: c.x + ((t.index || 0) / s.length) * c.width,
      width: (t[0].length / s.length) * c.width,
    }));
  });
}
function readBlock(
  lines: PDFLine[],
  layout: Layout | null,
  pointHint: boolean,
) {
  const first = pdfDatePrefix(lineText(lines[0]));
  if (!first) return null;
  const cells = lines.flatMap((l) => l.cells),
    text = clean([first.rest, ...lines.slice(1).map(lineText)].join(" "));
  if (
    /^(?:opening|closing|previous|total|minimum|payment due|statement date)\b/i.test(
      text,
    )
  )
    return null;
  let amount = "",
    direction: "debit" | "credit" = "debit",
    description = "";
  if (layout) {
    const targets =
      layout.debit && layout.credit
        ? [
            { kind: "debit", cell: layout.debit },
            { kind: "credit", cell: layout.credit },
          ]
        : [{ kind: "amount", cell: layout.amount! }];
    const anchors = [
      ...targets,
      ...(layout.balance ? [{ kind: "balance", cell: layout.balance }] : []),
      ...(layout.points ? [{ kind: "points", cell: layout.points }] : []),
    ];
    const edge = Math.min(...targets.map((t) => t.cell.x)) - 20;
    const candidates = amountCells(cells)
      .filter((c) => c.x >= edge)
      .map((c) => ({
        cell: c,
        nearest: anchors
          .slice()
          .sort(
            (a, b) =>
              Math.abs(center(a.cell) - center(c)) -
              Math.abs(center(b.cell) - center(c)),
          )[0],
      }))
      .filter((c) => ["debit", "credit", "amount"].includes(c.nearest.kind));
    const nonzero = candidates.filter((c) => {
      try {
        return !!parseAmount(c.cell.text)?.minor;
      } catch {
        return false;
      }
    });
    // Multiple amounts in the same billed column are ambiguous: don't select a balance or forex value.
    if (nonzero.length !== 1) return null;
    const picked = nonzero[0],
      parsed = parseAmount(picked.cell.text)!;
    const marker = cells
      .find((c) => /^(?:CR|DR)$/i.test(c.text.trim()) && c.x >= edge)
      ?.text.trim()
      .toUpperCase();
    direction =
      picked.nearest.kind === "credit"
        ? "credit"
        : picked.nearest.kind === "debit"
          ? "debit"
          : parsed.marker ||
            (marker === "CR"
              ? "credit"
              : marker === "DR"
                ? "debit"
                : parsed.negative
                  ? "credit"
                  : "debit");
    amount = (parsed.minor / 100).toFixed(2);
    // Description stops before the amount/reward/balance columns, excluding both date columns.
    const descriptionEnd = Math.min(...anchors.map((a) => a.cell.x)) - 10;
    const descriptionStart = layout.description?.x || 0;
    description = clean(
      cells
        .filter(
          (c) =>
            c.x >= descriptionStart - 15 &&
            c.x < descriptionEnd &&
            !/^(?:CR|DR)$/i.test(c.text.trim()),
        )
        .map((c) => c.text)
        .join(" "),
    );
    description = pdfDatePrefix(description)?.rest || description;
  } else {
    const amounts = [
      ...text.matchAll(
        /(?:INR|Rs\.?|[₹$£€])?\s*[+\-]?\(?\d[\d,]*\.\d{2}\)?\s*(?:CR|DR)?/gi,
      ),
    ];
    if (amounts.length !== 1) return null;
    const token = amounts[0],
      tail = text.slice((token.index || 0) + token[0].length).trim();
    if (
      tail &&
      !(pointHint && /^\d+$/.test(tail)) &&
      !/^(?:CR|DR)$/i.test(tail)
    )
      return null;
    const parsed = parseAmount(
      token[0] + (/^(?:CR|DR)$/i.test(tail) ? " " + tail : ""),
    );
    if (!parsed?.minor) return null;
    amount = (parsed.minor / 100).toFixed(2);
    direction = parsed.marker || (parsed.negative ? "credit" : "debit");
    description = text.slice(0, token.index).trim();
  }
  if (
    !description ||
    /^(?:opening|closing|total|minimum|payment due)\b/i.test(description)
  )
    return null;
  return [
    first.date,
    description,
    direction === "debit" ? amount : "",
    direction === "credit" ? amount : "",
  ];
}
export function pdfTable(pages: PDFLine[][]) {
  const rows: string[][] = [["Date", "Description", "Debit", "Credit"]],
    warnings: string[] = [];
  let ambiguous = 0,
    datedRows = 0,
    carried: Layout | null = null;
  for (const lines of pages) {
    let layout = carried,
      block: PDFLine[] = [];
    const pointHint = lines.some((l) =>
      /amount.*(?:reward.?points|points|mcc)/i.test(lineText(l)),
    );
    const flush = () => {
      if (!block.length) return;
      let parsed: string[] | null = null;
      try {
        parsed = readBlock(block, layout, pointHint);
      } catch {
        /* Kept out of totals when a row is ambiguous. */
      }
      if (parsed) rows.push(parsed);
      else ambiguous++;
      block = [];
    };
    for (let i = 0; i < lines.length; i++) {
      const text = lineText(lines[i]),
        header = layoutAt(lines, i);
      if (header) {
        flush();
        layout = header;
        carried = header;
      }
      if (pdfDatePrefix(text)) {
        flush();
        block = [lines[i]];
        datedRows++;
      } else if (
        block.length &&
        block.length < 4 &&
        !header &&
        !/^(?:total|summary|payment|page\s+\d|important|interest calculation|reward points|transactions?|domestic|international)\b/i.test(
          text,
        )
      ) {
        // Join a wrapped transaction only while its amount hasn't been found.
        let complete: string[] | null = null;
        try {
          complete = readBlock(block, layout, pointHint);
        } catch {
          /* continue to next line */
        }
        if (complete) {
          flush();
        } else block.push(lines[i]);
      } else flush();
    }
    flush();
  }
  if (ambiguous)
    warnings.push(
      `${ambiguous} date-like PDF rows could not be matched to one reliable transaction amount and were not imported. Check the preview against your statement; a bank CSV/XLSX export may be more reliable.`,
    );
  return {
    rows,
    warnings,
    datedRows,
    textLines: pages.flat().filter((l) => lineText(l)).length,
  };
}
// PDF text fragments can have slightly different baselines. Rounding y into
// fixed buckets split a single ICICI row at bucket boundaries.
export function groupPDFLines(
  items: { text: string; x: number; y: number; width: number }[],
): PDFLine[] {
  const groups: { y: number; cells: Cell[] }[] = [];
  for (const item of items.slice().sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (!item.text.trim()) continue;
    const group = groups.at(-1);
    const cell = { text: item.text.trim(), x: item.x, width: item.width };
    if (group && Math.abs(group.y - item.y) <= 2.5) group.cells.push(cell);
    else groups.push({ y: item.y, cells: [cell] });
  }
  return groups.map((g) => ({ cells: g.cells.sort((a, b) => a.x - b.x) }));
}
