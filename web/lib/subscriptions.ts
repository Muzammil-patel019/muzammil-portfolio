import { z } from "zod";

export const currencies = ["INR", "USD", "EUR", "GBP"] as const;
export type SubscriptionCurrency = (typeof currencies)[number];
export type SubscriptionInterval = "monthly" | "yearly";
const maxAmount = 100_000_000;
const amount = z.number().int().nonnegative().max(maxAmount);
const positiveAmount = amount.positive();
const uuid = z.uuid().transform((value) => value.toLowerCase());
const currencySchema = z.enum(currencies);

function dateValue(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Use a date in YYYY-MM-DD format.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    +value.slice(0, 4) < 1900
  ) {
    throw new Error("Enter a valid calendar date from 1900 onwards.");
  }
  return date;
}

const dateSchema = z.string().refine((value) => {
  try {
    dateValue(value);
    return true;
  } catch {
    return false;
  }
}, "Enter a valid date in YYYY-MM-DD format.");
const nameSchema = z.string().trim().min(1).max(80);
const paymentSchema = z
  .object({
    id: uuid,
    amountMinor: positiveAmount,
    date: dateSchema,
    note: z.string().trim().max(300),
  })
  .strict();
const allocationSchema = z
  .object({
    memberId: uuid,
    name: nameSchema,
    amountMinor: amount,
    payments: z.array(paymentSchema).max(100),
  })
  .strict()
  .superRefine((allocation, ctx) => {
    if (
      allocation.payments.reduce(
        (sum, payment) => sum + payment.amountMinor,
        0,
      ) > allocation.amountMinor
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Payments cannot exceed this person's share.",
        path: ["payments"],
      });
    }
  });
const cycleSchema = z
  .object({
    id: uuid,
    index: z.number().int().nonnegative().max(1200),
    startDate: dateSchema,
    dueDate: dateSchema,
    renewalDate: dateSchema,
    totalMinor: positiveAmount,
    currency: currencySchema,
    allocations: z.array(allocationSchema).min(1).max(50),
  })
  .strict()
  .superRefine((cycle, ctx) => {
    if (cycle.startDate >= cycle.renewalDate) {
      ctx.addIssue({
        code: "custom",
        message: "Renewal must be after the start date.",
        path: ["renewalDate"],
      });
    }
    if (
      new Set(cycle.allocations.map((entry) => entry.memberId)).size !==
      cycle.allocations.length
    ) {
      ctx.addIssue({
        code: "custom",
        message: "A person can have only one share in each cycle.",
        path: ["allocations"],
      });
    }
    if (
      cycle.allocations.reduce((sum, entry) => sum + entry.amountMinor, 0) !==
      cycle.totalMinor
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Shares must add up exactly to the cycle total.",
        path: ["allocations"],
      });
    }
  });

export const documentSchema = z
  .object({
    version: z.literal(1),
    plan: z
      .object({
        name: nameSchema,
        currency: currencySchema,
        amountMinor: positiveAmount,
        interval: z.enum(["monthly", "yearly"]),
        anchorDate: dateSchema,
        paymentNote: z.string().trim().max(1000),
      })
      .strict(),
    members: z
      .array(
        z.object({ id: uuid, name: nameSchema, active: z.boolean() }).strict(),
      )
      .max(50),
    cycles: z.array(cycleSchema).max(240),
  })
  .strict()
  .superRefine((document, ctx) => {
    const unique = (
      values: (string | number)[],
      path: string,
      label: string,
    ) => {
      if (new Set(values).size !== values.length)
        ctx.addIssue({
          code: "custom",
          message: `${label} must be unique.`,
          path: [path],
        });
    };
    unique(
      document.members.map((member) => member.id),
      "members",
      "Member IDs",
    );
    unique(
      document.cycles.map((cycle) => cycle.id),
      "cycles",
      "Cycle IDs",
    );
    unique(
      document.cycles.map((cycle) => cycle.index),
      "cycles",
      "Cycle indices",
    );
    unique(
      document.cycles.flatMap((cycle) =>
        cycle.allocations.flatMap((entry) =>
          entry.payments.map((payment) => payment.id),
        ),
      ),
      "cycles",
      "Payment IDs",
    );
  });

export type SubscriptionDocument = z.infer<typeof documentSchema>;
export type SubscriptionPlan = SubscriptionDocument["plan"];
export type SubscriptionMember = SubscriptionDocument["members"][number];
export type SubscriptionCycle = SubscriptionDocument["cycles"][number];
export type SubscriptionAllocation = SubscriptionCycle["allocations"][number];
export type SubscriptionPayment = SubscriptionAllocation["payments"][number];
export type SharedSubscription = {
  plan: Pick<SubscriptionPlan, "name" | "paymentNote" | "interval">;
  member: Pick<SubscriptionMember, "id" | "name">;
  cycles: Array<
    Pick<
      SubscriptionCycle,
      "id" | "startDate" | "dueDate" | "renewalDate" | "currency"
    > & {
      amountMinor: number;
      payments: Array<Pick<SubscriptionPayment, "amountMinor" | "date">>;
    }
  >;
};

/** Distribute every minor unit once; earlier members receive any remainder. */
export function splitAmount(amountMinor: number, memberIds: string[]) {
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    amountMinor > maxAmount
  )
    throw new Error("Enter a positive amount.");
  if (!memberIds.length || new Set(memberIds).size !== memberIds.length)
    throw new Error("Choose at least one unique member.");
  const share = Math.floor(amountMinor / memberIds.length);
  const remainder = amountMinor % memberIds.length;
  return memberIds.map((memberId, index) => ({
    memberId,
    amountMinor: share + (index < remainder ? 1 : 0),
  }));
}

/** Calculate each boundary from the original anchor, so short months never shift future dates. */
export function cycleDates(
  anchor: string,
  interval: SubscriptionInterval,
  index: number,
) {
  const original = dateValue(anchor);
  if (
    (interval !== "monthly" && interval !== "yearly") ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 1200
  )
    throw new Error("Invalid billing cycle.");
  const boundary = (offset: number) => {
    const month =
      original.getUTCMonth() + offset * (interval === "yearly" ? 12 : 1);
    const first = new Date(Date.UTC(original.getUTCFullYear(), month, 1));
    const lastDay = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    first.setUTCDate(Math.min(original.getUTCDate(), lastDay));
    if (first.getUTCFullYear() > 9999)
      throw new Error("The billing date is too far in the future.");
    return first.toISOString().slice(0, 10);
  };
  return { startDate: boundary(index), renewalDate: boundary(index + 1) };
}

export function todayIST() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("-");
}

export function daysUntil(date: string, today = todayIST()) {
  return Math.round(
    (dateValue(date).getTime() - dateValue(today).getTime()) / 86_400_000,
  );
}

export function money(minor: number, currency: SubscriptionCurrency) {
  if (!Number.isSafeInteger(minor) || minor < 0)
    throw new Error("Invalid amount.");
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-GB", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

/** Convert a human decimal amount without floating-point multiplication or rounding. */
export function parseMoney(input: string) {
  const value = input.trim();
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value))
    throw new Error("Enter an amount with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (result <= 0 || result > maxAmount)
    throw new Error("Enter an amount between 0.01 and 1,000,000.");
  return result;
}

export function paidTotal(allocation: {
  payments: ReadonlyArray<{ amountMinor: number }>;
}) {
  return allocation.payments.reduce(
    (sum, payment) => sum + payment.amountMinor,
    0,
  );
}

export function buildCycle(document: SubscriptionDocument): SubscriptionCycle {
  const validated = documentSchema.parse(document);
  const active = validated.members.filter((member) => member.active);
  const index =
    validated.cycles.reduce(
      (highest, cycle) => Math.max(highest, cycle.index),
      -1,
    ) + 1;
  const { startDate, renewalDate } = cycleDates(
    validated.plan.anchorDate,
    validated.plan.interval,
    index,
  );
  const shares = splitAmount(
    validated.plan.amountMinor,
    active.map((member) => member.id),
  );
  return {
    id: crypto.randomUUID(),
    index,
    startDate,
    dueDate: startDate,
    renewalDate,
    totalMinor: validated.plan.amountMinor,
    currency: validated.plan.currency,
    allocations: shares.map((share, position) => ({
      ...share,
      name: active[position].name,
      payments: [],
    })),
  };
}
