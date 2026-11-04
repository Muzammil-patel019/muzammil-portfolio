"use client";
import { useState } from "react";
import {
  money,
  todayIST,
  type SubscriptionCurrency,
} from "@/lib/subscriptions";
type Event = {
  date: string;
  amountMinor: number;
  currency: SubscriptionCurrency;
  sourceCreditId?: string;
};
export function PaymentActivity({
  events,
  joinedDate,
}: {
  events: Event[];
  joinedDate?: string;
}) {
  const today = todayIST(),
    currentYear = +today.slice(0, 4),
    firstYear = Math.min(
      currentYear,
      ...events.map((e) => +e.date.slice(0, 4)),
      joinedDate ? +joinedDate.slice(0, 4) : currentYear,
    );
  const [year, setYear] = useState(currentYear),
    [selected, setSelected] = useState("");
  const daily = new Map<string, Map<SubscriptionCurrency, number>>();
  const counts=new Map<string,number>();
  for (const event of events) {
    if (event.sourceCreditId) continue;
    counts.set(event.date,(counts.get(event.date)||0)+1);
    const amounts =
      daily.get(event.date) || new Map<SubscriptionCurrency, number>();
    amounts.set(
      event.currency,
      (amounts.get(event.currency) || 0) + event.amountMinor,
    );
    daily.set(event.date, amounts);
  }
  const date = new Date(Date.UTC(year, 0, 1)),
    offset = (date.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(offset).fill(null);
  while (date.getUTCFullYear() === year) {
    cells.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const describe = (day: string) => {
    const amounts = daily.get(day);
    return `${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(day + "T00:00:00Z"))}: ${amounts ? [...amounts].map(([currency, value]) => money(value, currency)).join(", ") + " confirmed" : "No confirmed payment"}`;
  };
  return (
    <section className="plan-box plan-activity">
      <div className="plan-section-head">
        <div>
          <p className="plan-label">PAYMENT ACTIVITY</p>
          <h2>
            {[...daily.keys()].filter((d) => d.startsWith(String(year))).length}{" "}
            paid days
          </h2>
        </div>
        <label className="plan-activity-year">
          Year
          <select
            aria-label="Payment activity year"
            value={year}
            onChange={(e) => {
              setYear(+e.target.value);
              setSelected("");
            }}
          >
            {Array.from(
              { length: currentYear - firstYear + 1 },
              (_, i) => currentYear - i,
            ).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="plan-activity-scroll">
        <div className="plan-activity-months">
          {"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec"
            .split(" ")
            .map((m) => (
              <span key={m}>{m}</span>
            ))}
        </div>
        <div
          className="plan-activity-grid"
          aria-label={`Confirmed payments in ${year}`}
        >
          {cells.map((day, i) =>
            day ? (
              <button
                key={day}
                type="button"
                title={describe(day)}
                aria-label={describe(day)}
                disabled={
                  day > today ||
                  (!!joinedDate && day < joinedDate && !daily.has(day))
                }
                tabIndex={daily.has(day) ? 0 : -1}
                data-paid={daily.has(day)}
                data-level={Math.min(4, counts.get(day) || 0)}
                onClick={() => setSelected(describe(day))}
              />
            ) : (
              <span key={`padding-${i}`} />
            ),
          )}
        </div>
      </div>
      <div className="plan-activity-legend">
        <span>Confirmed payments only</span>
        <span>
          No payment <i /> <i data-level="1"/><i data-level="2"/><i data-level="3"/><i data-level="4"/> More
        </span>
      </div>
      {selected && (
        <p className="plan-activity-selection" role="status">
          {selected}
        </p>
      )}
    </section>
  );
}
