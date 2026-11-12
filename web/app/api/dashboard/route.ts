import { NextRequest, NextResponse } from "next/server";
import { owner, apiError } from "@/lib/server";
import { dashboardSummary } from "@/lib/dashboard";
import { emptyCards } from "@/lib/cards";
import { emptyRenewals } from "@/lib/renewals";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
export async function GET(request: NextRequest) {
  try {
    const { db, user } = await owner(request);
    const results = await Promise.allSettled([
      db
        .from("card_trackers")
        .select("document")
        .eq("owner_id", user.id)
        .maybeSingle(),
      db
        .from("subscription_plans")
        .select("id,document")
        .eq("owner_id", user.id),
      db
        .from("learning_progress")
        .select("document")
        .eq("owner_id", user.id)
        .maybeSingle(),
      db
        .from("renewal_trackers")
        .select("document")
        .eq("owner_id", user.id)
        .maybeSingle(),
      db
        .from("subscription_payment_reports")
        .select("plan_id", { count: "exact" })
        .eq("owner_id", user.id)
        .is("confirmed_at", null)
        .not("reported_at", "is", null)
        .limit(1),
      db
        .from("subscription_shares")
        .select("plan_id", { count: "exact" })
        .eq("owner_id", user.id)
        .not("requested_months", "is", null)
        .limit(1),
      db
        .from("subscription_join_requests")
        .select("plan_id", { count: "exact" })
        .eq("owner_id", user.id)
        .eq("status", "pending")
        .limit(1),
      db
        .from("personal_organizers")
        .select("document")
        .eq("owner_id", user.id)
        .maybeSingle(),
    ]);
    const names = [
      "cards",
      "subscriptions",
      "learning",
      "renewals",
      "payments",
      "preferences",
      "joins",
      "organizer",
    ];
    const sources: Record<string, boolean> = {};
    const values = results.map((r, i) => {
      sources[names[i]] = r.status === "fulfilled" && !r.value.error;
      return r.status === "fulfilled" && !r.value.error ? r.value : null;
    });
    const objectDocument = (index: number) => {
      const data = values[index]?.data;
      return data && !Array.isArray(data) && "document" in data
        ? data.document
        : null;
    };
    const planData = values[1]?.data;
    const plans = Array.isArray(planData)
      ? planData.filter(
          (row): row is { id: string; document: unknown } =>
            "id" in row && "document" in row,
        )
      : [];
    const pendingPlan = (index: number) => {
      const data = values[index]?.data;
      return Array.isArray(data) && data[0] && "plan_id" in data[0]
        ? String(data[0].plan_id)
        : undefined;
    };
    const summary = dashboardSummary({
      cards: objectDocument(0) || emptyCards(),
      plans,
      learning: objectDocument(2) || {},
      renewals: objectDocument(3) || emptyRenewals(),
      pending: {
        payments: values[4]?.count || 0,
        preferences: values[5]?.count || 0,
        joins: values[6]?.count || 0,
        paymentPlanId: pendingPlan(4),
        preferencePlanId: pendingPlan(5),
        joinPlanId: pendingPlan(6),
      },
      organizer: objectDocument(7),
      sources,
    });
    return NextResponse.json(summary, { headers });
  } catch (e) {
    const response = apiError(e);
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }
}
