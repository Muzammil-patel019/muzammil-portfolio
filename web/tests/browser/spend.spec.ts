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
function pdfFixture() {
  const stream =
    "BT /F1 12 Tf 40 760 Td (Date Description Amount) Tj 0 -25 Td (01/11/2026 SYNTHETIC SHOP 100.00) Tj 0 -25 Td (02/11/2026 Interest charge 20.00) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
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
