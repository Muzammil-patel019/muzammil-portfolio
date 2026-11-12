import { organizerSchema, organizerSummary, emptyOrganizer } from "./organizer";
import {
  cardsDocumentSchema,
  emptyCards,
  latestCardBill,
  statementBalance,
} from "./cards";
import {
  documentSchema,
  paidTotal,
  todayIST,
  daysUntil,
} from "./subscriptions";
import {
  renewalDocumentSchema,
  emptyRenewals,
  type RenewalDocument,
} from "./renewals";
export type AgendaItem = {
  id: string;
  kind: "card" | "subscription" | "renewal";
  title: string;
  date: string;
  detail: string;
  href: string;
  amountMinor?: number;
  currency?: string;
};
export type DashboardSummary = {
  organizer: ReturnType<typeof organizerSummary>;
  agenda: AgendaItem[];
  cards: { count: number; balanceMinor: number };
  subscriptions: { count: number; collect: Record<string, number> };
  learning: {
    completed: number;
    total: number;
    activeDays: number;
    lastActivity: string | null;
  };
  pending: {
    payments: number;
    preferences: number;
    joins: number;
    paymentPlanId?: string;
    preferencePlanId?: string;
    joinPlanId?: string;
  };
  sources: Record<string, boolean>;
};
export type DashboardInput = {
  organizer?: unknown;
  cards: unknown;
  plans: { id: string; document: unknown }[];
  learning: unknown;
  renewals: RenewalDocument;
  pending: DashboardSummary["pending"];
  sources: Record<string, boolean>;
};
export function dashboardSummary(input: DashboardInput): DashboardSummary {
  const sources = { ...input.sources };
  const parsed = cardsDocumentSchema.safeParse(input.cards);
  if (!parsed.success) sources.cards = false;
  const cards = parsed.success ? parsed.data : emptyCards();
  const agenda: AgendaItem[] = [],
    collect: Record<string, number> = {};
  let balanceMinor = 0;
  for (const card of cards.cards.filter((c) => !c.archived)) {
    const bill = latestCardBill(cards, card.id);
    if (!bill) continue;
    const balance = statementBalance(bill);
    balanceMinor += balance;
    if (balance > 0)
      agenda.push({
        id: "card-" + bill.id,
        kind: "card",
        title: card.name,
        date: bill.dueDate,
        detail: `Card payment · •••• ${card.last4}`,
        href: `/cards?cardId=${card.id}`,
        amountMinor: balance,
        currency: "INR",
      });
  }
  for (const plan of input.plans) {
    const valid = documentSchema.safeParse(plan.document);
    if (!valid.success) {
      sources.subscriptions = false;
      continue;
    }
    const doc = valid.data;
    const cycle = [...doc.cycles].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    )[0];
    if (!cycle) continue;
    const balance = cycle.allocations.reduce(
      (n, a) => n + Math.max(0, a.amountMinor - paidTotal(a)),
      0,
    );
    collect[cycle.currency] = (collect[cycle.currency] || 0) + balance;
    if (balance > 0)
      agenda.push({
        id: "collection-" + plan.id,
        kind: "subscription",
        title: doc.plan.name,
        date: cycle.dueDate,
        detail: "Collect outstanding member shares",
        href: `/subscriptions?planId=${plan.id}`,
        amountMinor: balance,
        currency: cycle.currency,
      });
    agenda.push({
      id: "subscription-" + plan.id,
      kind: "subscription",
      title: doc.plan.name,
      date: cycle.renewalDate,
      detail: "Plan renewal · check provider",
      href: `/subscriptions?planId=${plan.id}`,
      amountMinor: cycle.totalMinor,
      currency: cycle.currency,
    });
  }
  const renewals = renewalDocumentSchema.safeParse(input.renewals);
  if (!renewals.success) sources.renewals = false;
  for (const item of (renewals.success
    ? renewals.data
    : emptyRenewals()
  ).items.filter((i) => !i.archived))
    agenda.push({
      id: "renewal-" + item.id,
      kind: "renewal",
      title: item.title,
      date: item.dueDate,
      detail: item.category + (item.provider ? " · " + item.provider : ""),
      href: `/dashboard?tab=renewals&item=${item.id}`,
      amountMinor: item.amountMinor || undefined,
      currency: "INR",
    });
  const progress = (
    input.learning && typeof input.learning === "object" ? input.learning : {}
  ) as Record<string, unknown>;
  let completed = 0;
  for (const track of ["python", "pytest", "java"])
    for (let i = 0; i < 3; i++) {
      const unit = progress[track + i];
      if (unit && typeof unit === "object")
        for (const key of ["read", "quiz", "practice"])
          if ((unit as Record<string, unknown>)[key] === true) completed++;
    }
  const days = Array.isArray(progress.days)
    ? [
        ...new Set(
          progress.days.filter(
            (v): v is number =>
              typeof v === "number" && Number.isInteger(v) && v > 0,
          ),
        ),
      ]
    : [];
  const validDays = days.filter(
    (day) =>
      day <=
      Math.floor(new Date(todayIST() + "T00:00:00Z").getTime() / 86400000),
  );
  const last = validDays.length ? Math.max(...validDays) : null;
  const personal = organizerSchema.safeParse(
    input.organizer ?? emptyOrganizer(),
  );
  if (!personal.success) sources.organizer = false;
  return {
    organizer: organizerSummary(
      personal.success ? personal.data : emptyOrganizer(),
    ),
    agenda: agenda.sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
    ),
    cards: {
      count: cards.cards.filter((c) => !c.archived).length,
      balanceMinor,
    },
    subscriptions: { count: input.plans.length, collect },
    learning: {
      completed,
      total: 27,
      activeDays: validDays.length,
      lastActivity: last
        ? new Date(last * 86400000).toISOString().slice(0, 10)
        : null,
    },
    pending: input.pending,
    sources,
  };
}
export const agendaStatus = (date: string) => {
  const days = daysUntil(date);
  return days < 0
    ? `${Math.abs(days)}d overdue`
    : days === 0
      ? "Today"
      : days === 1
        ? "Tomorrow"
        : `In ${days} days`;
};
