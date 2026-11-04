import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coverageQuote,
  confirmedCoverage,
  recordMemberReceipt,
  applyAdvanceCredit,
} from "../lib/member-billing";
import {
  buildCycle,
  documentSchema,
  type SubscriptionDocument,
} from "../lib/subscriptions";
const id = "11111111-1111-4111-8111-111111111111";
function fixture(): SubscriptionDocument {
  return {
    version: 1,
    plan: {
      name: "YouTube Premium",
      currency: "INR",
      amountMinor: 5980,
      interval: "monthly",
      anchorDate: "2026-11-01",
      paymentNote: "",
    },
    members: [{ id, name: "Alice", active: true }],
    cycles: [],
  };
}
test("coverage quotes subtract already received money and keep calendar dates", () => {
  const c = {
    startDate: "2026-01-31",
    renewalDate: "2026-02-28",
    amountMinor: 5980,
    payments: [{ amountMinor: 1000 }],
  };
  assert.deepEqual(coverageQuote(c, 3), {
    amountMinor: 16940,
    startDate: "2026-01-31",
    endDate: "2026-04-30",
    baseMonths: 1,
  });
});
test("an upfront receipt settles current share and credits future bills exactly once", () => {
  const doc = fixture();
  const cycle = buildCycle(doc);
  doc.cycles.push(cycle);
  recordMemberReceipt(
    doc,
    cycle.id,
    id,
    17940,
    "2026-11-04",
    "Bank verified",
    3,
  );
  assert.equal(cycle.allocations[0].payments[0].amountMinor, 5980);
  assert.equal(doc.credits?.[0].remainingMinor, 11960);
  assert.equal(documentSchema.safeParse(doc).success, true);
  const next = buildCycle(doc);
  applyAdvanceCredit(doc, next);
  assert.equal(next.allocations[0].payments[0].amountMinor, 5980);
  assert.equal(doc.credits?.[0].remainingMinor, 5980);
  applyAdvanceCredit(doc, next);
  assert.equal(doc.credits?.[0].remainingMinor, 5980);
  assert.equal(next.allocations[0].payments.length, 1);
});
test("credit never crosses currencies or members", () => {
  const doc = fixture();
  const c = buildCycle(doc);
  doc.cycles.push(c);
  recordMemberReceipt(doc, c.id, id, 11960, "2026-11-04", "", 3);
  const next = buildCycle(doc);
  next.currency = "USD";
  applyAdvanceCredit(doc, next);
  assert.equal(next.allocations[0].payments.length, 0);
});

test("already available credit prevents paying for the same coverage twice", () => {
  const c = {
    startDate: "2026-11-01",
    renewalDate: "2026-12-01",
    amountMinor: 5980,
    payments: [{ amountMinor: 5980 }],
  };
  assert.equal(coverageQuote(c, 3, 11960).amountMinor, 0);
  assert.equal(coverageQuote(c, 6, 11960).amountMinor, 17940);
});

test("confirmed coverage uses funded months and does not double-count applied credit", () => {
  const doc = fixture();
  const cycle = buildCycle(doc);
  doc.cycles.push(cycle);
  recordMemberReceipt(doc, cycle.id, id, 17940, "2026-11-04", "", 3);
  const memberCycles = () =>
    doc.cycles.map((c) => ({ ...c, ...c.allocations[0] }));
  assert.deepEqual(
    confirmedCoverage(memberCycles(), doc.credits || [], cycle.startDate),
    { startDate: "2026-11-01", endDate: "2027-02-01", currency: "INR" },
  );
  const next = buildCycle(doc);
  applyAdvanceCredit(doc, next);
  doc.cycles.push(next);
  assert.equal(
    confirmedCoverage(memberCycles(), doc.credits || [], next.startDate)
      ?.endDate,
    "2027-02-01",
  );
});
test("a partial advance never claims an entire requested term as paid", () => {
  const doc = fixture();
  const cycle = buildCycle(doc);
  doc.cycles.push(cycle);
  recordMemberReceipt(doc, cycle.id, id, 6000, "2026-11-04", "", 12);
  assert.equal(
    confirmedCoverage(
      [{ ...cycle, ...cycle.allocations[0] }],
      doc.credits || [],
      cycle.startDate,
    )?.endDate,
    "2026-12-01",
  );
  const unpaid = { ...cycle, amountMinor: 5980, payments: [] };
  assert.equal(confirmedCoverage([unpaid], [], cycle.startDate), null);
});
