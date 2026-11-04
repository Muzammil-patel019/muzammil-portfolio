import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCycle, cycleDates, daysUntil, documentSchema, money, paidTotal, parseMoney, splitAmount, todayIST, type SubscriptionDocument } from "../lib/subscriptions";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const inactive = "33333333-3333-4333-8333-333333333333";
function document(): SubscriptionDocument {
  return {
    version: 1,
    plan: { name: "YouTube Premium", currency: "INR", amountMinor: 29900, interval: "monthly", anchorDate: "2026-01-31", paymentNote: "Pay your share by the due date." },
    members: [{ id: first, name: "Alice", active: true }, { id: second, name: "Bob", active: true }, { id: inactive, name: "Charlie", active: false }],
    cycles: [],
  };
}

test("splitting conserves every minor unit with a stable remainder", () => {
  assert.deepEqual(splitAmount(100, [first, second, inactive]), [
    { memberId: first, amountMinor: 34 }, { memberId: second, amountMinor: 33 }, { memberId: inactive, amountMinor: 33 },
  ]);
  assert.deepEqual(splitAmount(1, [first, second]), [{ memberId: first, amountMinor: 1 }, { memberId: second, amountMinor: 0 }]);
  for (const invalid of [0, -1, 3.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) assert.throws(() => splitAmount(invalid, [first]));
  assert.throws(() => splitAmount(100, []));
  assert.throws(() => splitAmount(100, [first, first]));
});

test("decimal inputs convert to exact minor units without rounding", () => {
  assert.equal(parseMoney("299"), 29900);
  assert.equal(parseMoney(" 0.01 "), 1);
  assert.equal(parseMoney("1.1"), 110);
  assert.equal(parseMoney("123.29"), 12329);
  assert.equal(parseMoney("1000000.00"), 100000000);
  for (const invalid of ["", "0", "0.00", "-1", "+1", "1e2", "1,000", ".50", "1.", "1.001", "1000000.01", "NaN", "Infinity"]) assert.throws(() => parseMoney(invalid), invalid);
});

test("calendar boundaries preserve the original day after short months", () => {
  assert.deepEqual(cycleDates("2026-01-31", "monthly", 0), { startDate: "2026-01-31", renewalDate: "2026-02-28" });
  assert.deepEqual(cycleDates("2026-01-31", "monthly", 1), { startDate: "2026-02-28", renewalDate: "2026-03-31" });
  assert.deepEqual(cycleDates("2026-12-31", "monthly", 1), { startDate: "2027-01-31", renewalDate: "2027-02-28" });
  assert.deepEqual(cycleDates("2024-02-29", "yearly", 1), { startDate: "2025-02-28", renewalDate: "2026-02-28" });
  assert.deepEqual(cycleDates("2024-02-29", "yearly", 3), { startDate: "2027-02-28", renewalDate: "2028-02-29" });
  assert.throws(() => cycleDates("2026-02-29", "monthly", 0));
  assert.throws(() => cycleDates("2026-01-01", "monthly", -1));
});

test("day countdown uses calendar days independent of daylight saving", () => {
  assert.equal(daysUntil("2026-03-09", "2026-03-07"), 2);
  assert.equal(daysUntil("2026-01-01", "2026-01-02"), -1);
  assert.equal(daysUntil("2024-03-01", "2024-02-28"), 2);
  assert.equal(daysUntil("2026-11-03", "2026-11-03"), 0);
  assert.match(todayIST(), /^\d{4}-\d{2}-\d{2}$/);
  assert.throws(() => daysUntil("2026-02-30", "2026-02-01"));
});

test("new cycles snapshot current names, price and active members", () => {
  const doc = document();
  const cycle = buildCycle(doc);
  assert.equal(cycle.index, 0);
  assert.equal(cycle.dueDate, "2026-01-31");
  assert.equal(cycle.totalMinor, 29900);
  assert.deepEqual(cycle.allocations.map((entry) => [entry.name, entry.amountMinor]), [["Alice", 14950], ["Bob", 14950]]);
  assert.equal(documentSchema.safeParse({ ...doc, cycles: [cycle] }).success, true);
  doc.cycles.push(cycle);
  doc.plan.amountMinor = 39901;
  doc.members[0].name = "Alicia";
  const next = buildCycle(doc);
  assert.equal(next.index, 1);
  assert.equal(next.startDate, "2026-02-28");
  assert.deepEqual(next.allocations.map((entry) => [entry.name, entry.amountMinor]), [["Alicia", 19951], ["Bob", 19950]]);
  assert.equal(cycle.allocations[0].name, "Alice");
  assert.equal(cycle.totalMinor, 29900);
  assert.equal(doc.cycles.length, 1);
  doc.members.forEach((member) => { member.active = false; });
  assert.throws(() => buildCycle(doc));
});

test("next cycle uses the highest historical index even when history is unsorted", () => {
  const doc = document();
  const firstCycle = buildCycle(doc);
  doc.cycles = [{ ...firstCycle, id: crypto.randomUUID(), index: 3 }, firstCycle];
  assert.equal(buildCycle(doc).index, 4);
});

test("validation rejects duplicate identities, invalid dates, uneven totals and overpayments", () => {
  const doc = document();
  doc.cycles = [buildCycle(doc)];
  assert.equal(documentSchema.safeParse(doc).success, true);
  const invalid = (mutate: (copy: SubscriptionDocument) => void) => {
    const copy = structuredClone(doc);
    mutate(copy);
    assert.equal(documentSchema.safeParse(copy).success, false);
  };
  invalid((copy) => { copy.members.push(copy.members[0]); });
  invalid((copy) => { copy.cycles.push(copy.cycles[0]); });
  invalid((copy) => { copy.cycles.push({ ...copy.cycles[0], id: crypto.randomUUID() }); });
  invalid((copy) => { copy.cycles[0].allocations[1].memberId = first; });
  invalid((copy) => { copy.cycles[0].totalMinor += 1; });
  invalid((copy) => { copy.plan.amountMinor = 1.5; });
  invalid((copy) => { copy.plan.anchorDate = "2026-02-30"; });
  invalid((copy) => { copy.cycles[0].renewalDate = copy.cycles[0].startDate; });
  invalid((copy) => { copy.cycles[0].allocations[0].payments = [{ id: crypto.randomUUID(), amountMinor: 14951, date: "2026-01-31", note: "" }]; });
  assert.equal(documentSchema.safeParse({ ...doc, ownerId: first }).success, false);
  assert.equal(documentSchema.safeParse({ ...doc, plan: { ...doc.plan, hiddenField: true } }).success, false);
});

test("payments support partial receipts but cannot duplicate or exceed the share", () => {
  const doc = document();
  const cycle = buildCycle(doc);
  const payment = { id: crypto.randomUUID(), amountMinor: 5000, date: "2026-01-31", note: "Received" };
  cycle.allocations[0].payments = [payment, { ...payment, id: crypto.randomUUID(), amountMinor: 9950 }];
  doc.cycles = [cycle];
  assert.equal(paidTotal(cycle.allocations[0]), 14950);
  assert.equal(documentSchema.safeParse(doc).success, true);
  cycle.allocations[0].payments[1].id = payment.id;
  assert.equal(documentSchema.safeParse(doc).success, false);
});

test("money formatting keeps minor units and currency", () => {
  assert.equal(money(29900, "INR"), "₹299.00");
  assert.equal(money(1, "GBP"), "£0.01");
  assert.throws(() => money(1.5, "INR"));
});

test("backfilled periods never advance the future billing schedule", () => {
  const doc = document();
  doc.plan.anchorDate = "2026-11-01";
  const past = buildCycle(doc);
  Object.assign(past, { startDate: "2026-10-01", dueDate: "2026-10-01", renewalDate: "2026-11-01" });
  doc.cycles.push(past);
  const next = buildCycle(doc);
  assert.equal(next.index, 1);
  assert.equal(next.startDate, "2026-11-01");
  assert.equal(next.renewalDate, "2026-12-01");
});

test("quarterly and half-yearly schedules keep calendar boundaries", () => {
  assert.deepEqual(cycleDates("2026-01-31", "quarterly", 0), { startDate: "2026-01-31", renewalDate: "2026-04-30" });
  assert.deepEqual(cycleDates("2026-01-31", "half-yearly", 0), { startDate: "2026-01-31", renewalDate: "2026-07-31" });
});
