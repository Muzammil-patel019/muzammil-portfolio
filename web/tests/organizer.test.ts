import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyOrganizer,
  organizerSchema,
  monthSpending,
  spendingCategories,
  changeJobStatus,
  addContribution,
  goalSaved,
  organizerReminders,
  organizerSummary,
  reminderCalendar,
  exportExpenses,
  safeURL,
  type Job,
} from "../lib/organizer";
const id = () => crypto.randomUUID();
const date = "2025-01-15";
const job = (): Job => ({
  id: id(),
  company: "Example",
  role: "QA",
  url: "",
  status: "Saved",
  appliedDate: "",
  followUpDate: "2025-01-16",
  interviewAt: "2025-01-17T00:30:00+05:30",
  contact: "private contact",
  notes: "private notes",
  resumeVersionId: "",
  resumeVersionName: "",
  archived: false,
  history: [],
});
test("expenses use minor units, normalize category totals and reject duplicate budgets", () => {
  const d = emptyOrganizer();
  d.expenses = [
    {
      id: id(),
      date,
      description: "=formula",
      category: "Food",
      amountMinor: 101,
      method: "UPI",
      note: "",
    },
    {
      id: id(),
      date,
      description: "Lunch",
      category: "food",
      amountMinor: 299,
      method: "Cash",
      note: "",
    },
  ];
  assert.equal(monthSpending(d, "2025-01", "FOOD"), 400);
  assert.deepEqual(
    spendingCategories(d, "2025-01").map((c) => c.amountMinor),
    [400],
  );
  d.budgets = [
    { id: id(), month: "2025-01", category: "Food", amountMinor: 0 },
  ];
  assert.equal(organizerSchema.safeParse(d).success, true);
  d.budgets.push({
    id: id(),
    month: "2025-01",
    category: "food",
    amountMinor: 100,
  });
  assert.equal(organizerSchema.safeParse(d).success, false);
  assert.match(exportExpenses(d), /"'=formula"/);
  d.budgets = [];
  d.expenses[0].date = "2099-01-01";
  assert.equal(organizerSchema.safeParse(d).success, false);
});
test("job stage history and calendar preserve the actual IST interview time", () => {
  let d = emptyOrganizer();
  d.jobs = [job()];
  d = changeJobStatus(d, d.jobs[0].id, "Applied");
  assert.equal(d.jobs[0].history.length, 1);
  assert.ok(d.jobs[0].appliedDate);
  const reminders = organizerReminders(d, [], "2025-01-15");
  assert.equal(reminders.length, 2);
  assert.match(reminderCalendar(reminders), /DTSTART:20250116T190000Z/);
  assert.equal(reminders.find((r) => r.at)?.date, "2025-01-17");
  d = changeJobStatus(d, d.jobs[0].id, "Rejected");
  assert.equal(organizerReminders(d, []).length, 0);
  assert.equal(organizerSummary(d).activeApplications, 0);
});
test("savings ledger rejects withdrawals and corrections that exceed deposits", () => {
  let d = emptyOrganizer();
  const goalId = id();
  d.goals = [
    {
      id: goalId,
      title: "Emergency fund",
      targetMinor: 10000,
      deadline: "2025-12-01",
      notes: "",
      archived: false,
      contributions: [],
    },
  ];
  d = addContribution(d, goalId, "deposit", 5000, date, "First deposit");
  d = addContribution(d, goalId, "withdrawal", 1000, date, "");
  assert.equal(goalSaved(d.goals[0]), 4000);
  assert.throws(() => addContribution(d, goalId, "withdrawal", 4001, date, ""));
  d.goals[0].contributions.shift();
  assert.equal(organizerSchema.safeParse(d).success, false);
});
test("reminder dismissal applies to one occurrence and never edits its source", () => {
  const d = emptyOrganizer();
  const agenda = [
    {
      id: "bill-1",
      kind: "card" as const,
      title: "Card",
      date,
      detail: "Due",
      href: "/cards",
    },
  ];
  const original = JSON.stringify(agenda),
    r = organizerReminders(d, agenda, date)[0];
  d.dismissed = [r.key];
  assert.equal(organizerReminders(d, agenda, date).length, 0);
  assert.equal(
    organizerReminders(d, [{ ...agenda[0], date: "2025-02-15" }], date).length,
    1,
  );
  d.dismissed = [];
  d.snoozed = [{ key: r.key, until: "2025-01-22" }];
  assert.equal(organizerReminders(d, agenda, date).length, 0);
  assert.equal(organizerReminders(d, agenda, "2025-01-22").length, 1);
  assert.equal(JSON.stringify(agenda), original);
});
test("bookmarks require safe links and dashboard summary contains only aggregates", () => {
  assert.equal(safeURL.safeParse("javascript:alert(1)").success, false);
  const d = emptyOrganizer();
  d.jobs = [job()];
  d.notes = [
    {
      id: id(),
      kind: "bookmark",
      title: "Private bookmark",
      url: "https://example.com",
      body: "Secret text",
      tags: ["study"],
      pinned: true,
      archived: false,
      updatedAt: new Date().toISOString(),
    },
  ];
  assert.equal(organizerSchema.safeParse(d).success, true);
  assert.equal(organizerSummary(d).notes, 1);
  assert.doesNotMatch(
    JSON.stringify(organizerSummary(d)),
    /Secret|contact|Example|Private bookmark/,
  );
  d.notes[0].url = "";
  assert.equal(organizerSchema.safeParse(d).success, false);
});
