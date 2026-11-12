import { z } from "zod";
import { dateSchema, monthDate } from "./cards";
import { todayIST } from "./subscriptions";
export const renewalCategories = [
  "Insurance",
  "Vehicle",
  "Warranty",
  "Domain",
  "Membership",
  "Other",
] as const;
const amount = z.number().int().min(0).max(10_000_000_000);
const historySchema = z
  .object({
    id: z.uuid(),
    date: dateSchema,
    previousDueDate: dateSchema,
    nextDueDate: dateSchema.nullable(),
    amountMinor: amount,
  })
  .strict();
export const renewalItemSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(80),
    category: z.enum(renewalCategories),
    provider: z.string().trim().max(80),
    dueDate: dateSchema,
    anchorDay: z.number().int().min(1).max(31),
    interval: z.enum(["once", "monthly", "quarterly", "half-yearly", "yearly"]),
    amountMinor: amount,
    reminderDays: z.number().int().min(0).max(90),
    url: z.union([
      z.literal(""),
      z
        .url()
        .max(2048)
        .refine((s) => /^https?:\/\//i.test(s), "Use an http or https link."),
    ]),
    notes: z.string().trim().max(500),
    archived: z.boolean(),
    history: z.array(historySchema).max(200),
  })
  .strict();
export const renewalDocumentSchema = z
  .object({ version: z.literal(1), items: z.array(renewalItemSchema).max(300) })
  .strict()
  .superRefine((doc, ctx) => {
    if (new Set(doc.items.map((i) => i.id)).size !== doc.items.length)
      ctx.addIssue({ code: "custom", message: "Duplicate renewal item." });
    for (const item of doc.items) {
      if (new Set(item.history.map((h) => h.id)).size !== item.history.length)
        ctx.addIssue({ code: "custom", message: "Duplicate renewal receipt." });
      if (item.history.some((h) => h.date > todayIST()))
        ctx.addIssue({
          code: "custom",
          message: "Completed renewals cannot be dated in the future.",
        });
    }
  });
export type RenewalItem = z.infer<typeof renewalItemSchema>;
export type RenewalDocument = z.infer<typeof renewalDocumentSchema>;
export const emptyRenewals = (): RenewalDocument => ({ version: 1, items: [] });
export function nextRenewalDate(
  item: Pick<RenewalItem, "interval" | "dueDate" | "anchorDay">,
) {
  if (item.interval === "once") return null;
  const months = { monthly: 1, quarterly: 3, "half-yearly": 6, yearly: 12 }[
    item.interval
  ];
  const d = new Date(item.dueDate + "T00:00:00Z");
  return monthDate(
    d.getUTCFullYear(),
    d.getUTCMonth() + months,
    item.anchorDay,
  );
}
export function completeRenewal(
  doc: RenewalDocument,
  id: string,
  date: string,
  nextDate: string | null,
  amountMinor: number,
) {
  const next = structuredClone(doc),
    item = next.items.find((i) => i.id === id);
  if (!item) throw new Error("Renewal unavailable.");
  if (date > todayIST())
    throw new Error("Record a completed renewal after it happens.");
  if (item.interval !== "once" && (!nextDate || nextDate <= item.dueDate))
    throw new Error("The next due date must follow the current due date.");
  if (item.archived) throw new Error("Restore this item before completing it.");
  const expected = nextRenewalDate(item);
  item.history.push({
    id: crypto.randomUUID(),
    date,
    previousDueDate: item.dueDate,
    nextDueDate: item.interval === "once" ? null : nextDate,
    amountMinor,
  });
  if (item.interval === "once") item.archived = true;
  else {
    item.dueDate = nextDate!;
    if (nextDate !== expected) item.anchorDay = Number(nextDate!.slice(8, 10));
  }
  return renewalDocumentSchema.parse(next);
}
export function renewalCalendar(item: RenewalItem) {
  const esc = (s: string) =>
    s
      .replaceAll("\\", "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const end = new Date(item.dueDate + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal Hub//Renewals//EN",
    "BEGIN:VEVENT",
    `UID:${item.id}-${item.dueDate}@muzammilpatel.com`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${item.dueDate.replaceAll("-", "")}`,
    `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll("-", "")}`,
    `SUMMARY:${esc(item.title + " renewal")}`,
    `DESCRIPTION:${esc(item.provider || item.category)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Renewal approaching",
    `TRIGGER:-P${item.reminderDays}D`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
export function renewalsCSV(doc: RenewalDocument) {
  const cell = (s: string) =>
    '"' + (/^[\s]*[=+\-@]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      [
        "Title",
        "Category",
        "Provider",
        "Due date",
        "Interval",
        "Estimate INR",
        "Status",
      ],
      ...doc.items.map((i) => [
        i.title,
        i.category,
        i.provider,
        i.dueDate,
        i.interval,
        (i.amountMinor / 100).toFixed(2),
        i.archived ? "Archived" : "Active",
      ]),
    ]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
