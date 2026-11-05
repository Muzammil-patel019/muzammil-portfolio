import { ThemeToggle } from "@/components/ThemeToggle";
import type { Metadata } from "next";
import "./globals.css";
import "./refinement.css";
export const metadata: Metadata = {
  title: "Muzammil Patel — Test Automation Engineer",
  description:
    "Healthcare test automation, selected work, and a private resume studio.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><link rel="stylesheet" href="/theme.css"/><script src="/theme.js" /></head>
      <body>{children}<ThemeToggle /></body>
    </html>
  );
}
