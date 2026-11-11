import { z } from "zod";
import { todayIST } from "./subscriptions";
const amount = z.number().int().min(0).max(10_000_000_000);
const label = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine(
    (s) => !/\d[\d -]{10,}\d/.test(s),
    "Use a name, not a full card or account number.",
  );
export const cardSchema = z
  .object({
    id: z.uuid(),
    name: label,
    issuer: label,
    last4: z.string().regex(/^\d{4}$/, "Enter exactly the last four digits."),
    network: z.enum(["Visa", "Mastercard", "RuPay", "Amex", "Other"]),
    limitMinor: amount.refine((v) => v > 0, "Enter a positive credit limit."),
    statementDay: z.number().int().min(1).max(31),
    dueDay: z.number().int().min(1).max(31),
    annualFeeMinor: amount,
    archived: z.boolean(),
  })
  .strict();
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T00:00:00Z");
    return (
      Number.isFinite(+d) &&
      d.toISOString().slice(0, 10) === s &&
      +s.slice(0, 4) >= 1900
    );
  }, "Enter a valid date.");
const paymentSchema = z
  .object({
    id: z.uuid(),
    date: dateSchema,
    amountMinor: amount.refine((v) => v > 0),
    note: z
      .string()
      .trim()
      .max(80)
      .refine(
        (s) => !/\d[\d -]{10,}\d/.test(s),
        "Do not store full account numbers.",
      ),
  })
  .strict();
export const statementSchema = z
  .object({
    id: z.uuid(),
    cardId: z.uuid(),
    date: dateSchema,
    dueDate: dateSchema,
    totalMinor: amount,
    minimumMinor: amount,
    payments: z.array(paymentSchema).max(100),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.date > todayIST() || s.payments.some((p) => p.date > todayIST()))
      ctx.addIssue({
        code: "custom",
        message: "Record statements and payments after they happen.",
      });
    if (s.dueDate <= s.date)
      ctx.addIssue({
        code: "custom",
        message: "Payment due date must be after the statement date.",
        path: ["dueDate"],
      });
    if (s.minimumMinor > s.totalMinor)
      ctx.addIssue({
        code: "custom",
        message: "Minimum due cannot exceed the total bill.",
        path: ["minimumMinor"],
      });
    if (s.payments.reduce((n, p) => n + p.amountMinor, 0) > s.totalMinor)
      ctx.addIssue({
        code: "custom",
        message: "Recorded payments exceed this bill.",
      });
    if (s.payments.some((p) => p.date < s.date))
      ctx.addIssue({
        code: "custom",
        message: "A bill payment cannot be earlier than its statement.",
      });
    if (new Set(s.payments.map((p) => p.id)).size !== s.payments.length)
      ctx.addIssue({ code: "custom", message: "Duplicate payment entry." });
  });
export const cardsDocumentSchema = z
  .object({
    version: z.literal(1),
    cards: z.array(cardSchema).max(50),
    statements: z.array(statementSchema).max(1200),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const ids = new Set(doc.cards.map((c) => c.id));
    if (
      ids.size !== doc.cards.length ||
      new Set(doc.statements.map((s) => s.id)).size !== doc.statements.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate card or bill." });
    if (doc.statements.some((s) => !ids.has(s.cardId)))
      ctx.addIssue({
        code: "custom",
        message: "A bill must belong to a saved card.",
      });
    if (
      new Set(doc.statements.map((s) => s.cardId + ":" + s.date)).size !==
      doc.statements.length
    )
      ctx.addIssue({
        code: "custom",
        message: "A statement for this card and date already exists.",
      });
  });
export type Card = z.infer<typeof cardSchema>;
export type CardStatement = z.infer<typeof statementSchema>;
export type CardsDocument = z.infer<typeof cardsDocumentSchema>;
export const emptyCards = (): CardsDocument => ({
  version: 1,
  cards: [],
  statements: [],
});
export const cardMoney = (minor: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(minor / 100);
export const cardDate = (s: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(s + "T00:00:00Z"));
export const statementPaid = (s: CardStatement) =>
  s.payments.reduce((n, p) => n + p.amountMinor, 0);
export const statementBalance = (s: CardStatement) =>
  Math.max(0, s.totalMinor - statementPaid(s));
export function monthDate(year: number, month: number, day: number) {
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()),
    ),
  )
    .toISOString()
    .slice(0, 10);
}
export function cardSchedule(
  card: Pick<Card, "statementDay" | "dueDay">,
  today = todayIST(),
) {
  const d = new Date(today + "T00:00:00Z");
  let month = d.getUTCMonth();
  const year = d.getUTCFullYear();
  if (monthDate(year, month, card.statementDay) < today) month++;
  const statementDate = monthDate(year, month, card.statementDay);
  return {
    statementDate,
    dueDate: suggestedDue(card, statementDate),
  };
}
export function suggestedDue(
  card: Pick<Card, "statementDay" | "dueDay">,
  statementDate: string,
) {
  const d = new Date(statementDate + "T00:00:00Z");
  let due = monthDate(d.getUTCFullYear(), d.getUTCMonth(), card.dueDay);
  if (due <= statementDate)
    due = monthDate(d.getUTCFullYear(), d.getUTCMonth() + 1, card.dueDay);
  return due;
}
export function latestCardBill(doc: CardsDocument, cardId: string) {
  return doc.statements
    .filter((s) => s.cardId === cardId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}
export function recordCardPayment(
  doc: CardsDocument,
  billId: string,
  minor: number,
  date: string,
  note = "",
) {
  const next = structuredClone(doc),
    bill = next.statements.find((s) => s.id === billId);
  if (
    !bill ||
    !Number.isSafeInteger(minor) ||
    minor <= 0 ||
    minor > statementBalance(bill)
  )
    throw new Error("Enter an amount within this bill’s remaining balance.");
  if (date > todayIST())
    throw new Error("A received payment cannot be dated in the future.");
  bill.payments.push({
    id: crypto.randomUUID(),
    amountMinor: minor,
    date,
    note,
  });
  return cardsDocumentSchema.parse(next);
}
export function cardsCSV(doc: CardsDocument) {
  const cell = (v: string) =>
    '"' + (/^[\s]*[=+\-@]/.test(v) ? "'" : "") + v.replaceAll('"', '""') + '"';
  const rows = [
    [
      "Card",
      "Last four",
      "Statement",
      "Due date",
      "Bill INR",
      "Minimum INR",
      "Paid INR",
      "Balance INR",
    ],
  ];
  for (const s of [...doc.statements].sort((a, b) =>
    b.date.localeCompare(a.date),
  )) {
    const c = doc.cards.find((c) => c.id === s.cardId)!;
    rows.push([
      c.name,
      c.last4,
      s.date,
      s.dueDate,
      (s.totalMinor / 100).toFixed(2),
      (s.minimumMinor / 100).toFixed(2),
      (statementPaid(s) / 100).toFixed(2),
      (statementBalance(s) / 100).toFixed(2),
    ]);
  }
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
export function downloadCards(
  content: string,
  name: string,
  type = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function cardCalendar(card: Card, bill: CardStatement) {
  const escape = (s: string) =>
    s
      .replaceAll("\\", "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const end = new Date(bill.dueDate + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cards//Payment reminder//EN",
    "BEGIN:VEVENT",
    `UID:${bill.id}@cards.muzammilpatel.com`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${bill.dueDate.replaceAll("-", "")}`,
    `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll("-", "")}`,
    `SUMMARY:${escape(card.name + " • " + card.last4 + " payment due")}`,
    `DESCRIPTION:${escape("Recorded bill balance: " + cardMoney(statementBalance(bill)) + ". Check your bank for the latest amount.")}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Card payment due",
    "TRIGGER:-P2D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function parseCardMoney(input: string) {
  const value = input.trim();
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(value))
    throw new Error("Enter an INR amount with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > 10_000_000_000)
    throw new Error("The amount exceeds the tracker limit.");
  return minor;
}

export function expectedCardStatement(
  card: Pick<Card, "statementDay">,
  today = todayIST(),
) {
  const d = new Date(today + "T00:00:00Z");
  let month = d.getUTCMonth();
  const year = d.getUTCFullYear();
  if (monthDate(year, month, card.statementDay) > today) month--;
  return monthDate(year, month, card.statementDay);
}
export function cardPaymentLog(doc: CardsDocument) {
  return doc.statements
    .flatMap((bill) =>
      bill.payments.map((payment) => ({
        ...payment,
        cardId: bill.cardId,
        cardName: doc.cards.find((c) => c.id === bill.cardId)!.name,
        last4: doc.cards.find((c) => c.id === bill.cardId)!.last4,
        statementDate: bill.date,
        dueDate: bill.dueDate,
      })),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.statementDate.localeCompare(a.statementDate),
    );
}
export function cardPaymentsCSV(doc: CardsDocument) {
  const cell = (v: string) =>
    '"' + (/^[\s]*[=+\-@]/.test(v) ? "'" : "") + v.replaceAll('"', '""') + '"';
  const rows = [
    [
      "Card",
      "Last four",
      "Payment date",
      "Amount INR",
      "Statement date",
      "Note",
    ],
    ...cardPaymentLog(doc).map((p) => [
      p.cardName,
      p.last4,
      p.date,
      (p.amountMinor / 100).toFixed(2),
      p.statementDate,
      p.note,
    ]),
  ];
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
