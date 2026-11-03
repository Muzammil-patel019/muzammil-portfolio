import { Suspense } from "react";
import { SubscriptionManager } from "@/components/subscriptions/SubscriptionManager";
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="plan-app">
          <p>Opening your plan…</p>
        </main>
      }
    >
      <SubscriptionManager />
    </Suspense>
  );
}
