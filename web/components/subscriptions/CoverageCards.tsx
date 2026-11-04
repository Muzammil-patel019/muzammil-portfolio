"use client";
import { useId } from "react";
import {
  coverageOptions,
  coverageQuote,
  type CoverageMonths,
} from "@/lib/member-billing";
import { money, type SubscriptionCurrency } from "@/lib/subscriptions";
type BillingPeriod = {
  startDate: string;
  renewalDate: string;
  amountMinor: number;
  payments: { amountMinor: number }[];
  currency: SubscriptionCurrency;
};
export function CoverageCards({
  cycle,
  value,
  onChange,
  disabled = false,
  creditMinor = 0,
}: {
  cycle: BillingPeriod;
  value: CoverageMonths;
  onChange: (months: CoverageMonths) => void;
  disabled?: boolean;
  creditMinor?: number;
}) {
  const id = useId();
  return (
    <fieldset className="coverage-cards" disabled={disabled}>
      <legend>Choose your payment plan</legend>
      <div className="coverage-card-grid">
        {coverageOptions.map((option) => {
          const quote = coverageQuote(cycle, option.months, creditMinor);
          return (
            <label
              className="coverage-card"
              key={option.months}
              data-selected={value === option.months}
            >
              <input
                type="radio"
                name={id}
                value={option.months}
                checked={value === option.months}
                onChange={() => onChange(option.months)}
                aria-label={option.label}
              />
              <span className="coverage-card-heading">
                {option.label}
                <span aria-hidden="true" className="coverage-check">
                  {value === option.months ? "✓" : ""}
                </span>
              </span>
              <strong>{money(quote.amountMinor, cycle.currency)}</strong>
              <span className="coverage-card-period">
                {option.months === 1 ? "1 month" : `${option.months} months`} of
                coverage
              </span>
              <small>
                {quote.amountMinor === 0
                  ? "Covered by recorded payments and credit"
                  : "Upfront amount at the current rate"}
              </small>
              <span className="coverage-card-date">
                Through{" "}
                {new Intl.DateTimeFormat("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(quote.endDate + "T00:00:00Z"))}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
