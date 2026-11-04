import type { SubscriptionCurrency } from "./subscriptions";
export const billingLabels: Record<string, { label: string; period: string }> =
  {
    monthly: { label: "Monthly", period: "month" },
    quarterly: { label: "Quarterly", period: "3 months" },
    "half-yearly": { label: "Six-monthly", period: "6 months" },
    yearly: { label: "Yearly", period: "year" },
  };
export type StatementCycle = {
  id: string;
  startDate: string;
  renewalDate: string;
  dueDate: string;
  currency: SubscriptionCurrency;
  amountMinor: number;
  payments: { amountMinor: number; date: string; sourceCreditId?: string }[];
};
// Quote every field and neutralize spreadsheet formulas in user-entered names.
export function statementCSV(name: string, cycles: StatementCycle[]) {
  const cell = (value: string | number) => {
    let text = String(value);
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows: (string | number)[][] = [
    [
      "Subscription",
      "Period starts",
      "Period ends",
      "Pay by",
      "Currency",
      "Share",
      "Received incl. applied credit",
      "Balance",
      "Status",
    ],
  ];
  for (const cycle of cycles) {
    const paid = cycle.payments.reduce(
      (sum, payment) => sum + payment.amountMinor,
      0,
    );
    const balance = Math.max(0, cycle.amountMinor - paid);
    rows.push([
      name,
      cycle.startDate,
      cycle.renewalDate,
      cycle.dueDate,
      cycle.currency,
      (cycle.amountMinor / 100).toFixed(2),
      (paid / 100).toFixed(2),
      (balance / 100).toFixed(2),
      balance === 0 ? "Settled" : paid > 0 ? "Part paid" : "Unpaid",
    ]);
  }
  return (
    "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n"
  );
}
export function downloadStatement(name: string, cycles: StatementCycle[]) {
  const url = URL.createObjectURL(
    new Blob([statementCSV(name, cycles)], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "subscription-statement.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
