/** Personal YouTube cost sharing; other plans must configure their own payee. */
export const youtubeUpiId = "muzammilytpremium@axl";
export function subscriptionUpiPayment(
  planName: string,
  cycle: {
    startDate: string;
    renewalDate: string;
    currency: string;
    amountMinor: number;
    payments: { amountMinor: number }[];
  },
) {
  if (
    !/^(?:youtube|yt)\s*premium$/i.test(planName.trim()) ||
    cycle.currency !== "INR"
  )
    return null;
  const remaining =
    cycle.amountMinor -
    cycle.payments.reduce((sum, p) => sum + p.amountMinor, 0);
  if (!Number.isSafeInteger(remaining) || remaining <= 0) return null;
  const date = new Date(`${cycle.startDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  const month = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const note = `YT Premium - ${month}`;
  const params = new URLSearchParams({
    pa: youtubeUpiId,
    pn: "Muzammil",
    am: (remaining / 100).toFixed(2),
    cu: "INR",
    tn: note,
  });
  return { href: `upi://pay?${params.toString()}`, note, upiId: youtubeUpiId };
}
