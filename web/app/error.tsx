"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="studio flex min-h-screen items-center justify-center p-6">
      <div className="panel max-w-lg">
        <h1>Let’s try that again.</h1>
        <p className="mt-4">
          This page couldn’t load. Try again, or return to the portfolio.
        </p>
        <div className="flex items-center gap-4">
          <button className="primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="text-violet-700 underline">
            Portfolio
          </Link>
        </div>
      </div>
    </main>
  );
}
