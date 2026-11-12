import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextRenewalDate,
  completeRenewal,
  renewalDocumentSchema,
  renewalCalendar,
  renewalsCSV,
  type RenewalDocument,
} from "../lib/renewals";
const id = "11111111-1111-4111-8111-111111111111";
const fixture = (): RenewalDocument => ({
  version: 1,
  items: [
    {
      id,
      title: "Insurance",
      category: "Insurance",
      provider: "Example provider",
      dueDate: "2026-01-31",
      anchorDay: 31,
      interval: "monthly",
      amountMinor: 10000,
      reminderDays: 7,
      url: "",
      notes: "",
      archived: false,
      history: [],
    },
  ],
});
test("renewals keep original month-end days and renew from the due date", () => {
  const doc = fixture();
  assert.equal(nextRenewalDate(doc.items[0]), "2026-02-28");
  const next = completeRenewal(doc, id, "2026-01-20", "2026-02-28", 12000);
  assert.equal(next.items[0].history[0].previousDueDate, "2026-01-31");
  assert.equal(next.items[0].history[0].amountMinor, 12000);
  assert.equal(nextRenewalDate(next.items[0]), "2026-03-31");
  assert.equal(doc.items[0].history.length, 0);
});
test("manual next dates reset the anchor while one-time completion archives without losing history", () => {
  const next = completeRenewal(
    fixture(),
    id,
    "2026-01-20",
    "2026-03-15",
    10000,
  );
  assert.equal(next.items[0].anchorDay, 15);
  assert.equal(nextRenewalDate(next.items[0]), "2026-04-15");
  const doc = fixture();
  doc.items[0].interval = "once";
  const done = completeRenewal(doc, id, "2026-01-20", null, 0);
  assert.equal(done.items[0].archived, true);
  assert.equal(done.items[0].history.length, 1);
  assert.equal(done.items[0].history[0].nextDueDate, null);
  assert.throws(() => completeRenewal(done, id, "2026-01-20", null, 0));
});
test("renewal input rejects unsafe links, duplicate IDs and non-advancing next dates", () => {
  const doc = fixture();
  assert.equal(renewalDocumentSchema.safeParse(doc).success, true);
  assert.equal(
    renewalDocumentSchema.safeParse({
      ...doc,
      items: [doc.items[0], doc.items[0]],
    }).success,
    false,
  );
  assert.equal(
    renewalDocumentSchema.safeParse({
      ...doc,
      items: [{ ...doc.items[0], url: "javascript:alert(1)" }],
    }).success,
    false,
  );
  assert.throws(() => completeRenewal(doc, id, "2026-01-20", "2026-01-31", 0));
  assert.throws(() => completeRenewal(doc, id, "2100-01-01", "2100-02-01", 0));
});
test("calendar exports include the chosen reminder and CSV neutralizes formulas", () => {
  const doc = fixture();
  doc.items[0].title = "=FORMULA";
  assert.ok(
    renewalCalendar(doc.items[0]).includes("DTSTART;VALUE=DATE:20260131"),
  );
  assert.ok(renewalCalendar(doc.items[0]).includes("TRIGGER:-P7D"));
  assert.ok(renewalsCSV(doc).includes('"\'=FORMULA"'));
});
