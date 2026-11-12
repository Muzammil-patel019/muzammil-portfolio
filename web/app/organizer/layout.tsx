import type { Metadata } from "next";
import "../cards/cards.css";
import "../dashboard/dashboard.css";
import "./organizer.css";
export const metadata: Metadata = {
  title: "Organizer · Your private tools",
  description: "Private spending, applications, savings, reminders and notes.",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
