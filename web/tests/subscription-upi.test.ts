import { test } from "node:test";
import assert from "node:assert/strict";
import { subscriptionUpiPayment } from "../lib/subscription-upi";
const cycle = {
  startDate: "2026-10-01",
  renewalDate: "2026-11-01",
  currency: "INR",
  amountMinor: 5980,
  payments: [{ amountMinor: 1000 }],
};
test("UPI request sends only remaining share with the actual historical billing month", () => {
  const payment = subscriptionUpiPayment("YouTube Premium", cycle)!;
  const url = new URL(payment.href);
  assert.equal(url.protocol, "upi:");
  assert.equal(url.searchParams.get("pa"), "muzammilytpremium@axl");
  assert.equal(url.searchParams.get("am"), "49.80");
  assert.equal(url.searchParams.get("cu"), "INR");
  assert.match(url.searchParams.get("tn")!, /October 2026/);
});
test("settled, non-INR, and unrelated plans never offer a payment to the YouTube payee", () => {
  assert.equal(subscriptionUpiPayment("Netflix", cycle), null);
  assert.equal(
    subscriptionUpiPayment("YT Premium", { ...cycle, currency: "USD" }),
    null,
  );
  assert.equal(
    subscriptionUpiPayment("YT Premium", {
      ...cycle,
      payments: [{ amountMinor: 5980 }],
    }),
    null,
  );
});
