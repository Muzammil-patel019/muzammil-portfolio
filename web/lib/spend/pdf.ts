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
  requireDirection = false,
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
  let marker: string | undefined;
  let explicitDirection = false;
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
      .filter((c) => center(c) >= edge)
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
    const markers = [
      ...new Set(
        cells
          .filter((c) => center(c) >= edge)
          .map(
            (c) =>
              /^(CR|DR|C|D|M)\.?$/i.exec(c.text.trim())?.[1] ||
              /\d[.,]\d{2}\s*(CR|DR|C|D|M)\.?$/i.exec(c.text.trim())?.[1],
          )
          .filter(Boolean)
          .map((m) => m!.toUpperCase()),
      ),
    ];
    if (markers.length > 1) return null;
    marker = markers[0];
    direction =
      picked.nearest.kind === "credit"
        ? "credit"
        : picked.nearest.kind === "debit"
          ? "debit"
          : parsed.marker ||
            (marker === "CR" || marker === "C"
              ? "credit"
              : marker === "DR" || marker === "D"
                ? "debit"
                : parsed.negative
                  ? "credit"
                  : "debit");
    explicitDirection =
      picked.nearest.kind !== "amount" ||
      !!marker ||
      !!parsed.marker ||
      parsed.negative;
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
            !/^(?:CR|DR|C|D|M)$/i.test(c.text.trim()),
        )
        .map((c) => c.text)
        .join(" "),
    );
    description = pdfDatePrefix(description)?.rest || description;
  } else {
    const marked =
      /^(.*?)\s+((?:INR|Rs\.?|[₹$£€])?\s*[+\-]?\(?\d[\d,]*\.\d{2}\)?)\s*(CR|DR|C|D|M)\.?$/i.exec(
        text,
      );
    if (marked) {
      // Reject unlabelled forex/balance pairs; SBI's explicitly labelled EXCL TAX
      // figures belong to the narration, not the posted amount column.
      const narrative = marked[1].replace(
        /\(EXCL(?:UDING)?\s+TAX\s+[\d,.]+\)/gi,
        "",
      );
      if (/\d[\d,]*\.\d{2}/.test(narrative)) return null;
      const parsed = parseAmount(marked[2]);
      if (!parsed?.minor) return null;
      marker = marked[3].toUpperCase();
      explicitDirection = true;
      amount = (parsed.minor / 100).toFixed(2);
      direction = marker === "C" || marker === "CR" ? "credit" : "debit";
      description = marked[1];
    } else {
      const amounts = [
        ...text.matchAll(
          /(?:INR|Rs\.?|[₹$£€])?\s*[+\-]?\(?\d[\d,]*\.\d{2}\)?\s*(?:CR|DR)?/gi,
        ),
      ];
      if (amounts.length !== 1) return null;
      const token = amounts[0],
        tail = text.slice((token.index || 0) + token[0].length).trim();
      if (tail && !(pointHint && /^\d+$/.test(tail))) return null;
      const parsed = parseAmount(token[0]);
      if (!parsed?.minor) return null;
      amount = (parsed.minor / 100).toFixed(2);
      direction = parsed.marker || (parsed.negative ? "credit" : "debit");
      explicitDirection = !!parsed.marker || parsed.negative;
      description = text.slice(0, token.index).trim();
    }
  }
  if (
    !description ||
    /^(?:opening|closing|total|minimum|payment due)\b/i.test(description)
  )
    return null;
  const row = [
    first.date,
    description,
    direction === "debit" ? amount : "",
    direction === "credit" ? amount : "",
  ];
  if (marker === "M")
    row.push(
      "M-marked EMI entry: excluded from spending until reviewed. Include only if it belongs in this analysis.",
      "true",
    );
  else if (
    /transfer\s+to\s+(?:merchant\s+)?emi|transfer\s+to\s+flexipay/i.test(
      description,
    )
  )
    row.push(
      "EMI conversion/transfer: excluded to avoid counting converted principal as a new purchase. Review before including.",
      "true",
    );
  if (requireDirection && !explicitDirection) {
    row[4] = [
      row[4],
      "OCR did not read an explicit debit/credit direction. Excluded until the direction is corrected and reviewed.",
    ]
      .filter(Boolean)
      .join(" ");
    row[5] = "true";
  }
  return row;
}
export function pdfTable(
  pages: PDFLine[][],
  options: { requireDirection?: boolean } = {},
) {
  const rows: string[][] = [
      [
        "Date",
        "Description",
        "Debit",
        "Credit",
        "Import note",
        "Exclude from totals",
      ],
    ],
    warnings: string[] = [];
  let ambiguous = 0,
    datedRows = 0,
    carried: Layout | null = null;
  let inheritedDates = 0,
    reviewOnly = 0;
  for (const lines of pages) {
    let layout = carried,
      block: PDFLine[] = [];
    let lastDate: string | null = null;
    const pointHint = lines.some((l) =>
      /amount.*(?:reward.?points|points|mcc)/i.test(lineText(l)),
    );
    const flush = () => {
      if (!block.length) return;
      let parsed: string[] | null = null;
      try {
        parsed = readBlock(block, layout, pointHint, options.requireDirection);
      } catch {
        /* Kept out of totals when a row is ambiguous. */
      }
      if (parsed) {
        rows.push(parsed);
        if (parsed[5] === "true") reviewOnly++;
      } else ambiguous++;
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
        lastDate = pdfDatePrefix(text)!.date;
        datedRows++;
      } else if (
        lastDate &&
        layout?.amount &&
        /^(?:IGST|CGST|SGST|GST)\b/i.test(text) &&
        /\b(?:D|C|DR|CR)\.?$/i.test(text) &&
        lines[i].cells.every((c) => c.x >= (layout!.description?.x || 0) - 15)
      ) {
        flush();
        const synthetic = {
          cells: [{ text: lastDate, x: 0, width: 0 }, ...lines[i].cells],
        };
        let parsed: string[] | null = null;
        try {
          parsed = readBlock(
            [synthetic],
            layout,
            pointHint,
            options.requireDirection,
          );
        } catch {
          /* skip ambiguous tax rows */
        }
        if (parsed) {
          parsed[4] = `Date inferred from the preceding transaction (${lastDate}); confirm against your statement.`;
          parsed[5] = "false";
          rows.push(parsed);
          inheritedDates++;
        } else ambiguous++;
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
          complete = readBlock(
            block,
            layout,
            pointHint,
            options.requireDirection,
          );
        } catch {
          /* continue to next line */
        }
        if (complete) {
          flush();
        } else block.push(lines[i]);
      } else {
        flush();
        if (
          /^(?:total|summary|page\s+\d|transactions?\s+for|important|interest calculation|domestic|international)\b/i.test(
            text,
          ) ||
          header
        )
          lastDate = null;
      }
    }
    flush();
  }
  if (ambiguous)
    warnings.push(
      `${ambiguous} date-like PDF rows could not be matched to one reliable transaction amount and were not imported. Check the preview against your statement; a bank CSV/XLSX export may be more reliable.`,
    );
  if (inheritedDates)
    warnings.push(
      `${inheritedDates} undated tax row(s) use the preceding transaction date. Review the flagged dates before importing.`,
    );
  if (reviewOnly)
    warnings.push(
      `${reviewOnly} flagged row(s) are retained but excluded from spending by default. Review them in Transactions; use Include only when appropriate.`,
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

/** Bank-independent recovery path: split readable PDF text by user-defined columns. */
export function pdfGridRows(
  pages: PDFLine[][],
  widths: number[],
  boundaries: number[],
) {
  if (
    !boundaries.length ||
    boundaries.length > 9 ||
    boundaries.some(
      (n, i) =>
        !Number.isFinite(n) ||
        n <= 0 ||
        n >= 100 ||
        (i > 0 && n <= boundaries[i - 1]),
    )
  )
    throw Error(
      "Column boundaries must increase from left to right, between 1 and 99 percent.",
    );
  const rows: string[][] = [
    Array.from({ length: boundaries.length + 1 }, (_, i) => `Column ${i + 1}`),
  ];
  pages.forEach((lines, page) => {
    const width = widths[page];
    if (!width || width <= 0)
      throw Error("PDF page dimensions are unavailable.");
    for (const line of lines) {
      const row = Array.from({ length: boundaries.length + 1 }, () => "");
      for (const cell of line.cells) {
        // Split a merged PDF text item into positioned words, rather than requiring
        // one PDF text item per bank column. Exact amounts still require review.
        const text = cell.text;
        for (const token of text.matchAll(/\S+/g)) {
          const x =
            ((cell.x +
              ((token.index || 0) / Math.max(1, text.length)) * cell.width) /
              width) *
            100;
          const index = boundaries.findIndex((b) => x < b);
          const column = index < 0 ? boundaries.length : index;
          row[column] += (row[column] ? " " : "") + token[0];
        }
      }
      if (row.some(Boolean)) rows.push(row);
      if (rows.length > 25000)
        throw Error(
          "The layout editor supports up to 25,000 rows. Use a smaller statement.",
        );
    }
  });
  return rows;
}
