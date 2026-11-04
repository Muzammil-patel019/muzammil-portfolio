import {
  cycleDates,
  type SubscriptionDocument,
  type SubscriptionCycle,
  paidTotal,
} from "./subscriptions";
export const coverageOptions = [
  { months: 1, label: "Monthly" },
  { months: 3, label: "Quarterly" },
  { months: 6, label: "6 months" },
  { months: 12, label: "Yearly" },
] as const;
export type CoverageMonths = 1 | 3 | 6 | 12;
export function coverageQuote(
  cycle: {
    startDate: string;
    renewalDate: string;
    amountMinor: number;
    payments: { amountMinor: number }[];
  },
  months: CoverageMonths,
  availableCreditMinor = 0,
) {
  const start = new Date(cycle.startDate + "T00:00:00Z"),
    end = new Date(cycle.renewalDate + "T00:00:00Z");
  const baseMonths = Math.max(
    1,
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      end.getUTCMonth() -
      start.getUTCMonth(),
  );
  const amountMinor = Math.max(
    0,
    Math.round((cycle.amountMinor * months) / baseMonths) -
      paidTotal(cycle) -
      availableCreditMinor,
  );
  const endDate = cycleDates(cycle.startDate, "monthly", months).startDate;
  return { amountMinor, startDate: cycle.startDate, endDate, baseMonths };
}
export function recordMemberReceipt(
  doc: SubscriptionDocument,
  cycleId: string,
  memberId: string,
  amountMinor: number,
  date: string,
  note: string,
  months?: CoverageMonths,
) {
  const cycle = doc.cycles.find((c) => c.id === cycleId),
    allocation = cycle?.allocations.find((a) => a.memberId === memberId);
  if (
    !cycle ||
    !allocation ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    amountMinor > 100_000_000
  )
    throw new Error("Enter a valid received amount.");
  const balance = allocation.amountMinor - paidTotal(allocation),
    current = Math.min(balance, amountMinor);
  if (current > 0)
    allocation.payments.push({
      id: crypto.randomUUID(),
      amountMinor: current,
      date,
      note,
    });
  if (amountMinor > current) {
    const term = months || 1;
    const quote = coverageQuote(
      { ...cycle, amountMinor: allocation.amountMinor, payments: [] },
      term,
    );
    (doc.credits ??= []).push({
      id: crypto.randomUUID(),
      memberId,
      amountMinor: amountMinor - current,
      remainingMinor: amountMinor - current,
      currency: cycle.currency,
      date,
      startDate: cycle.startDate,
      endDate: quote.endDate,
    });
  }
}
export function applyAdvanceCredit(
  doc: SubscriptionDocument,
  cycle: SubscriptionCycle,
) {
  for (const allocation of cycle.allocations) {
    let balance = allocation.amountMinor - paidTotal(allocation);
    for (const credit of doc.credits || []) {
      if (
        credit.memberId !== allocation.memberId ||
        credit.currency !== cycle.currency ||
        credit.remainingMinor <= 0 ||
        balance <= 0 ||
        cycle.startDate < credit.startDate
      )
        continue;
      const amountMinor = Math.min(balance, credit.remainingMinor);
      allocation.payments.push({
        id: crypto.randomUUID(),
        amountMinor,
        date: cycle.startDate,
        note: "Applied from advance credit",
        sourceCreditId: credit.id,
      });
      credit.remainingMinor -= amountMinor;
      balance -= amountMinor;
    }
  }
}
