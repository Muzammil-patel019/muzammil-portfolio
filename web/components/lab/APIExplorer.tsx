"use client";
import { useEffect, useState } from "react";
const requests = [
  { label: "Service health", path: "/health" },
  { label: "All products", path: "/products" },
  { label: "One product", path: "/products/p-001" },
  { label: "Missing product · 404", path: "/products/not-a-product" },
  { label: "Invalid page · 400", path: "/products?page=0" },
];
export function APIExplorer({
  selectedPath = "/products",
}: {
  selectedPath?: string;
}) {
  const [path, setPath] = useState(selectedPath),
    [query, setQuery] = useState(""),
    [result, setResult] = useState<{
      status: number;
      ms: number;
      body: unknown;
      url: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [origin, setOrigin] = useState("https://www.muzammilpatel.com");
  useEffect(() => {
    setOrigin(location.origin);
  }, []);
  const url =
    "/api/lab" +
    path +
    (query.trim()
      ? (path.includes("?") ? "&" : "?") + query.trim().replace(/^\?/, "")
      : "");
  async function send() {
    setBusy(true);
    setError("");
    const start = performance.now();
    try {
      const r = await fetch(url, { cache: "no-store", credentials: "omit" }),
        body = await r.json();
      setResult({
        status: r.status,
        ms: Math.round(performance.now() - start),
        body,
        url,
      });
    } catch {
      setError(
        "The request could not reach the lab. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const curl = `curl -i '${origin}${url}'`;
  return (
    <div className="lab-api-layout">
      <section className="lab-panel">
        <p className="lab-eyebrow">YOUR FIRST API CLIENT</p>
        <h2>Send a real request.</h2>
        <p className="lab-muted">
          Choose an endpoint. Change the query. Inspect what comes back.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="lab-endpoint">Endpoint</label>
          <select
            id="lab-endpoint"
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
              setQuery("");
            }}
          >
            {!requests.some((r) => r.path === path) && (
              <option value={path}>{path}</option>
            )}
            {requests.map((r) => (
              <option key={r.path} value={r.path}>
                {r.label}
              </option>
            ))}
          </select>
          <label htmlFor="lab-query">Query parameters (optional)</label>
          <input
            id="lab-query"
            value={query}
            maxLength={500}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="category=desk&sort=price-asc"
          />
          <div className="lab-request-line">
            <b>GET</b>
            <code data-testid="request-url">{url}</code>
          </div>
          <button className="lab-primary" disabled={busy} type="submit">
            {busy ? "Sending…" : "Send request →"}
          </button>
        </form>
        <p className="lab-inline-error" role="status">
          {error}
        </p>
        <div className="lab-code-heading">
          <h3>Try it in your terminal</h3>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(curl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setError(
                  "Copy is unavailable. Select the command below to copy it manually.",
                );
              }
            }}
          >
            {copied ? "Copied" : "Copy command"}
          </button>
        </div>
        <pre className="lab-code">{curl}</pre>
        <a
          className="lab-text-link"
          href="/api/lab/openapi"
          target="_blank"
          rel="noreferrer"
        >
          OpenAPI specification →
        </a>
      </section>
      <section className="lab-terminal" aria-label="API response">
        <div className="lab-terminal-bar">
          <span>
            <i />
            <i />
            <i />
          </span>
          <small>response.json</small>
          {result && (
            <b data-error={result.status >= 400}>
              {result.status} · {result.ms} ms
            </b>
          )}
        </div>
        {result ? (
          <>
            <p className="lab-response-url">GET {result.url}</p>
            <pre data-testid="api-response">
              {JSON.stringify(result.body, null, 2)}
            </pre>
          </>
        ) : (
          <div className="lab-terminal-empty">
            <span>{"{ }"}</span>
            <h3>Your response appears here</h3>
            <p>Start with Health to check the service is ready.</p>
          </div>
        )}
      </section>
      <section className="lab-panel lab-api-contract">
        <p className="lab-eyebrow">THE CONTRACT</p>
        <h2>Predictable inputs. Inspectable outputs.</h2>
        <div className="lab-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Accepted values</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["q", "Text, up to 80 characters", "Empty"],
                ["category", "all / tech / desk / everyday", "all"],
                [
                  "sort",
                  "featured / price-asc / price-desc / name",
                  "featured",
                ],
                ["stock", "all / in / out", "all"],
                ["page", "Integer, 1–1000", "1"],
                ["pageSize", "Integer, 1–24", "6"],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="lab-muted">
          List responses contain data, pagination and the normalized query.
          Unknown, repeated or invalid parameters return 400. Unknown product
          IDs return 404. An empty search returns 200 with an empty array.
          Prices use integer paise: 100 paise = ₹1.
        </p>
        <p className="lab-muted">
          This stage has read-only endpoints and fixed sample data.
          Authentication, writes and database resets arrive in later stages.
          Requests here use only the lab API.
        </p>
      </section>
    </div>
  );
}
