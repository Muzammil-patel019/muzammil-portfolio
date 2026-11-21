import { groupPDFLines, pdfGridRows, pdfTable, type PDFLine } from "./pdf";
export type TableRegion = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export const fullPage: TableRegion = { left: 0, top: 0, right: 1, bottom: 1 };
export function validRegion(r: TableRegion) {
  return (
    [r.left, r.top, r.right, r.bottom].every(Number.isFinite) &&
    r.left >= 0 &&
    r.top >= 0 &&
    r.right <= 1 &&
    r.bottom <= 1 &&
    r.right - r.left >= 0.03 &&
    r.bottom - r.top >= 0.02
  );
}
export function tableFromWords(
  words: { text: string; x: number; y: number; width: number }[],
  width: number,
  height: number,
  boundaries: number[] | null,
  note: string,
) {
  const lines = groupPDFLines(words);
  const automatic = pdfTable([lines], {
    requireDirection: note.startsWith("OCR"),
  });
  const manual = boundaries !== null || automatic.rows.length < 2;
  const rows = manual
    ? pdfGridRows([lines], [width], boundaries || [18, 78, 94])
    : automatic.rows;
  if (manual) {
    rows[0].push("Import note");
    for (const row of rows.slice(1)) row.push(note);
  }
  if (!manual)
    for (const row of rows.slice(1))
      row[4] = [row[4], note].filter(Boolean).join(" ").slice(0, 500);
  return {
    rows,
    manual,
    warnings: [
      ...automatic.warnings,
      note,
      ...(manual
        ? [
            "Column mapping is required. Select the date, description, amount and debit/credit columns, then check the preview.",
          ]
        : []),
    ],
  };
}
export function wordsInRegion(
  words: { text: string; x: number; y: number; width: number }[],
  width: number,
  height: number,
  region: TableRegion,
) {
  if (!validRegion(region))
    throw Error("Select a larger table region within the page.");
  const left = region.left * width,
    top = region.top * height,
    right = region.right * width,
    bottom = region.bottom * height;
  return words
    .filter(
      (w) =>
        w.x + w.width / 2 >= left &&
        w.x + w.width / 2 <= right &&
        height - w.y >= top &&
        height - w.y <= bottom,
    )
    .map((w) => ({
      ...w,
      x: w.x - left,
      y: bottom - top - (height - w.y - top),
    }));
}
export type VisualRows = {
  rows: string[][];
  warnings: string[];
  manual: boolean;
};
export type { PDFLine };

export function ocrGeometryWords(
  words: {
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }[],
  canvasHeight: number,
  scale: number,
) {
  const rows: { top: number; bottom: number; words: typeof words }[] = [];
  for (const word of words
    .slice()
    .sort(
      (a, b) =>
        a.bbox.y0 + a.bbox.y1 - (b.bbox.y0 + b.bbox.y1) ||
        a.bbox.x0 - b.bbox.x0,
    )) {
    const row = rows.at(-1),
      box = word.bbox;
    const overlap = row
      ? Math.min(row.bottom, box.y1) - Math.max(row.top, box.y0)
      : 0;
    if (
      row &&
      overlap >=
        0.4 * Math.min(row.bottom - row.top, Math.max(1, box.y1 - box.y0))
    )
      row.words.push(word);
    else rows.push({ top: box.y0, bottom: box.y1, words: [word] });
  }
  return rows.flatMap((row) =>
    row.words.map((w) => ({
      text: w.text,
      x: w.bbox.x0 / scale,
      y: (canvasHeight - (row.top + row.bottom) / 2) / scale,
      width: (w.bbox.x1 - w.bbox.x0) / scale,
    })),
  );
}
