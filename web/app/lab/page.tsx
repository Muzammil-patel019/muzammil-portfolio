import { Suspense } from "react";
import { AutomationLab } from "@/components/lab/AutomationLab";
export default function Page() {
  return (
    <Suspense
      fallback={<main className="lab-app">Opening Automation Lab…</main>}
    >
      <AutomationLab />
    </Suspense>
  );
}
