import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Muzammil Patel — Test Automation Engineer",
  description:
    "Healthcare test automation, selected work, and a private resume studio.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
