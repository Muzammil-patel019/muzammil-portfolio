import Link from "next/link";
export default function NotFound() {
  return (
    <main className="studio flex min-h-screen items-center justify-center p-6">
      <div className="panel max-w-lg">
        <p className="text-sm text-violet-700">404 / PAGE NOT FOUND</p>
        <h1>This page wandered off.</h1>
        <p className="mt-4">
          The link may be outdated. Your portfolio and resume are still here.
        </p>
        <Link className="text-violet-700 underline" href="/">
          Back to the portfolio →
        </Link>
      </div>
    </main>
  );
}
