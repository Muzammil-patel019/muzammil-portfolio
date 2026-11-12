import { Suspense } from "react";
import { PersonalHub } from "@/components/dashboard/PersonalHub";
export default function Page() {
  return (
    <Suspense
      fallback={<main className="cards-app">Opening your dashboard…</main>}
    >
      <PersonalHub />
    </Suspense>
  );
}
