import type { Metadata } from "next";
import "./lab.css";
export const metadata: Metadata = {
  title: "Automation Lab · Build. Test. Understand.",
  description:
    "A fictional storefront and documented API for learning test automation, one stage at a time.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
