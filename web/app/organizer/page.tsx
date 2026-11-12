import { Suspense } from "react";
import { Organizer } from "@/components/organizer/Organizer";
export default function Page() {
  return (
    <Suspense
      fallback={<main className="cards-app">Opening your organizer…</main>}
    >
      <Organizer />
    </Suspense>
  );
}
