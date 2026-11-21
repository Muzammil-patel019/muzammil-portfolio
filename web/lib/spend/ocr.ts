import { tableFromWords, ocrGeometryWords } from "./visual";
async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => {});
    throw Error("Cancelled");
  }
  let listener: () => void = () => {};
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        listener = () => reject(Error("Cancelled"));
        signal.addEventListener("abort", listener, { once: true });
      }),
    ]);
  } finally {
    signal.removeEventListener("abort", listener);
  }
}
export async function createLocalOCR(
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  if (signal.aborted) throw Error("Cancelled");
  const local = (path: string) => new URL(path, location.origin).href;
  const starting = createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: local("/vendor/ocr/worker.min.js"),
    corePath: local("/vendor/ocr/core"),
    langPath: local("/vendor/ocr/lang"),
    workerBlobURL: false,
    cacheMethod: "none",
    gzip: true,
    logger: (m) => {
      if (!signal.aborted)
        progress(`Local OCR: ${m.status} ${Math.round(m.progress * 100)}%`);
    },
  });
  const worker = await abortable(
    starting.then(async (w) => {
      if (signal.aborted) {
        await w.terminate();
        throw Error("Cancelled");
      }
      return w;
    }),
    signal,
  );
  const abort = () => {
    void worker.terminate();
  };
  if (signal.aborted) {
    await worker.terminate();
    throw Error("Cancelled");
  }
  signal.addEventListener("abort", abort, { once: true });
  try {
    await abortable(
      worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
        user_defined_dpi: "200",
      }),
      signal,
    );
  } catch (e) {
    signal.removeEventListener("abort", abort);
    await worker.terminate();
    throw e;
  }
  return {
    async read(
      canvas: HTMLCanvasElement,
      boundaries: number[] | null,
      page: number,
    ) {
      if (signal.aborted) throw Error("Cancelled");
      const { data } = await abortable(
        worker.recognize(canvas, {}, { text: true, blocks: true }),
        signal,
      );
      if (signal.aborted) throw Error("Cancelled");
      const words = (data.blocks || [])
        .flatMap((b) =>
          b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
        )
        .filter((w) => w.text.trim());
      if (!words.length)
        throw Error(
          "OCR found no readable words in this selection. Try a larger, sharper table region.",
        );
      // Scale OCR pixels back to page-like units so row grouping uses the same tolerance.
      const scale = canvas.width / 800;
      const note = `OCR from page ${page}; reported page confidence ${Math.round(data.confidence)}%. Check every amount, date and credit/debit marker against the original. Confidence is not a guarantee of correctness.`;
      return tableFromWords(
        ocrGeometryWords(words, canvas.height, scale),
        canvas.width / scale,
        canvas.height / scale,
        boundaries,
        note,
      );
    },
    async close() {
      signal.removeEventListener("abort", abort);
      await worker.terminate();
    },
  };
}
