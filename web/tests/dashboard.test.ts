import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardSummary } from "../lib/dashboard";
import { buildCycle, type SubscriptionDocument } from "../lib/subscriptions";
const id = "11111111-1111-4111-8111-111111111111",
  bill = "22222222-2222-4222-8222-222222222222";
test("hub separates card costs from member collections and omits private notes and drafts", () => {
  const plan: SubscriptionDocument = {
    version: 1,
    plan: {
      name: "Shared service",
      amountMinor: 10000,
      currency: "USD",
      interval: "monthly",
      anchorDate: "2026-11-01",
      paymentNote: "Private plan note",
    },
    members: [{ id, name: "Alice", active: true }],
    cycles: [],
  };
  plan.cycles.push(buildCycle(plan));
  const summary = dashboardSummary({
    cards: {
      version: 1,
      cards: [
        {
          id,
          name: "Everyday",
          issuer: "Example bank",
          last4: "1234",
          network: "Visa",
          limitMinor: 10000000,
          annualFeeMinor: 0,
          statementDay: 10,
          dueDay: 30,
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
          payments: [
            {
              id: crypto.randomUUID(),
              date: "2026-11-02",
              amountMinor: 100000,
              note: "Private bank reference",
            },
          ],
        },
      ],
    },
    plans: [{ id, document: plan }],
    learning: {
      python0: { read: true, quiz: true, draft: "Secret draft" },
      days: [20000, 20000],
    },
    renewals: { version: 1, items: [] },
    pending: { payments: 1, preferences: 2, joins: 3, paymentPlanId: id },
    sources: {
      cards: true,
      subscriptions: true,
      learning: true,
      renewals: true,
    },
  });
  assert.equal(summary.cards.balanceMinor, 400000);
  assert.equal(summary.subscriptions.collect.USD, 10000);
  assert.equal(summary.learning.completed, 2);
  assert.equal(summary.learning.activeDays, 1);
  assert.equal(
    summary.agenda.filter((a) => a.kind === "subscription").length,
    2,
  );
  assert.ok(
    summary.agenda.find((a) => a.kind === "card")?.detail.includes("1234"),
  );
  assert.ok(!JSON.stringify(summary).includes("Private bank reference"));
  assert.ok(!JSON.stringify(summary).includes("Secret draft"));
  assert.ok(!JSON.stringify(summary).includes("Private plan note"));
  assert.equal(summary.pending.paymentPlanId, id);
});
