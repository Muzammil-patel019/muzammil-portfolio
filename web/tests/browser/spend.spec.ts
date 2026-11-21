import { test, expect } from "@playwright/test";
import { encryptedPDF, workbook } from "./spend-fixtures";
import { readFile } from "node:fs/promises";
const csv = `Date,Description,Debit,Credit,Balance
01/11/2026,SYNTHETIC AMAZON,1000,,9000
02/11/2026,Annual membership fee,500,,8500
03/11/2026,Interest charge,100,,8400
03/11/2026,CGST on charges,54,,8346
04/11/2026,NEFT credit card bill,2000,,6346
05/11/2026,Salary,,10000,16346
06/11/2026,Annual fee reversal,,500,16846`;
async function open(page: import("@playwright/test").Page) {
  await page.goto("/dashboard?demo=1&tab=spend");
  await expect(
    page.getByRole("heading", { name: "Spend Analyzer", exact: true }),
  ).toBeVisible();
}
async function importCSV(page: import("@playwright/test").Page) {
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  await expect(
    page.getByText("7 transactions ready", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
}
test("local statement flow reconciles totals, supports review, and never uploads transaction data", async ({
  page,
}) => {
  await open(page);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(r.method()))
      writes.push(`${r.url()} ${r.postData() || ""}`);
  });
  await importCSV(page);
  const metrics = page.getByLabel("Statement totals");
  await expect(metrics).toContainText("₹1,000.00");
  await expect(metrics).toContainText("₹654.00");
  await expect(metrics).toContainText("₹2,000.00");
  await expect(metrics).toContainText("₹10,500.00");
  await expect(page.locator(".spend-reconcile")).toContainText("₹3,654.00");
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "SYNTHETIC AMAZON" });
  await row.getByRole("button", { name: "Exclude", exact: true }).click();
  await expect(metrics).toContainText("₹0.00");
  await row.getByRole("button", { name: "Include", exact: true }).click();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(
    page.getByLabel("Transaction date", { exact: true }),
  ).toBeFocused();
  await page.getByLabel("Transaction amount", { exact: true }).fill("1200");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await expect(metrics).toContainText("₹1,200.00");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Spend Analyzer", exact: true })
    .click();
  await expect(metrics).toContainText("₹1,200.00");
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  await expect(metrics).toBeVisible();
  await expect(
    page.getByLabel("Statement file", { exact: true }),
  ).not.toBeVisible();
  expect(writes).toEqual([]);
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    ),
  ).not.toContain("SYNTHETIC AMAZON");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({ path: "/tmp/spend-mobile.png", fullPage: true });
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await page.screenshot({ path: "/tmp/spend-dark.png", fullPage: true });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Clear session", exact: true })
    .click();
  await expect(metrics).toHaveCount(0);
});
test("encrypted backup restores edits locally and rejects an incorrect passphrase", async ({
  page,
}) => {
  await open(page);
  await importCSV(page);
  await page.getByRole("button", { name: "Backup", exact: true }).click();
  await page
    .getByLabel("Backup passphrase", { exact: true })
    .fill("synthetic-passphrase");
  const saved = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download encrypted backup", exact: true })
    .click();
  const downloaded = await saved,
    path = await downloaded.path();
  expect(path).toBeTruthy();
  const bytes = await readFile(path!);
  expect(bytes.toString()).not.toContain("SYNTHETIC AMAZON");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Clear session", exact: true })
    .click();
  await page.getByRole("button", { name: "Backup", exact: true }).click();
  await page
    .getByLabel("Encrypted backup file", { exact: true })
    .setInputFiles({
      name: "test.spendvault",
      mimeType: "application/json",
      buffer: bytes,
    });
  await page
    .getByLabel("Backup passphrase", { exact: true })
    .fill("wrong-password");
  await page
    .getByRole("button", { name: "Unlock backup locally", exact: true })
    .click();
  await expect(
    page.locator(".spend-analyzer").getByRole("alert"),
  ).toContainText("Could not unlock");
  await page
    .getByLabel("Backup passphrase", { exact: true })
    .fill("synthetic-passphrase");
  await page
    .getByRole("button", { name: "Unlock backup locally", exact: true })
    .click();
  await expect(page.getByLabel("Statement totals")).toContainText("₹654.00");
  await page.reload();
  await expect(page.getByLabel("Statement totals")).toHaveCount(0);
});
// A real, tiny PDF with a cross-reference table: exercises the self-hosted PDF.js worker.
function pdfFixture(customStream?: string) {
  const stream =
    customStream ||
    "BT /F1 12 Tf 40 760 Td (Date Description Amount) Tj 0 -25 Td (01/11/2026 SYNTHETIC SHOP 100.00) Tj 0 -25 Td (02/11/2026 Interest charge 20.00) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let data = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(data));
    data += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(data);
  data += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(data);
}
test("text PDF is read through the local worker without uploading bytes", async ({
  page,
}) => {
  await open(page);
  const posts: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "synthetic.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(),
  });
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  await expect(
    page.getByText("2 transactions ready", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.getByLabel("Statement totals")).toContainText("₹100.00");
  await expect(page.getByLabel("Statement totals")).toContainText("₹20.00");
  expect(posts).toEqual([]);
  expect(errors).toEqual([]);
});

test("XLSX worksheets import locally with explicit debit and credit mapping", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "synthetic.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(workbook, "base64"),
  });
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  await expect(
    page.getByText("2 transactions ready", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.getByLabel("Statement totals")).toContainText("₹100.00");
  await expect(page.getByLabel("Statement totals")).toContainText("₹20.00");
});
test("password-protected PDFs stay local and retry with the correct password", async ({
  page,
}) => {
  await open(page);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.postData() || "");
  });
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "synthetic-protected.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(encryptedPDF, "base64"),
  });
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  const alert = page.locator(".spend-analyzer").getByRole("alert");
  await expect(alert).toContainText("password-protected");
  await page.getByLabel("PDF password (only if needed)").fill("wrong-pass");
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  await expect(alert).toContainText("did not work");
  await page
    .getByLabel("PDF password (only if needed)")
    .fill("synthetic-pdf-pass");
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  await expect(
    page.getByText("2 transactions ready", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel("PDF password (only if needed)")).toHaveValue(
    "",
  );
  expect(writes).toEqual([]);
});

test("ICICI-style card PDF handles split baselines, posting dates, reward points and wrapped credits locally", async ({
  page,
}) => {
  await open(page);
  const at = (x: number, y: number, text: string) =>
    `BT /F1 9 Tf 1 0 0 1 ${x} ${y} Tm (${text.replaceAll("(", "\\(").replaceAll(")", "\\)")}) Tj ET`;
  const stream = [
    at(10, 760, "Transaction Date"),
    at(110, 760, "Posting Date"),
    at(210, 760, "Transaction Details"),
    at(490, 760, "Amount(INR)"),
    at(640, 760, "Reward Points"),
    at(10, 720.8, "01/11/2026"),
    at(110, 720.3, "02/11/2026"),
    at(210, 719.6, "SYNTHETIC AMAZON SHOP"),
    at(510, 720.1, "1,250.00"),
    at(655, 720, "25"),
    at(10, 690, "03 Nov 2026"),
    at(110, 690, "04 Nov 2026"),
    at(210, 690, "PAYMENT RECEIVED"),
    at(210, 678, "THANK YOU"),
    at(510, 678, "1,000.00"),
    at(575, 678, "CR"),
    at(655, 678, "0"),
    at(10, 650, "05.11.2026"),
    at(110, 650, "06.11.2026"),
    at(210, 650, "Finance charge"),
    at(510, 650, "49.00"),
    at(655, 650, "0"),
  ].join("\n");
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "synthetic-icici.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(stream),
  });
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  await expect(
    page.getByText("3 transactions ready", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  const metrics = page.getByLabel("Statement totals");
  await expect(metrics).toContainText("₹1,250.00");
  await expect(metrics).toContainText("₹49.00");
  await expect(metrics).toContainText("₹1,000.00");
  expect(writes).toEqual([]);
});
test("readable unsupported PDFs are distinguished from scans without importing guessed rows", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "synthetic-unsupported.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(
      "BT /F1 12 Tf 40 760 Td (Synthetic readable statement with an unsupported table layout) Tj ET",
    ),
  });
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  await expect(page.locator(".spend-import")).toContainText(
    "Readable text was found",
  );
  await expect(page.locator(".spend-import")).toContainText(
    "does not mean the PDF is scanned",
  );
  await expect(
    page.getByRole("button", { name: "Confirm import", exact: true }),
  ).toBeDisabled();
});

test("SBI statement imports D/C rows, flags EMI conversions and preserves an undated tax row", async ({
  page,
}) => {
  await open(page);
  const at = (x: number, y: number, text: string) =>
    `BT /F1 9 Tf 1 0 0 1 ${x} ${y} Tm (${text.replaceAll("(", "\\(").replaceAll(")", "\\)")}) Tj ET`;
  const lines = [
    at(10, 760, "Date"),
    at(160, 760, "Transaction Details"),
    at(620, 760, "Amount"),
  ];
  const row = (
    y: number,
    date: string,
    desc: string,
    amount: string,
    marker: string,
  ) =>
    lines.push(
      ...(date ? [at(10, y, date)] : []),
      at(160, y, desc),
      at(620, y, amount),
      ...(marker ? [at(720, y, marker)] : []),
    );
  row(730, "13 Oct 26", "MERCHANT EMI PROC FEE (EXCL TAX 9.00)", "45.00", "D");
  row(710, "18 Oct 26", "FUEL SURCHARGE WAIVER EXCL TAX", "5.00", "C");
  row(690, "01 Nov 26", "PAYMENT RECEIVED SYNTHETIC", "1,000.00", "C");
  row(670, "12 Nov 26", "FP EMI 02/06(EXCL TAX 20.00)", "200.00", "M");
  row(650, "12 Nov 26", "INTEREST ON EMI", "50.00", "D");
  row(630, "", "IGST DB @ 18.00%", "9.00", "D");
  lines.push(at(160, 610, "TRANSACTIONS FOR SYNTHETIC USER"));
  row(590, "13 Oct 26", "TRANSFER TO MERCHANT EMI", "3,000.00", "");
  row(570, "14 Oct 26", "SYNTHETIC SHOP", "100.00", "D");
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "synthetic-sbi.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(lines.join("\n")),
  });
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  await expect(
    page.getByText("8 transactions ready", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".spend-import")).toContainText("undated tax");
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.getByLabel("Statement totals")).toContainText("₹104.00");
  await expect(page.getByLabel("Statement totals")).toContainText("₹100.00");
  await expect(page.getByLabel("Statement totals")).toContainText("₹1,005.00");
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "FP EMI" }),
  ).toContainText("Excluded");
  await expect(
    page.getByRole("row").filter({ hasText: "IGST DB" }),
  ).toContainText("Date inferred");
});
test("unknown PDF layouts can be mapped and corrected locally without bank-specific code", async ({
  page,
}) => {
  await open(page);
  const stream =
    "BT /F1 9 Tf 1 0 0 1 10 720 Tm (CUSTOM SHOP) Tj ET BT /F1 9 Tf 1 0 0 1 300 720 Tm (13 Oct 26) Tj ET BT /F1 9 Tf 1 0 0 1 500 720 Tm (D) Tj ET BT /F1 9 Tf 1 0 0 1 650 720 Tm (75.00) Tj ET";
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "unknown-layout.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(stream),
  });
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  await expect(page.locator(".spend-import")).toContainText(
    "Readable text was found",
  );
  await page
    .getByText("Layout not right? Adjust PDF columns", { exact: true })
    .click();
  await page
    .getByLabel("Column boundaries (%)", { exact: true })
    .fill("30,60,75");
  await page
    .getByRole("button", { name: "Apply column layout", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Date column", exact: true })
    .selectOption("1");
  await page
    .getByRole("combobox", { name: "Description column", exact: true })
    .selectOption("0");
  await page
    .getByRole("combobox", { name: "Amount column", exact: true })
    .selectOption("3");
  await page
    .getByRole("combobox", {
      name: "Debit / credit indicator column",
      exact: true,
    })
    .selectOption("2");
  await expect(
    page.getByText("1 transactions ready", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("View or correct the extracted table", { exact: true })
    .click();
  await page
    .getByLabel("Editable statement table (CSV)", { exact: true })
    .fill(
      "Date,Description,Amount,Type\n13 Oct 26,CUSTOM SHOP CORRECTED,80.00,D",
    );
  await page
    .getByRole("button", { name: "Apply corrected table", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.getByLabel("Statement totals")).toContainText("₹80.00");
  expect(writes).toEqual([]);
});

test("visual PDF reader shows the original page and extracts a selected table without uploads", async ({
  page,
}) => {
  await open(page);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "visual.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(),
  });
  await page
    .getByRole("button", { name: "Open visual reader / scans", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Read selected table text", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByLabel("Original statement page", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Read selected table text", exact: true })
    .click();
  await expect(
    page.getByText("2 transactions ready", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".spend-import")).toContainText(
    "Selected table from page 1",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "/tmp/visual-reader-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.getByLabel("Statement totals")).toContainText("₹100.00");
  await expect(
    page.getByLabel("Visual statement reader", { exact: true }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
});
test("image-only PDF can be read by the real same-origin local OCR engine", async ({
  page,
}) => {
  test.setTimeout(120000);
  const { scannedStatement } = await import("./scanned-statement-fixture");
  await open(page);
  const requests: { url: string; method: string }[] = [];
  page
    .context()
    .on("request", (r) => requests.push({ url: r.url(), method: r.method() }));
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "synthetic-scan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(scannedStatement, "base64"),
  });
  await page
    .getByRole("button", { name: "Open visual reader / scans", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Read selected table with OCR",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Read selected table with OCR", exact: true })
    .click();
  await expect(
    page.getByText("3 transactions ready", { exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(page.locator(".spend-import")).toContainText("OCR from page 1");
  await expect(
    page.getByRole("button", { name: "Confirm import", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel(
      "I compared OCR amounts, dates and debit/credit markers with the original page",
      { exact: true },
    )
    .check();
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  const metrics = page.getByLabel("Statement totals");
  await expect(metrics).toContainText("₹100.00");
  await expect(metrics).toContainText("₹20.00");
  await expect(metrics).toContainText("₹0.00");
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  const refund = page.getByRole("row").filter({ hasText: "REFUND" });
  await expect(refund).toContainText("Excluded");
  await expect(refund).toContainText(
    "OCR did not read an explicit debit/credit direction",
  );
  await refund.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Transaction direction", exact: true })
    .selectOption("credit");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await refund.getByRole("button", { name: "Include", exact: true }).click();
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  await expect(metrics).toContainText("₹25.00");
  expect(requests.filter((r) => r.method === "POST")).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(
    requests.filter(
      (r) => r.url.startsWith("http") && new URL(r.url).origin !== origin,
    ),
  ).toEqual([]);
  expect(
    requests.some((r) => r.url.includes("/vendor/ocr/worker.min.js")),
  ).toBe(true);
});

test("visual reader cancellation does not import delayed OCR results", async ({
  page,
}) => {
  const { scannedStatement } = await import("./scanned-statement-fixture");
  await open(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "cancel-scan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(scannedStatement, "base64"),
  });
  await page
    .getByRole("button", { name: "Open visual reader / scans", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Read selected table with OCR",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Read selected table with OCR", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel reading", exact: true })
    .click();
  await expect(
    page.getByText("Cancelled. No rows were imported.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close visual reader", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm import", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("transactions can be corrected, filtered and reconciled before importing", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "review.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Read statement", exact: true })
    .click();
  await expect(
    page.getByText("7 transactions ready", { exact: true }),
  ).toBeVisible();
  const review = page.getByLabel("Review extracted transactions", {
    exact: true,
  });
  const row = review.getByRole("row").filter({ hasText: "SYNTHETIC AMAZON" });
  await row.getByRole("button", { name: "Correct row", exact: true }).click();
  await page.getByLabel("Preview amount", { exact: true }).fill("1250");
  await page
    .getByRole("button", { name: "Save preview correction", exact: true })
    .click();
  await expect(row).toContainText("1250.00");
  await expect(row).toContainText("Reviewed");
  await page
    .getByRole("combobox", { name: "Preview rows", exact: true })
    .selectOption("unreviewed");
  await expect(
    review.getByRole("row").filter({ hasText: "SYNTHETIC AMAZON" }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Preview rows", exact: true })
    .selectOption("all");
  await page
    .getByText("Compare transaction totals (optional)", { exact: true })
    .click();
  await page
    .getByLabel("Expected transaction debit total", { exact: true })
    .fill("3904");
  await expect(
    page.getByText("Debits: Matches the included transaction total.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page
    .getByRole("button", { name: "Confirm import", exact: true })
    .click();
  await expect(page.getByLabel("Statement totals")).toContainText("₹1,250.00");
});
test("visual crop settings can be downloaded and reused without statement data", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Statement file", { exact: true }).setInputFiles({
    name: "preset-source.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(),
  });
  await page
    .getByRole("button", { name: "Open visual reader / scans", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Read selected table text", exact: true }),
  ).toBeEnabled();
  await page.getByText("Reuse this layout next time", { exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save layout settings", exact: true })
    .click();
  const file = await download;
  const contents = await readFile((await file.path())!, "utf8");
  expect(Object.keys(JSON.parse(contents)).sort()).toEqual([
    "guides",
    "region",
    "useGuides",
    "version",
  ]);
  expect(contents).not.toContain("SYNTHETIC");
  expect(contents).not.toContain("password");
  const preset = JSON.parse(contents);
  preset.region.top = 0.1;
  await page
    .getByLabel("Load saved layout settings", { exact: true })
    .setInputFiles({
      name: "saved-layout.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(preset)),
    });
  await expect(
    page.getByText(
      "Layout loaded locally. Check the crop and guides on this statement before reading.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByText("Fine-tune selection and column guides", { exact: true })
    .click();
  await expect(page.getByLabel("Table top (%)", { exact: true })).toHaveValue(
    "10",
  );
});
