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
  payee?: { upiId?: string; payeeName?: string },
) {
  const upiId =
    payee?.upiId ||
    (/^(?:youtube|yt)\s*premium$/i.test(planName.trim()) ? youtubeUpiId : "");
  if (
    !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(upiId) ||
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
  const note = `${planName.slice(0, 24)} - ${month}`;
  const params = new URLSearchParams({
    pa: upiId,
    pn: payee?.payeeName || "Muzammil",
    am: (remaining / 100).toFixed(2),
    cu: "INR",
    tn: note,
  });
  return { href: `upi://pay?${params.toString()}`, note, upiId };
}
