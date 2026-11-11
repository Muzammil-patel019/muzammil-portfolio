import type { Metadata } from "next";
import "./cards.css";
export const metadata: Metadata = {
  title: "Cards · Private finance tracker",
  description: "Private card statements and payment history.",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
