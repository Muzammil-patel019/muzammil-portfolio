import type { Metadata } from "next";
import "../cards/cards.css";
import "./dashboard.css";
export const metadata: Metadata = {
  title: "Personal Hub · Private dashboard",
  description: "Private cards, shared plans, renewals and learning overview.",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
