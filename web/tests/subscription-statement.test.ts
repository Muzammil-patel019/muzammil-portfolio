import { test } from "node:test";
import assert from "node:assert/strict";
import { billingLabels, statementCSV } from "../lib/subscription-statement";
test("statement exports exact amounts without converting currencies and neutralizes formulas", () => {
  const csv = statementCSV('=HYPERLINK("danger")', [
    {
      id: "bill",
      startDate: "2026-11-01",
      renewalDate: "2026-12-01",
      dueDate: "2026-11-05",
      currency: "INR",
      amountMinor: 3367,
      payments: [
        { amountMinor: 1000, date: "2026-11-02" },
        { amountMinor: 1000, date: "2026-11-03", sourceCreditId: "credit" },
      ],
    },
  ]);
  assert.ok(csv.startsWith('\uFEFF"Subscription"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""danger"")"'));
  assert.ok(csv.includes('"INR","33.67","20.00","13.67","Part paid"'));
  assert.ok(!csv.includes("sourceCreditId"));
  assert.equal(billingLabels.quarterly.period, "3 months");
  assert.equal(billingLabels["half-yearly"].label, "Six-monthly");
});
