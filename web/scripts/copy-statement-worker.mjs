import { copyFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await mkdir(new URL("public/vendor/pdfjs/", root), { recursive: true });
await copyFile(
  new URL("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", root),
  new URL("public/vendor/pdfjs/pdf.worker.min.mjs", root),
);

// Self-host the rendering fonts and OCR assets; never fetch a CDN at runtime.
const { cp, readdir } = await import("node:fs/promises");
await cp(
  new URL("node_modules/pdfjs-dist/standard_fonts/", root),
  new URL("public/vendor/pdfjs/standard_fonts/", root),
  { recursive: true },
);
await mkdir(new URL("public/vendor/ocr/core/", root), { recursive: true });
await mkdir(new URL("public/vendor/ocr/lang/", root), { recursive: true });
await copyFile(
  new URL("node_modules/tesseract.js/dist/worker.min.js", root),
  new URL("public/vendor/ocr/worker.min.js", root),
);
for (const file of await readdir(
  new URL("node_modules/tesseract.js-core/", root),
)) {
  if (file.endsWith(".wasm.js") || file.endsWith(".wasm") || file === "LICENSE")
    await copyFile(
      new URL("node_modules/tesseract.js-core/" + file, root),
      new URL("public/vendor/ocr/core/" + file, root),
    );
}
await copyFile(
  new URL(
    "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    root,
  ),
  new URL("public/vendor/ocr/lang/eng.traineddata.gz", root),
);
await copyFile(
  new URL("node_modules/tesseract.js/LICENSE.md", root),
  new URL("public/vendor/ocr/LICENSE.md", root),
);
