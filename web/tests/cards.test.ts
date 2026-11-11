import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expectedCardStatement,
  cardPaymentLog,
  cardPaymentsCSV,
  parseCardMoney,
  cardSchedule,
  suggestedDue,
  cardsDocumentSchema,
  recordCardPayment,
  statementBalance,
  cardsCSV,
  type CardsDocument,
} from "../lib/cards";
const id = "11111111-1111-4111-8111-111111111111",
  bill = "22222222-2222-4222-8222-222222222222";
const fixture = (): CardsDocument => ({
  version: 1,
  cards: [
    {
      id,
      name: "Everyday",
      issuer: "Example bank",
      last4: "1234",
      network: "Visa",
      limitMinor: 10000000,
      statementDay: 10,
      dueDay: 30,
      annualFeeMinor: 0,
      archived: false,
    },
  ],
  statements: [
    {
      id: bill,
      cardId: id,
      date: "2026-11-01",
      dueDate: "2026-11-20",
      totalMinor: 500000,
      minimumMinor: 50000,
      payments: [],
    },
  ],
});
test("card schedules clamp short months and always put due dates after generation", () => {
  assert.deepEqual(
    cardSchedule({ statementDay: 31, dueDay: 20 }, "2026-01-30"),
    { statementDate: "2026-01-31", dueDate: "2026-02-20" },
  );
  assert.deepEqual(
    cardSchedule({ statementDay: 29, dueDay: 31 }, "2027-02-01"),
    { statementDate: "2027-02-28", dueDate: "2027-03-31" },
  );
  assert.equal(
    suggestedDue({ statementDay: 10, dueDay: 30 }, "2028-02-10"),
    "2028-02-29",
  );
  assert.deepEqual(cardSchedule({ statementDay: 5, dueDay: 2 }, "2026-12-10"), {
    statementDate: "2027-01-05",
    dueDate: "2027-02-02",
  });
});
test("partial and full receipts keep exact balances without mutating the previous version", () => {
  const doc = fixture(),
    partial = recordCardPayment(doc, bill, 50000, "2026-11-02");
  assert.equal(statementBalance(partial.statements[0]), 450000);
  assert.equal(doc.statements[0].payments.length, 0);
  const settled = recordCardPayment(partial, bill, 450000, "2026-11-03");
  assert.equal(statementBalance(settled.statements[0]), 0);
  assert.throws(() => recordCardPayment(settled, bill, 1, "2026-11-03"));
  assert.throws(() => recordCardPayment(doc, bill, 10000, "2026-10-01"));
});
test("validation rejects full card fields, bad dates, duplicate bills and orphan history", () => {
  const doc = fixture();
  assert.equal(cardsDocumentSchema.safeParse(doc).success, true);
  assert.equal(
    cardsDocumentSchema.safeParse({
      ...doc,
      cards: [{ ...doc.cards[0], last4: "1234567890123456" }],
    }).success,
    false,
  );
  assert.equal(
    cardsDocumentSchema.safeParse({
      ...doc,
      cards: [{ ...doc.cards[0], cvv: "123" }],
    }).success,
    false,
  );
  assert.equal(
    cardsDocumentSchema.safeParse({
      ...doc,
      statements: [{ ...doc.statements[0], date: "2026-02-30" }],
    }).success,
    false,
  );
  assert.equal(
    cardsDocumentSchema.safeParse({
      ...doc,
      statements: [
        doc.statements[0],
        { ...doc.statements[0], id: crypto.randomUUID() },
      ],
    }).success,
    false,
  );
  assert.equal(
    cardsDocumentSchema.safeParse({ ...doc, cards: [] }).success,
    false,
  );
});
test("CSV quotes private history and prevents spreadsheet formula execution", () => {
  const doc = fixture();
  doc.cards[0].name = '=HYPERLINK("test")';
  const csv = cardsCSV(doc);
  assert.ok(csv.includes('"\'=HYPERLINK(""test"")"'));
  assert.ok(csv.includes('"1234"'));
  assert.ok(csv.includes('"5000.00","500.00","0.00","5000.00"'));
});

test("card amounts accept zero minimums and fees without floating-point rounding", () => {
  assert.equal(parseCardMoney("0"), 0);
  assert.equal(parseCardMoney("0.01"), 1);
  assert.equal(parseCardMoney("2500000.25"), 250000025);
  assert.throws(() => parseCardMoney("-1"));
  assert.throws(() => parseCardMoney("1.001"));
});

test("statement checks use the last expected date, including short months", () => {
  assert.equal(
    expectedCardStatement({ statementDay: 31 }, "2026-02-20"),
    "2026-01-31",
  );
  assert.equal(
    expectedCardStatement({ statementDay: 31 }, "2026-02-28"),
    "2026-02-28",
  );
  assert.equal(
    expectedCardStatement({ statementDay: 1 }, "2026-01-01"),
    "2026-01-01",
  );
});
test("payment log sorts actual receipt dates and exports safe notes", () => {
  let doc = recordCardPayment(fixture(), bill, 10000, "2026-11-03", "=SUM(1)");
  doc = recordCardPayment(doc, bill, 20000, "2026-11-02", "Other transfer");
  assert.deepEqual(
    cardPaymentLog(doc).map((p) => p.date),
    ["2026-11-03", "2026-11-02"],
  );
  assert.ok(cardPaymentsCSV(doc).includes('"\'=SUM(1)"'));
  assert.equal(cardPaymentLog(doc)[0].last4, "1234");
});
