"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { browserClient } from "@/lib/supabase";
export default function Login() {
  const db = useMemo(() => browserClient(), []);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  return (
    <main className="studio flex min-h-screen items-center justify-center p-5">
      <div className="panel w-full max-w-md">
        <Link href="/" className="text-violet-700">
          ← Portfolio
        </Link>
        <h1 className="mt-6!">Resume studio</h1>
        <p className="mt-3 text-stone-600">
          Your experience. Your versions. Your next opportunity.
        </p>
        {!db ? (
          <>
            <div className="notice">
              Owner login isn’t configured yet. Follow web/README.md to connect
              Supabase. No account can sign in until setup is complete.
            </div>
            <Link
              className="mt-6 inline-block text-violet-700 underline"
              href="/admin?demo=1"
            >
              Explore the local demo →
            </Link>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const { error } = await db.auth.signInWithPassword({
                  email,
                  password,
                });
                if (error)
                  setMessage(
                    "Sign-in failed. Check your credentials and try again.",
                  );
                else window.location.assign(new URLSearchParams(window.location.search).get("next") === "learning" ? "/learning" : "/admin");
              } catch {
                setMessage(
                  "Could not connect. Check your internet connection and try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="mt-2 text-sm"
              aria-pressed={showPassword}
              aria-controls="password"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Hide password" : "Show password"}
            </button>
            <button className="primary mt-5 w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p role="status" className="mt-3 text-red-700">
              {message}
            </p>
            <p className="mt-5 text-xs text-stone-500">
              Owner accounts are provisioned privately. There is no public
              registration.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
