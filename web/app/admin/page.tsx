import { Suspense } from "react";
import { Editor } from "@/components/Editor";
export const metadata = {
  title: "Private resume studio",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p>Loading studio…</p>}>
      <Editor />
    </Suspense>
  );
}
