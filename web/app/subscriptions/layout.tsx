import type { Metadata } from "next";
import "./subscriptions.css";
import "./experience.css";
export const metadata: Metadata = {
  title: "Shared plan · Subscription tracker",
  description: "Shared subscription billing and payment status.",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
