import { parseDelimited, parseAmount } from "./analyzer";
export type StatementSheet = { name: string; rows: string[][] };
export type PDFLine = { cells: { text: string; x: number; width: number }[] };
export function pdfTable(pages: PDFLine[][]) {
  const all = pages.flat(),
    header = all.find((line) => {
      const s = line.cells.map((c) => c.text).join(" ");
      return /debit|withdrawal/i.test(s) && /credit|deposit/i.test(s);
    });
  const findAnchor = (pattern: RegExp) =>
    header?.cells.find((c) => pattern.test(c.text));
  const d = findAnchor(/debit|withdrawal/i),
    c = findAnchor(/credit|deposit/i),
    balance = findAnchor(/balance/i),
    separate = !!(d && c);
  const rows: string[][] = [
      separate
        ? ["Date", "Description", "Debit", "Credit"]
        : ["Date", "Description", "Amount", "Type"],
    ],
    warnings: string[] = [];
  let ambiguous = 0;
  const dateRegex =
    /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/](?:\d{1,2}|[A-Za-z]{3,9})(?:[-/]\d{2,4})?)\s+(.*)$/;
  for (const line of all) {
    const text = line.cells
        .map((c) => c.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      match = dateRegex.exec(text);
    if (!match) continue;
    if (separate && d && c) {
      const anchors = [
        { key: "debit", cell: d },
        { key: "credit", cell: c },
        ...(balance ? [{ key: "balance", cell: balance }] : []),
      ];
      let debit = "",
        credit = "";
      const first = Math.min(d.x, c.x) - 15;
      const amounts = line.cells.filter(
        (v) =>
          v.x >= first &&
          /^[₹\s\d,().+\-]*(?:\.\d{1,2})?\s*(?:CR|DR)?$/i.test(v.text) &&
          /\d/.test(v.text),
      );
      for (const value of amounts) {
        const center = value.x + value.width / 2,
          nearest = anchors
            .slice()
            .sort(
              (a, b) =>
                Math.abs(center - a.cell.x - a.cell.width / 2) -
                Math.abs(center - b.cell.x - b.cell.width / 2),
            )[0];
        if (nearest.key === "debit") debit = value.text;
        if (nearest.key === "credit") credit = value.text;
      }
      const description = line.cells
        .filter((v) => v.x < first)
        .map((v) => v.text)
        .join(" ")
        .replace(
          new RegExp(
            "^" + match[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*",
          ),
          "",
        )
        .trim();
      if ((debit || credit) && description)
        rows.push([match[1], description, debit, credit]);
      else ambiguous++;
    } else {
      const amounts = [
        ...match[2].matchAll(
          /(?:[₹$£€]\s*)?[+-]?\(?\d[\d,]*\.\d{2}\)?\s*(?:CR|DR)?/gi,
        ),
      ];
      const amount = amounts.at(-1);
      if (
        amounts.length !== 1 ||
        !amount ||
        !new RegExp(
          amount[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$",
          "i",
        ).test(match[2])
      ) {
        ambiguous++;
        continue;
      }
      try {
        parseAmount(amount[0]);
        rows.push([
          match[1],
          match[2].slice(0, amount.index).trim(),
          amount[0],
          /\bCR\b/i.test(amount[0]) ? "credit" : "",
        ]);
      } catch {
        ambiguous++;
      }
    }
  }
  if (ambiguous)
    warnings.push(
      `${ambiguous} date-like PDF rows had ambiguous amounts or columns and were not imported. Use the bank CSV/XLSX export to include them reliably.`,
    );
  return { rows, warnings };
}
export async function readStatementFile(
  file: File,
  password: string,
  progress: (message: string) => void,
  signal: AbortSignal,
): Promise<{ sheets: StatementSheet[]; warnings: string[] }> {
  if (file.size > 20000000) throw Error("Limit each file to 20 MB.");
  const extension = file.name.toLowerCase().split(".").at(-1);
  if (extension === "csv" || extension === "txt") {
    const rows = parseDelimited(await file.text());
    return { sheets: [{ name: "Transactions", rows }], warnings: [] };
  }
  if (extension === "xlsx") {
    progress("Reading spreadsheet locally…");
    const { default: read } = await import("read-excel-file/browser");
    const sheets = await read(file);
    if (sheets.length > 30)
      throw Error(
        "This workbook has too many sheets. Export the transaction sheet as CSV.",
      );
    return {
      sheets: sheets.map((s) => {
        if (s.data.length > 25000) throw Error("A sheet exceeds 25,000 rows.");
        return {
          name: s.sheet,
          rows: s.data.map((row) =>
            row.map((cell) =>
              cell instanceof Date
                ? cell.toISOString().slice(0, 10)
                : cell === null
                  ? ""
                  : String(cell),
            ),
          ),
        };
      }),
      warnings: [],
    };
  }
  if (extension !== "pdf")
    throw Error(
      "Use a PDF, CSV or XLSX statement. Legacy .xls files need to be saved as .xlsx or CSV first.",
    );
  const pdf = await import("pdfjs-dist");
  pdf.GlobalWorkerOptions.workerSrc = new URL(
    "/vendor/pdfjs/pdf.worker.min.mjs",
    location.origin,
  ).href;
  const task = pdf.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    password: password || undefined,
    useWasm: false,
    disableFontFace: true,
    useSystemFonts: true,
    disableAutoFetch: true,
  });
  const abort = () => {
    void task.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    const document = await task.promise;
    if (document.numPages > 150)
      throw Error(
        "This PDF exceeds 150 pages. Export smaller statements or CSV.",
      );
    const pages: PDFLine[][] = [];
    for (let i = 1; i <= document.numPages; i++) {
      if (signal.aborted) throw Error("Cancelled");
      progress(`Reading PDF page ${i} of ${document.numPages} on this device…`);
      const page = await document.getPage(i),
        content = await page.getTextContent(),
        groups = new Map<number, PDFLine["cells"]>();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 2) * 2,
          items = groups.get(y) || [];
        items.push({
          text: item.str.trim(),
          x: item.transform[4],
          width: item.width,
        });
        groups.set(y, items);
      }
      pages.push(
        [...groups.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([, cells]) => ({ cells: cells.sort((a, b) => a.x - b.x) })),
      );
      page.cleanup();
    }
    const result = pdfTable(pages);
    if (result.rows.length < 2)
      throw Error(
        "No reliable text transaction rows were found. Scanned PDFs need OCR, which is not enabled. Use the bank CSV/XLSX export, or a text-based PDF.",
      );
    return {
      sheets: [{ name: "PDF transactions", rows: result.rows }],
      warnings: [
        "PDF layouts vary. Review the detected amounts, debit/credit direction and missing rows before importing.",
        ...result.warnings,
      ],
    };
  } catch (e) {
    if ((e as { name?: string }).name === "PasswordException")
      throw Error(
        (e as { code?: number }).code === 2
          ? "That PDF password did not work. Try again locally."
          : "This PDF is password-protected. Enter its password below and read it again.",
      );
    throw e;
  } finally {
    signal.removeEventListener("abort", abort);
    await task.destroy();
  }
}
