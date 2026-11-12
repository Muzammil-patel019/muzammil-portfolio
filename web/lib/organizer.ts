import { z } from "zod";
import { dateSchema } from "./cards";
import { todayIST } from "./subscriptions";
import type { AgendaItem } from "./dashboard";
const amount = z.number().int().min(0).max(10_000_000_000),
  positive = amount.refine((n) => n > 0, "Enter a positive amount.");
const text = (max: number) => z.string().trim().max(max),
  name = (max = 100) => text(max).min(1, "Enter a name.");
export const optionalDate = z.union([z.literal(""), dateSchema]);
export const safeURL = z.union([
  z.literal(""),
  z
    .url()
    .max(2048)
    .refine((s) => /^https?:\/\//i.test(s), "Use an http or https link."),
]);
export const jobStatuses = [
  "Saved",
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;
export const expenseCategories = [
  "Food",
  "Groceries",
  "Transport",
  "Shopping",
  "Bills",
  "Health",
  "Entertainment",
  "Travel",
  "Other",
];
export const expenseSchema = z
  .object({
    id: z.uuid(),
    date: dateSchema,
    amountMinor: positive,
    category: name(40),
    description: name(),
    method: z.enum(["UPI", "Card", "Cash", "Bank", "Other"]),
    note: text(300),
  })
  .strict()
  .refine((e) => e.date <= todayIST(), "Record expenses after they happen.");
export const budgetSchema = z
  .object({
    id: z.uuid(),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    category: text(40),
    amountMinor: amount,
  })
  .strict();
export const jobSchema = z
  .object({
    id: z.uuid(),
    company: name(80),
    role: name(100),
    url: safeURL,
    status: z.enum(jobStatuses),
    appliedDate: optionalDate,
    followUpDate: optionalDate,
    interviewAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]),
    contact: text(100),
    notes: text(4000),
    resumeVersionId: z.union([z.literal(""), z.uuid()]),
    resumeVersionName: text(120),
    archived: z.boolean(),
    history: z
      .array(
        z
          .object({
            id: z.uuid(),
            status: z.enum(jobStatuses),
            at: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .refine(
    (j) => !j.appliedDate || j.appliedDate <= todayIST(),
    "Application date cannot be in the future.",
  );
export const contributionSchema = z
  .object({
    id: z.uuid(),
    date: dateSchema,
    kind: z.enum(["deposit", "withdrawal"]),
    amountMinor: positive,
    note: text(200),
  })
  .strict()
  .refine(
    (c) => c.date <= todayIST(),
    "Record savings movements after they happen.",
  );
export const goalSchema = z
  .object({
    id: z.uuid(),
    title: name(),
    targetMinor: positive,
    deadline: optionalDate,
    notes: text(1000),
    archived: z.boolean(),
    contributions: z.array(contributionSchema).max(500),
  })
  .strict()
  .superRefine((g, ctx) => {
    if (goalSaved(g) < 0)
      ctx.addIssue({
        code: "custom",
        message: "Withdrawals cannot exceed recorded deposits.",
      });
    if (
      new Set(g.contributions.map((c) => c.id)).size !== g.contributions.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate savings entry." });
  });
export const noteSchema = z
  .object({
    id: z.uuid(),
    title: name(),
    kind: z.enum(["note", "bookmark"]),
    url: safeURL,
    body: text(8000),
    tags: z.array(name(25)).max(12),
    pinned: z.boolean(),
    archived: z.boolean(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((n) => n.kind !== "bookmark" || !!n.url, "A bookmark needs a link.");
export const manualReminderSchema = z
  .object({
    id: z.uuid(),
    title: name(),
    dueDate: dateSchema,
    notes: text(500),
    done: z.boolean(),
  })
  .strict();
export const organizerSchema = z
  .object({
    version: z.literal(1),
    expenses: z.array(expenseSchema).max(3000),
    budgets: z.array(budgetSchema).max(600),
    jobs: z.array(jobSchema).max(500),
    goals: z.array(goalSchema).max(100),
    notes: z.array(noteSchema).max(200),
    reminders: z.array(manualReminderSchema).max(500),
    dismissed: z.array(z.string().max(200)).max(2000),
    snoozed: z
      .array(z.object({ key: z.string().max(200), until: dateSchema }).strict())
      .max(1000),
  })
  .strict()
  .superRefine((doc, ctx) => {
    for (const key of [
      "expenses",
      "budgets",
      "jobs",
      "goals",
      "notes",
      "reminders",
    ] as const)
      if (new Set(doc[key].map((i) => i.id)).size !== doc[key].length)
        ctx.addIssue({ code: "custom", message: "Duplicate record." });
    const keys = doc.budgets.map(
      (b) => b.month + ":" + b.category.toLowerCase(),
    );
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        message:
          "A budget for this month and category already exists. Edit that budget instead.",
      });
  });
export type OrganizerDocument = z.infer<typeof organizerSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type PrivateNote = z.infer<typeof noteSchema>;
export type ManualReminder = z.infer<typeof manualReminderSchema>;
export const emptyOrganizer = (): OrganizerDocument => ({
  version: 1,
  expenses: [],
  budgets: [],
  jobs: [],
  goals: [],
  notes: [],
  reminders: [],
  dismissed: [],
  snoozed: [],
});
export function goalSaved(goal: {
  contributions: { kind: string; amountMinor: number }[];
}) {
  return goal.contributions.reduce(
    (n, c) => n + (c.kind === "withdrawal" ? -c.amountMinor : c.amountMinor),
    0,
  );
}
export function monthSpending(
  doc: OrganizerDocument,
  month: string,
  category = "",
) {
  return doc.expenses
    .filter(
      (e) =>
        e.date.startsWith(month) &&
        (!category || e.category.toLowerCase() === category.toLowerCase()),
    )
    .reduce((n, e) => n + e.amountMinor, 0);
}
export function changeJobStatus(
  doc: OrganizerDocument,
  id: string,
  status: Job["status"],
) {
  const next = structuredClone(doc),
    job = next.jobs.find((j) => j.id === id);
  if (!job) throw new Error("Application unavailable.");
  if (job.status !== status) {
    job.status = status;
    job.history.push({
      id: crypto.randomUUID(),
      status,
      at: new Date().toISOString(),
    });
    if (status === "Applied" && !job.appliedDate) job.appliedDate = todayIST();
  }
  return organizerSchema.parse(next);
}
export function addContribution(
  doc: OrganizerDocument,
  id: string,
  kind: "deposit" | "withdrawal",
  amountMinor: number,
  date: string,
  note: string,
) {
  const next = structuredClone(doc),
    goal = next.goals.find((g) => g.id === id);
  if (!goal || goal.archived)
    throw new Error("Restore or select the goal first.");
  goal.contributions.push({
    id: crypto.randomUUID(),
    kind,
    amountMinor,
    date,
    note,
  });
  return organizerSchema.parse(next);
}
export const indiaDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
export const interviewDisplay = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso)) + " IST";
export type Reminder = {
  id: string;
  key: string;
  kind: string;
  title: string;
  date: string;
  detail: string;
  href: string;
  source: "agenda" | "job" | "goal" | "manual";
  at?: string;
};
export function organizerReminders(
  doc: OrganizerDocument,
  agenda: AgendaItem[],
  today = todayIST(),
): Reminder[] {
  const list: Omit<Reminder, "key">[] = agenda.map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a.title,
    date: a.date,
    detail: a.detail,
    href: a.href,
    source: "agenda",
  }));
  for (const job of doc.jobs.filter(
    (j) => !j.archived && !["Rejected", "Withdrawn"].includes(j.status),
  )) {
    if (job.followUpDate)
      list.push({
        id: "follow-" + job.id,
        kind: "job",
        title: job.company + " · " + job.role,
        date: job.followUpDate,
        detail: "Application follow-up",
        href: "/organizer?tab=jobs&item=" + job.id,
        source: "job",
      });
    if (job.interviewAt && job.status !== "Offer")
      list.push({
        id: "interview-" + job.id + "-" + job.interviewAt,
        kind: "job",
        title: job.company + " interview",
        date: indiaDate(job.interviewAt),
        at: job.interviewAt,
        detail: interviewDisplay(job.interviewAt),
        href: "/organizer?tab=jobs&item=" + job.id,
        source: "job",
      });
  }
  for (const goal of doc.goals.filter(
    (g) => !g.archived && g.deadline && goalSaved(g) < g.targetMinor,
  ))
    list.push({
      id: "goal-" + goal.id,
      kind: "goal",
      title: goal.title,
      date: goal.deadline,
      detail: "Savings target date",
      href: "/organizer?tab=goals&item=" + goal.id,
      source: "goal",
    });
  for (const r of doc.reminders.filter((r) => !r.done))
    list.push({
      id: r.id,
      kind: "manual",
      title: r.title,
      date: r.dueDate,
      detail: r.notes || "Personal reminder",
      href: "/organizer?tab=reminders&item=" + r.id,
      source: "manual",
    });
  return list
    .map((r) => ({ ...r, key: r.id + ":" + r.date }))
    .filter(
      (r) =>
        !doc.dismissed.includes(r.key) &&
        !doc.snoozed.some((s) => s.key === r.key && s.until > today),
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
    );
}
export function organizerSummary(doc: OrganizerDocument, today = todayIST()) {
  return {
    month: today.slice(0, 7),
    spendingMinor: monthSpending(doc, today.slice(0, 7)),
    activeApplications: doc.jobs.filter(
      (j) =>
        !j.archived && !["Saved", "Rejected", "Withdrawn"].includes(j.status),
    ).length,
    goals: doc.goals.filter((g) => !g.archived).length,
    savedMinor: doc.goals
      .filter((g) => !g.archived)
      .reduce((n, g) => n + goalSaved(g), 0),
    notes: doc.notes.filter((n) => !n.archived).length,
  };
}
export function exportExpenses(doc: OrganizerDocument) {
  const cell = (s: string) =>
    '"' + (/^[\s]*[=+\-@]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      ["Date", "Description", "Category", "Amount INR", "Method", "Note"],
      ...[...doc.expenses]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => [
          e.date,
          e.description,
          e.category,
          (e.amountMinor / 100).toFixed(2),
          e.method,
          e.note,
        ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
export function reminderCalendar(reminders: Reminder[]) {
  const esc = (s: string) =>
    s
      .replaceAll("\\", "\\\\")
      .replace(/[\r\n]+/g, "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal Organizer//Reminders//EN",
  ];
  for (const r of reminders) {
    const end = new Date(r.date + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() + 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}-${r.date}@muzammilpatel.com`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")}`,
      ...(r.at
        ? [
            `DTSTART:${new Date(r.at)
              .toISOString()
              .replace(/[-:]/g, "")
              .replace(/\.\d{3}/, "")}`,
          ]
        : [
            `DTSTART;VALUE=DATE:${r.date.replaceAll("-", "")}`,
            `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll("-", "")}`,
          ]),
      `SUMMARY:${esc(r.title)}`,
      `DESCRIPTION:${esc(r.detail)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Upcoming reminder",
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR", "");
  return lines.join("\r\n");
}

export function spendingCategories(doc: OrganizerDocument, month: string) {
  const groups = new Map<string, { category: string; amountMinor: number }>();
  for (const e of doc.expenses.filter((e) => e.date.startsWith(month))) {
    const key = e.category.toLowerCase(),
      group = groups.get(key) || { category: e.category, amountMinor: 0 };
    group.amountMinor += e.amountMinor;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.amountMinor - a.amountMinor);
}
