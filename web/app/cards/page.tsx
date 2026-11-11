import { Suspense } from "react";
import { CardsManager } from "@/components/cards/CardsManager";
export default function CardsPage() {
  return (
    <Suspense fallback={<main className="cards-app">Opening Cards…</main>}>
      <CardsManager />
    </Suspense>
  );
}
