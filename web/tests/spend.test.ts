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
