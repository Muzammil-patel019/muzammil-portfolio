import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectMapping,
  duplicateKey,
  normalizeRows,
  parseAmount,
  parseDelimited,
  parseStatementDate,
  summarizeTransactions,
  suggestLabels,
  transactionsCSV,
  type SpendDocument,
} from "../lib/spend/analyzer";
import { decryptSpend, encryptSpend } from "../lib/spend/backup";
import { pdfTable } from "../lib/spend/files";
const csv =
  'Date,Description,Debit,Credit,Balance\r\n01/11/2026,"AMAZON, ONLINE",1000,,9000\r\n02/11/2026,Annual membership fee,500,,8500\r\n03/11/2026,Interest charge,100,,8400\r\n03/11/2026,CGST on charges,54,,8346\r\n04/11/2026,NEFT credit card bill,2000,,6346\r\n05/11/2026,Salary,,10000,16346\r\n06/11/2026,Annual fee reversal,,500,16846\r\n07/11/2026,Closing balance,,,16846';
const rows = parseDelimited(csv);
const normalized = () => normalizeRows(rows, detectMapping(rows), "synthetic");
test("CSV parses quoted delimiters, escaped quotes, multiline fields and different separators", () => {
  assert.equal(rows[1][1], "AMAZON, ONLINE");
  assert.deepEqual(
    parseDelimited(
      'Date;Description;Amount\n01/11/26;"A; B\nC ""quoted""";10.00',
    ),
    [
      ["Date", "Description", "Amount"],
      ["01/11/26", 'A; B\nC "quoted"', "10.00"],
    ],
  );
  assert.equal(
    parseDelimited("Date\tDescription\tAmount\n01/11/26\tMerchant\t10")[1][2],
    "10",
  );
  assert.equal(
    parseDelimited(
      "Date;Description;Amount\n01/11/26;SHOP;1,23,456.78\n02/11/26;SHOP;2,34,567.89",
    )[1][2],
    "1,23,456.78",
  );
  assert.throws(() => parseDelimited('a,b\n"unfinished'), /unfinished/);
});
test("amounts retain integer precision and honor CR/DR, parentheses and currency symbols", () => {
  assert.deepEqual(parseAmount("₹1,23,456.78"), {
    minor: 12345678,
    negative: false,
    marker: null,
  });
  assert.equal(parseAmount("Rs. 12.34")?.minor, 1234);
  assert.equal(parseAmount("100.00CR")?.marker, "credit");
  assert.equal(parseAmount("100.00 DR")?.marker, "debit");
  assert.equal(parseAmount("(12.50)")?.negative, true);
  assert.equal(parseAmount("12.50-")?.negative, true);
  assert.equal(parseAmount("0")?.minor, 0);
  assert.throws(() => parseAmount("1.234"), /decimal/);
  assert.equal(parseAmount("—"), null);
});
test("dates use the selected convention and reject impossible days", () => {
  assert.equal(parseStatementDate("03/04/2026", "DMY", 2026), "2026-04-03");
  assert.equal(parseStatementDate("03/04/2026", "MDY", 2026), "2026-03-04");
  assert.equal(parseStatementDate("29/02/2024", "DMY", 2026), "2024-02-29");
  assert.equal(parseStatementDate("29/02/2026", "DMY", 2026), null);
  assert.equal(parseStatementDate("2026-11-03", "MDY", 2026), "2026-11-03");
  assert.equal(parseStatementDate("03 Nov 2026", "DMY", 2026), "2026-11-03");
  assert.equal(parseStatementDate("03-Nov-26", "DMY", 2026), "2026-11-03");
  assert.equal(parseStatementDate("03/11", "DMY", 2025), "2025-11-03");
});
test("statement totals reconcile fees, purchases and transfers without counting balances or repayments as spending", () => {
  const result = normalized();
  assert.equal(result.transactions.length, 7);
  assert.equal(result.issues.length, 1);
  const totals = summarizeTransactions(result.transactions);
  assert.equal(totals.purchases, 100000);
  assert.equal(totals.charges, 65400);
  assert.equal(totals.transfers, 200000);
  assert.equal(totals.outflows, 365400);
  assert.equal(totals.credits, 1050000);
  assert.equal(totals.chargeCredits, 50000);
  assert.equal(
    totals.outflows,
    totals.purchases + totals.charges + totals.transfers,
  );
  assert.equal(
    summarizeTransactions(
      result.transactions.map((t) => ({ ...t, excluded: true })),
    ).outflows,
    0,
  );
  assert.throws(
    () =>
      summarizeTransactions([
        ...result.transactions,
        { ...result.transactions[0], currency: "USD" },
      ]),
    /currency/,
  );
});
test("single amounts honor explicit directions over signs; ambiguous debit/credit rows are surfaced", () => {
  const r = parseDelimited(
    "Date,Description,Amount,Type\n01/11/26,Purchase,-100,DR\n02/11/26,Refund,50,CR\n03/11/26,Payment,50CR,DR\n04/11/26,Purchase,-25,",
  );
  const m = detectMapping(r);
  m.sign = "negative-debit";
  const t = normalizeRows(r, m, "signed").transactions;
  assert.deepEqual(
    t.map((x) => [x.amountMinor, x.direction]),
    [
      [10000, "debit"],
      [5000, "credit"],
      [5000, "credit"],
      [2500, "debit"],
    ],
  );
  const both = parseDelimited(
    "Date,Description,Debit,Credit\n01/11/26,Ambiguous,10,20",
  );
  assert.match(
    normalizeRows(both, detectMapping(both), "both").issues[0].reason,
    /Both debit and credit/,
  );
});
test("duplicate suggestions do not silently remove transactions, and CSV exports neutralize formulas", () => {
  const t = normalized().transactions[0],
    copy = { ...t, id: "another" };
  assert.equal(duplicateKey(t), duplicateKey(copy));
  assert.equal(summarizeTransactions([t, copy]).outflows, 200000);
  assert.match(
    transactionsCSV([{ ...t, description: '=HYPERLINK("bad")' }]),
    /"'=HYPERLINK/,
  );
  assert.equal(
    suggestLabels("GST on annual fee", "debit").chargeType,
    "Tax on charges",
  );
  assert.equal(suggestLabels("Grocery market", "debit").chargeType, "none");
});
test("PDF extraction excludes balance columns and rejects ambiguous multi-amount layouts", () => {
  const cell = (text: string, x: number) => ({ text, x, width: 40 });
  const result = pdfTable([
    [
      {
        cells: [
          cell("Date", 10),
          cell("Description", 100),
          cell("Debit", 350),
          cell("Credit", 450),
          cell("Balance", 550),
        ],
      },
      {
        cells: [
          cell("01/11/2026", 10),
          cell("Purchase", 100),
          cell("100.00", 350),
          cell("900.00", 550),
        ],
      },
      {
        cells: [
          cell("02/11/2026", 10),
          cell("Refund", 100),
          cell("50.00", 450),
          cell("950.00", 550),
        ],
      },
    ],
  ]);
  assert.deepEqual(result.rows[1], ["01/11/2026", "Purchase", "100.00", ""]);
  assert.deepEqual(result.rows[2], ["02/11/2026", "Refund", "", "50.00"]);
  const simple = pdfTable([
    [
      { cells: [cell("01/11/2026 SHOP 100.00", 10)] },
      { cells: [cell("02/11/2026 FX SHOP 2.00 160.00", 10)] },
    ],
  ]);
  assert.equal(simple.rows.length, 2);
  assert.match(simple.warnings[0], /1 date-like/);
});
test("encrypted backups round-trip locally, randomize ciphertext and reject wrong passwords or tampering", async () => {
  const doc: SpendDocument = {
    version: 1,
    sources: [{ id: "synthetic", name: "sample.csv" }],
    transactions: normalized().transactions,
  };
  const encrypted = await encryptSpend(doc, "private-test-passphrase"),
    second = await encryptSpend(doc, "private-test-passphrase");
  assert.notEqual(encrypted, second);
  assert.ok(!encrypted.includes("AMAZON"));
  assert.ok(!encrypted.includes("sample.csv"));
  assert.deepEqual(
    await decryptSpend(encrypted, "private-test-passphrase"),
    doc,
  );
  await assert.rejects(decryptSpend(encrypted, "wrong"), /Could not unlock/);
  const corrupt = JSON.parse(encrypted);
  corrupt.data = "AAAA";
  await assert.rejects(
    decryptSpend(JSON.stringify(corrupt), "private-test-passphrase"),
    /Could not unlock/,
  );
  await assert.rejects(encryptSpend(doc, "short"), /10 characters/);
});

test("ICICI-style PDFs accept two dates, named/dotted dates, wrapped rows and reward columns without adding points to amounts", async () => {
  const { pdfTable, groupPDFLines } = await import("../lib/spend/pdf");
  const cell = (text: string, x: number, width = 60) => ({ text, x, width });
  const result = pdfTable([
    [
      {
        cells: [
          cell("Transaction Date", 10),
          cell("Posting Date", 100),
          cell("Transaction Details", 200, 150),
          cell("Amount(INR)", 480, 100),
          cell("Reward Points", 630, 80),
        ],
      },
      {
        cells: [
          cell("01/11/2026", 10),
          cell("02/11/2026", 100),
          cell("SYNTHETIC AMAZON SHOP", 200, 200),
          cell("1,250.00", 510),
          cell("25", 650),
        ],
      },
      {
        cells: [
          cell("03 Nov 2026", 10),
          cell("04 Nov 2026", 100),
          cell("PAYMENT RECEIVED", 200, 200),
        ],
      },
      {
        cells: [
          cell("THANK YOU", 200),
          cell("1,000.00", 510),
          cell("CR", 575, 15),
          cell("0", 650),
        ],
      },
      {
        cells: [
          cell("05.11.2026", 10),
          cell("06.11.2026", 100),
          cell("Finance charge", 200, 200),
          cell("49.00", 510),
          cell("0", 650),
        ],
      },
    ],
  ]);
  assert.equal(result.rows.length, 4);
  assert.deepEqual(result.rows[1], [
    "01/11/2026",
    "SYNTHETIC AMAZON SHOP",
    "1250.00",
    "",
  ]);
  assert.deepEqual(result.rows[2], [
    "03 Nov 2026",
    "PAYMENT RECEIVED THANK YOU",
    "",
    "1000.00",
  ]);
  assert.deepEqual(result.rows[3], [
    "05/11/2026",
    "Finance charge",
    "49.00",
    "",
  ]);
  assert.equal(result.warnings.length, 0);
  const lines = groupPDFLines([
    { text: "01/11/2026", x: 10, y: 699.1, width: 80 },
    { text: "SHOP", x: 180, y: 698.9, width: 80 },
    { text: "100.00", x: 510, y: 700.2, width: 60 },
  ]);
  assert.equal(lines.length, 1);
  assert.equal(pdfTable([lines]).rows.length, 2);
});
test("headerless card rows preserve credit markers and don't guess between forex amounts", async () => {
  const { pdfTable } = await import("../lib/spend/pdf");
  const line = (text: string) => ({ cells: [{ text, x: 10, width: 600 }] });
  const result = pdfTable([
    [
      line("1 01 NOV 2026 02 NOV 2026 SYNTHETIC STORE 100.00 Dr"),
      line("03Nov2026 REFUND 25.00Cr"),
      line("04/11/2026 FX PURCHASE 2.00 USD 160.00 INR"),
      line("05/11/2026 Total amount due 500.00"),
    ],
  ]);
  assert.deepEqual(result.rows[1], [
    "01 NOV 2026",
    "SYNTHETIC STORE",
    "100.00",
    "",
  ]);
  assert.deepEqual(result.rows[2], ["03-Nov-2026", "REFUND", "", "25.00"]);
  assert.equal(result.rows.length, 3);
  assert.equal(result.datedRows, 4);
});

test("SBI-style D/C/M rows retain tax notes and exclude EMI conversion principal from spending", async () => {
  const { pdfTable } = await import("../lib/spend/pdf");
  const cell = (text: string, x: number, width = 70) => ({ text, x, width });
  const row = (date: string, desc: string, amount: string, marker = "") => ({
    cells: [
      ...(date ? [cell(date, 10)] : []),
      cell(desc, 160, 320),
      cell(amount, 620),
      ...(marker ? [cell(marker, 720, 15)] : []),
    ],
  });
  const result = pdfTable([
    [
      {
        cells: [
          cell("Date", 10),
          cell("Transaction Details", 160, 150),
          cell("Amount", 620),
        ],
      },
      row("13 Oct 26", "MERCHANT EMI PROC FEE (EXCL TAX 9.00)", "45.00", "D"),
      row("18 Oct 26", "FUEL SURCHARGE WAIVER EXCL TAX", "5.00", "C"),
      row("01 Nov 26", "PAYMENT RECEIVED SYNTHETIC", "1,000.00", "C"),
      row("12 Nov 26", "FP EMI 02/06(EXCL TAX 20.00)", "200.00", "M"),
      row("12 Nov 26", "INTEREST ON EMI", "50.00", "D"),
      row("", "IGST DB @ 18.00%", "9.00", "D"),
      { cells: [cell("TRANSACTIONS FOR SYNTHETIC USER", 160, 350)] },
      row("13 Oct 26", "TRANSFER TO MERCHANT EMI", "3,000.00"),
      row("14 Oct 26", "SYNTHETIC SHOP", "100.00", "D"),
    ],
  ]);
  assert.equal(result.rows.length, 9);
  const transactions = normalizeRows(
    result.rows,
    detectMapping(result.rows),
    "sbi-synthetic",
  ).transactions;
  assert.equal(transactions.length, 8);
  const totals = summarizeTransactions(transactions);
  assert.equal(totals.charges, 10400);
  assert.equal(totals.purchases, 10000);
  assert.equal(totals.credits, 100500);
  assert.equal(totals.outflows, 20400);
  assert.equal(transactions.filter((t) => t.excluded).length, 2);
  const tax = transactions.find((t) => t.description.startsWith("IGST"))!;
  assert.equal(tax.date, "2026-11-12");
  assert.match(tax.importNote!, /inferred/);
  assert.match(result.warnings.join(" "), /excluded/);
  assert.equal(
    transactions.find((t) => t.description === "INTEREST ON EMI")?.chargeType,
    "Interest / finance charge",
  );
});
test("generic PDF columns recover reordered layouts without a known bank header", async () => {
  const { pdfGridRows } = await import("../lib/spend/pdf");
  const pages = [
    [
      {
        cells: [
          { text: "CUSTOM SHOP", x: 10, width: 100 },
          { text: "13 Oct 26", x: 300, width: 80 },
          { text: "D", x: 500, width: 10 },
          { text: "75.00", x: 650, width: 50 },
        ],
      },
    ],
  ];
  const rows = pdfGridRows(pages, [800], [30, 60, 75]);
  const m = detectMapping(rows);
  Object.assign(m, {
    date: 1,
    description: 0,
    direction: 2,
    amount: 3,
    mode: "single",
  });
  const parsed = normalizeRows(rows, m, "custom");
  assert.equal(parsed.transactions[0].description, "CUSTOM SHOP");
  assert.equal(parsed.transactions[0].amountMinor, 7500);
  assert.throws(() => pdfGridRows(pages, [800], [75, 30]), /boundaries/);
  assert.throws(() => pdfGridRows(pages, [800], [100]), /boundaries/);
});

test("visual table crops exclude out-of-region content and reject invalid selections", async () => {
  const { wordsInRegion, tableFromWords } = await import("../lib/spend/visual");
  const words = [
    { text: "HEADER", x: 20, y: 760, width: 80 },
    { text: "01/11/2026", x: 20, y: 600, width: 90 },
    { text: "SYNTHETIC SHOP", x: 200, y: 600, width: 180 },
    { text: "100.00 D", x: 600, y: 600, width: 80 },
  ];
  const region = { left: 0, top: 0.2, right: 1, bottom: 0.5 };
  const selected = wordsInRegion(words, 800, 800, region);
  assert.equal(selected.length, 3);
  assert.ok(!selected.some((w) => w.text === "HEADER"));
  const extracted = tableFromWords(
    selected,
    800,
    240,
    null,
    "Selected region only",
  );
  const parsed = normalizeRows(
    extracted.rows,
    detectMapping(extracted.rows),
    "visual",
  );
  assert.equal(parsed.transactions[0].amountMinor, 10000);
  assert.match(parsed.transactions[0].importNote!, /Selected region/);
  assert.throws(
    () =>
      wordsInRegion(words, 800, 800, {
        left: 0.5,
        right: 0.1,
        top: 0,
        bottom: 1,
      }),
    /larger table/,
  );
});

test("OCR row grouping joins short credit markers to taller amount glyphs by vertical overlap", async () => {
  const { ocrGeometryWords, tableFromWords } =
    await import("../lib/spend/visual");
  const words = [
    { text: "01/11/2026", bbox: { x0: 10, x1: 180, y0: 100, y1: 132 } },
    { text: "REFUND", bbox: { x0: 300, x1: 450, y0: 102, y1: 130 } },
    { text: "25.00", bbox: { x0: 600, x1: 700, y0: 100, y1: 132 } },
    { text: "C", bbox: { x0: 750, x1: 770, y0: 102, y1: 125 } },
  ];
  const result = tableFromWords(
    ocrGeometryWords(words, 900, 1),
    800,
    900,
    null,
    "OCR test",
  );
  const tx = normalizeRows(
    result.rows,
    detectMapping(result.rows),
    "ocr-row",
  ).transactions;
  assert.equal(tx[0].direction, "credit");
  assert.equal(tx[0].amountMinor, 2500);
});

test("OCR rows without an explicit direction are excluded rather than silently counted as debits", async () => {
  const { tableFromWords } = await import("../lib/spend/visual");
  const result = tableFromWords(
    [
      { text: "01/11/2026", x: 10, y: 500, width: 90 },
      { text: "REFUND", x: 200, y: 500, width: 100 },
      { text: "25.00", x: 600, y: 500, width: 80 },
    ],
    800,
    600,
    null,
    "OCR from page 1",
  );
  const parsed = normalizeRows(
    result.rows,
    detectMapping(result.rows),
    "ocr-uncertain",
  ).transactions;
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].excluded, true);
  assert.equal(summarizeTransactions(parsed).outflows, 0);
  assert.match(parsed[0].importNote!, /explicit debit\/credit direction/);
  const rows = parseDelimited(
    "Date,Description,Amount,Type\n01/11/2026,Refund,25.00,Cc",
  );
  assert.match(
    normalizeRows(rows, detectMapping(rows), "bad-marker").issues[0].reason,
    /Unrecognised/,
  );
});
