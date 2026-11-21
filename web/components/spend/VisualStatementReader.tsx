"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  fullPage,
  parseLayoutPreset,
  tableFromWords,
  validRegion,
  wordsInRegion,
  type TableRegion,
  type VisualRows,
} from "@/lib/spend/visual";
import { createLocalOCR } from "@/lib/spend/ocr";
async function renderPage(
  doc: PDFDocumentProxy,
  number: number,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
) {
  const page = await doc.getPage(number),
    base = page.getViewport({ scale: 1 });
  const scale = Math.min(
    2.4,
    1600 / base.width,
    Math.sqrt(3000000 / (base.width * base.height)),
  );
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  if (signal.aborted) throw Error("Cancelled");
  const task = page.render({ canvas, viewport });
  const abort = () => task.cancel();
  signal.addEventListener("abort", abort, { once: true });
  try {
    await task.promise;
  } finally {
    signal.removeEventListener("abort", abort);
  }
  return { page, base };
}
function cropCanvas(source: HTMLCanvasElement, region: TableRegion) {
  const result = document.createElement("canvas");
  result.width = Math.max(
    1,
    Math.round((region.right - region.left) * source.width),
  );
  result.height = Math.max(
    1,
    Math.round((region.bottom - region.top) * source.height),
  );
  result
    .getContext("2d")!
    .drawImage(
      source,
      region.left * source.width,
      region.top * source.height,
      (region.right - region.left) * source.width,
      (region.bottom - region.top) * source.height,
      0,
      0,
      result.width,
      result.height,
    );
  return result;
}
export default function VisualStatementReader({
  file,
  password,
  onExtract,
  onClose,
}: {
  file: File;
  password: string;
  onExtract: (result: VisualRows) => void;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [last, setLast] = useState(1);
  const [drawing, setDrawing] = useState(false);
  const [region, setRegion] = useState<TableRegion>(fullPage),
    [guides, setGuides] = useState("18,78,94"),
    [useGuides, setUseGuides] = useState(false);
  const [status, setStatus] = useState("Opening PDF locally…"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    selection = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number } | null>(null);
  const operation = useRef<AbortController | null>(null),
    epoch = useRef(0);
  useEffect(() => {
    setDoc(null);
    setReady(false);
    setError("");
    let disposed = false;
    let destroy: (() => Promise<void>) | null = null;
    void (async () => {
      try {
        const pdf = await import("pdfjs-dist");
        if (disposed) return;
        pdf.GlobalWorkerOptions.workerSrc = new URL(
          "/vendor/pdfjs/pdf.worker.min.mjs",
          location.origin,
        ).href;
        const task = pdf.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
          password: password || undefined,
          standardFontDataUrl: new URL(
            "/vendor/pdfjs/standard_fonts/",
            location.origin,
          ).href,
          useSystemFonts: true,
          useWasm: false,
        });
        destroy = () => task.destroy();
        if (disposed) {
          await task.destroy();
          return;
        }
        const document = await task.promise;
        if (document.numPages > 150)
          throw Error("Limit visual reading to PDFs with 150 pages or fewer.");
        if (!disposed) {
          setDoc(document);
          setStatus(
            "Select the transaction table. Include its column headings when possible.",
          );
        }
      } catch (e) {
        if (!disposed)
          setError(
            (e as { name?: string }).name === "PasswordException"
              ? "Enter the PDF password above, then reopen the visual reader."
              : "Could not open this PDF locally. Check the file and password.",
          );
      }
    })();
    return () => {
      disposed = true;
      epoch.current++;
      operation.current?.abort();
      if (destroy) void destroy();
    };
  }, [file, password]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    const abort = new AbortController();
    setReady(false);
    setError("");
    void renderPage(doc, page, canvas.current, abort.signal)
      .then(() => {
        if (!abort.signal.aborted) setReady(true);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "This page could not be rendered. Try another page or a bank export.",
          );
      });
    return () => abort.abort();
  }, [doc, page]);
  const position = (e: React.PointerEvent) => {
    const box = selection.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)),
    };
  };
  async function extract(ocr: boolean) {
    if (!doc || !ready || !validRegion(region)) {
      setError("Select a larger table region first.");
      return;
    }
    if (last < page || last > doc.numPages || last - page >= 5) {
      setError(
        "Choose a range of up to five pages, starting with the preview page.",
      );
      return;
    }
    const current = ++epoch.current,
      abort = new AbortController();
    operation.current?.abort();
    operation.current = abort;
    setBusy(true);
    setError("");
    const offscreen = document.createElement("canvas");
    let reader: Awaited<ReturnType<typeof createLocalOCR>> | null = null;
    try {
      if (ocr)
        reader = await createLocalOCR(abort.signal, (m) => {
          if (current === epoch.current) setStatus(m);
        });
      const results: VisualRows[] = [];
      for (let i = page; i <= last; i++) {
        if (abort.signal.aborted) throw Error("Cancelled");
        setStatus(
          `${ocr ? "OCR" : "Reading text"} on page ${i} of ${last}, on this device…`,
        );
        const { page: pdfPage, base } = await renderPage(
          doc,
          i,
          offscreen,
          abort.signal,
        );
        if (ocr) {
          const cropped = cropCanvas(offscreen, region);
          try {
            results.push(
              await reader!.read(
                cropped,
                useGuides ? guides.split(",").map(Number) : null,
                i,
              ),
            );
          } finally {
            cropped.width = 0;
            cropped.height = 0;
          }
        } else {
          const text = await pdfPage.getTextContent();
          const words = text.items.flatMap((item) => {
            if (!("str" in item) || !item.str.trim()) return [];
            const [x, y] = base.convertToViewportPoint(
              item.transform[4],
              item.transform[5],
            );
            return [
              { text: item.str, x, y: base.height - y, width: item.width },
            ];
          });
          const selected = wordsInRegion(
            words,
            base.width,
            base.height,
            region,
          );
          if (!selected.length)
            throw Error(
              `No readable text in the page ${i} selection. Use the local OCR button for an image or scan.`,
            );
          results.push(
            tableFromWords(
              selected,
              (region.right - region.left) * base.width,
              (region.bottom - region.top) * base.height,
              useGuides ? guides.split(",").map(Number) : null,
              `Selected table from page ${i}. Check the extracted rows against this page.`,
            ),
          );
        }
      }
      if (current !== epoch.current || abort.signal.aborted) return;
      const first = results[0];
      if (
        results.some(
          (r) => JSON.stringify(r.rows[0]) !== JSON.stringify(first.rows[0]),
        )
      )
        throw Error(
          "These pages have different column layouts. Read them separately or use consistent column guides.",
        );
      const rows = [first.rows[0], ...results.flatMap((r) => r.rows.slice(1))];
      if (rows.length < 2)
        throw Error(
          "No table rows were found. Adjust the region or use local OCR.",
        );
      onExtract({
        rows,
        warnings: results.flatMap((r) => r.warnings),
        manual: first.manual,
      });
      setStatus(
        "Table sent to the preview below. Nothing has been imported yet.",
      );
    } catch (e) {
      if (current === epoch.current && !abort.signal.aborted)
        setError((e as Error).message || "Could not read this selection.");
    } finally {
      offscreen.width = 0;
      offscreen.height = 0;
      if (reader) await reader.close().catch(() => {});
      if (current === epoch.current) setBusy(false);
    }
  }
  return (
    <section
      className="spend-visual cards-panel"
      aria-label="Visual statement reader"
    >
      <div className="spend-section-heading">
        <h3>Read the table visually</h3>
        <button onClick={onClose}>Close visual reader</button>
      </div>
      <p className="cards-note">
        Drag around the transaction table, including its headings. Text reading
        is fastest. For a scan or unreadable text, use local English OCR. First
        OCR use downloads the reader files; your statement stays on this device.
        Review every amount and date.
      </p>
      {doc && (
        <div className="spend-fields">
          <label className="cards-field">
            <span>Preview / first page</span>
            <input
              type="number"
              min={1}
              max={doc.numPages}
              value={page}
              disabled={busy}
              onChange={(e) => {
                const n = Math.max(
                  1,
                  Math.min(doc.numPages, Number(e.target.value) || 1),
                );
                setPage(n);
                setLast(n);
              }}
            />
          </label>
          <label className="cards-field">
            <span>Last page to read (up to five)</span>
            <input
              type="number"
              min={page}
              max={Math.min(doc.numPages, page + 4)}
              value={last}
              disabled={busy}
              onChange={(e) => setLast(Number(e.target.value))}
            />
          </label>
        </div>
      )}
      <p role="status" aria-live="polite">
        {status}
      </p>
      {error && (
        <p role="alert" className="cards-notice">
          {error}
        </p>
      )}
      <button
        disabled={!ready || busy}
        aria-pressed={drawing}
        onClick={() => setDrawing((d) => !d)}
      >
        {drawing ? "Drag over the table now" : "Select table area"}
      </button>
      <div
        className="spend-visual-page"
        ref={selection}
        style={{ touchAction: drawing ? "none" : "pan-x pan-y pinch-zoom" }}
        onPointerDown={(e) => {
          if (!ready || busy || !drawing) return;
          drag.current = position(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const p = position(e),
            s = drag.current;
          setRegion({
            left: Math.min(s.x, p.x),
            right: Math.max(s.x, p.x),
            top: Math.min(s.y, p.y),
            bottom: Math.max(s.y, p.y),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
          setDrawing(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <canvas ref={canvas} aria-label="Original statement page" />
        {ready && (
          <div
            className="spend-visual-region"
            style={{
              left: `${region.left * 100}%`,
              top: `${region.top * 100}%`,
              width: `${(region.right - region.left) * 100}%`,
              height: `${(region.bottom - region.top) * 100}%`,
            }}
          >
            {useGuides &&
              guides.split(",").map((g, i) => (
                <span
                  key={i}
                  style={{
                    left: `${Math.max(0, Math.min(100, Number(g) || 0))}%`,
                  }}
                />
              ))}
          </div>
        )}
      </div>
      <details>
        <summary>Reuse this layout next time</summary>
        <p className="cards-note">
          Save only the table crop and column guides. The file contains no
          statement text, account details or PDF password. Check the selection
          against every new statement.
        </p>
        <div className="spend-actions">
          <button
            disabled={busy || !ready}
            onClick={() => {
              try {
                const preset = parseLayoutPreset(
                  JSON.stringify({ version: 1, region, guides, useGuides }),
                );
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(preset, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "statement-layout.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Save layout settings
          </button>
        </div>
        <label className="cards-field">
          <span>Load saved layout settings</span>
          <input
            type="file"
            accept=".json"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 10000)
                  throw Error("Layout settings must be smaller than 10 KB.");
                const preset = parseLayoutPreset(await file.text());
                setRegion(preset.region);
                setGuides(preset.guides);
                setUseGuides(preset.useGuides);
                setError("");
                setStatus(
                  "Layout loaded locally. Check the crop and guides on this statement before reading.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                e.target.value = "";
              }
            }}
          />
        </label>
      </details>
      <details>
        <summary>Fine-tune selection and column guides</summary>
        <div className="spend-fields">
          {(["left", "top", "right", "bottom"] as const).map((side) => (
            <label className="cards-field" key={side}>
              <span>Table {side} (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(region[side] * 100)}
                disabled={busy}
                onChange={(e) =>
                  setRegion({
                    ...region,
                    [side]:
                      Math.max(0, Math.min(100, Number(e.target.value))) / 100,
                  })
                }
              />
            </label>
          ))}
        </div>
        <label className="spend-check">
          <input
            type="checkbox"
            checked={useGuides}
            disabled={busy}
            onChange={(e) => setUseGuides(e.target.checked)}
          />
          Use my column guides instead of automatic columns
        </label>
        <label className="cards-field">
          <span>Column guides within selected table (%)</span>
          <input
            value={guides}
            disabled={busy}
            onChange={(e) => setGuides(e.target.value)}
            placeholder="18,78,94"
          />
        </label>
      </details>
      <div className="spend-actions">
        <button disabled={!ready || busy} onClick={() => void extract(false)}>
          Read selected table text
        </button>
        <button disabled={!ready || busy} onClick={() => void extract(true)}>
          Read selected table with OCR
        </button>
        <button disabled={busy} onClick={() => setRegion(fullPage)}>
          Select whole page
        </button>
        {busy && (
          <button
            onClick={() => {
              epoch.current++;
              operation.current?.abort();
              setBusy(false);
              setStatus("Cancelled. No rows were imported.");
            }}
          >
            Cancel reading
          </button>
        )}
      </div>
      <p className="cards-note">
        Using this table replaces the current unconfirmed preview. Apply the
        same selection to the chosen page range, then check the preview before
        importing. Different layouts can be read separately.
      </p>
    </section>
  );
}
