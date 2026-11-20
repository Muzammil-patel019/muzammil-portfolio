import { copyFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await mkdir(new URL("public/vendor/pdfjs/", root), { recursive: true });
await copyFile(
  new URL("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", root),
  new URL("public/vendor/pdfjs/pdf.worker.min.mjs", root),
);
