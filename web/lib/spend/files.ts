import { parseDelimited } from "./analyzer";
import { groupPDFLines, pdfTable, type PDFLine } from "./pdf";
export { pdfTable, type PDFLine } from "./pdf";
export type StatementSheet = { name: string; rows: string[][] };
export async function readStatementFile(
  file: File,
  password: string,
  progress: (message: string) => void,
  signal: AbortSignal,
): Promise<{
  sheets: StatementSheet[];
  warnings: string[];
  pdfPages?: PDFLine[][];
  pdfWidths?: number[];
}> {
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
    const widths: number[] = [];
    for (let i = 1; i <= document.numPages; i++) {
      if (signal.aborted) throw Error("Cancelled");
      progress(`Reading PDF page ${i} of ${document.numPages} on this device…`);
      const page = await document.getPage(i),
        content = await page.getTextContent(),
        items: { text: string; x: number; y: number; width: number }[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        items.push({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
        });
      }
      pages.push(groupPDFLines(items));
      widths.push(page.getViewport({ scale: 1 }).width);
      page.cleanup();
    }
    const result = pdfTable(pages);
    if (result.rows.length < 2) {
      if (!result.textLines)
        throw Error(
          "No readable text was found in this PDF. It may be a scanned statement. Open the visual reader and use local OCR, or use the bank CSV/XLSX export.",
        );
      result.warnings.push(
        `Readable text was found on ${document.numPages} page(s), but the transaction layout could not be recognised (${result.datedRows} date-like rows). This does not mean the PDF is scanned. No transactions were imported automatically. Use the layout editor below to arrange the columns, or import a bank CSV/XLSX export. Your file and password stayed on this device.`,
      );
    }
    return {
      pdfPages: pages,
      pdfWidths: widths,
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
