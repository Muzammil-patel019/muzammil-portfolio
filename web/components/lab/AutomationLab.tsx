"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { labMoney, type Product, type listProducts } from "@/lib/lab/catalogue";
import { exercises } from "@/lib/lab/learning";
import { ProductArt } from "./ProductArt";
import { APIExplorer } from "./APIExplorer";
import { PracticeStore } from "./PracticeStore";
import { LearningPath } from "./LearningPath";
type View = "store" | "api" | "learn" | "practice";
type Catalogue = ReturnType<typeof listProducts>;
const storageKey = "mp-automation-lab-progress-v1";
export function AutomationLab() {
  const params = useSearchParams(),
    initial = params.get("view"),
    [view, setView] = useState<View>(
      initial === "api" || initial === "learn" || initial === "practice"
        ? initial
        : "store",
    );
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [stock, setStock] = useState("all"),
    [sort, setSort] = useState("featured"),
    [page, setPage] = useState(1),
    [retry, setRetry] = useState(0);
  const [data, setData] = useState<Catalogue | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [health, setHealth] = useState("Checking API"),
    [completed, setCompleted] = useState<string[]>([]),
    [apiPath, setAPIPath] = useState("/products");
  const [detailID, setDetailID] = useState<string | null>(null),
    [detail, setDetail] = useState<Product | null>(null),
    [detailError, setDetailError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const value = params.get("view");
    setView(
      value === "api" || value === "learn" || value === "practice"
        ? value
        : "store",
    );
  }, [params]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(stored))
        setCompleted([
          ...new Set(
            stored.filter(
              (id): id is string =>
                typeof id === "string" && exercises.some((e) => e.id === id),
            ),
          ),
        ]);
    } catch {
      setMessage(
        "Progress stays in this session because browser storage is unavailable.",
      );
    }
    const c = new AbortController();
    fetch("/api/lab/health", {
      signal: c.signal,
      credentials: "omit",
      cache: "no-store",
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok || b.status !== "ok") throw Error();
        setHealth("API reachable");
      })
      .catch(() => {
        if (!c.signal.aborted) setHealth("API unavailable");
      });
    return () => c.abort();
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    const p = new URLSearchParams({
      q: query,
      category,
      stock,
      sort,
      page: String(page),
      pageSize: "6",
    });
    fetch("/api/lab/products?" + p, {
      signal: c.signal,
      cache: "no-store",
      credentials: "omit",
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error?.message || "Could not load products.");
        if (!Array.isArray(b.data) || !b.pagination)
          throw Error("Unexpected catalogue response.");
        setData(b);
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(e.message || "Could not reach the lab.");
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [query, category, stock, sort, page, retry]);
  useEffect(() => {
    if (!detailID) {
      dialog.current?.close();
      return;
    }
    const c = new AbortController();
    setDetail(null);
    setDetailError("");
    dialog.current?.showModal();
    fetch("/api/lab/products/" + encodeURIComponent(detailID), {
      signal: c.signal,
      credentials: "omit",
      cache: "no-store",
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok)
          throw Error(b.error?.message || "Could not load this product.");
        setDetail(b.data);
      })
      .catch((e) => {
        if (!c.signal.aborted) setDetailError(e.message);
      });
    return () => c.abort();
  }, [detailID]);
  function navigate(next: View, path?: string) {
    if (path) setAPIPath(path);
    setView(next);
    setDetailID(null);
    history.replaceState(
      null,
      "",
      `/lab${next !== "store" ? "?view=" + next : ""}`,
    );
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function toggleTask(id: string) {
    const next = completed.includes(id)
      ? completed.filter((x) => x !== id)
      : [...completed, id];
    setCompleted(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setMessage("Progress is kept for this session only.");
    }
  }
  function reset() {
    if (
      !confirm("Reset your lab filters and locally marked exercise progress?")
    )
      return;
    setSearch("");
    setQuery("");
    setCategory("all");
    setStock("all");
    setSort("featured");
    setPage(1);
    setCompleted([]);
    setRetry((x) => x + 1);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    navigate("store");
    setMessage(
      "Workspace reset. The server catalogue remains the original 12 sample products.",
    );
  }
  const title =
    view === "store"
      ? "A little shop. A lot to test."
      : view === "api"
        ? "Look under the hood."
        : view === "practice"
          ? "Make a change. Prove it works."
          : "Learn it. Build it. Test it.";
  return (
    <main className="lab-app">
      <aside className="lab-sidebar">
        <a href="/lab" className="lab-brand">
          <span aria-hidden="true">a/</span>
          <div>
            automation<span>lab.</span>
          </div>
        </a>
        <p className="lab-sidebar-caption">YOUR ENGINEERING PLAYGROUND</p>
        <nav aria-label="Lab workspaces">
          {(
            [
              { id: "store", label: "Storefront", icon: "01" },
              { id: "api", label: "API Explorer", icon: "02" },
              { id: "learn", label: "Learning path", icon: "03" },
              { id: "practice", label: "Practice store", icon: "04" },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              aria-pressed={view === n.id}
              onClick={() => navigate(n.id)}
            >
              <span>{n.icon}</span>
              {n.label}
              <b>→</b>
            </button>
          ))}
        </nav>
        <div className="lab-sidebar-bottom">
          <div className="lab-stage">
            <span className="lab-dot" />
            PRACTICE WORKFLOWS LIVE
            <h3>
              Start small.
              <br />
              Understand everything.
            </h3>
            <p>Explore the app before building your framework.</p>
            <button onClick={() => navigate("learn")}>
              Your first exercises →
            </button>
          </div>
          <p>
            Made for practice.
            <br />
            All products and inventory are fictional.
          </p>
        </div>
      </aside>
      <div className="lab-main">
        <header className="lab-topbar">
          <span className="lab-breadcrumb">
            WORKSPACE{" "}
            <b>
              /{" "}
              {view === "store"
                ? "Storefront"
                : view === "api"
                  ? "API Explorer"
                  : "Learning path"}
            </b>
          </span>
          <div>
            <span className="lab-environment">
              <i />
              Practice environment
            </span>
            <button className="lab-reset" onClick={reset}>
              ↺ Reset workspace
            </button>
          </div>
        </header>
        <section className="lab-hero">
          <div>
            <p className="lab-eyebrow">
              AUTOMATION LAB / ENGINEERING PLAYGROUND
            </p>
            <h1>{title}</h1>
            <p>
              {view === "store"
                ? "A real catalogue, predictable data and room to experiment. Your first step from clicking around to understanding how applications work."
                : view === "api"
                  ? "Same application. Different entry point. Send HTTP requests and compare the response with what you see on screen."
                  : "Ten stages from your first HTTP request to a test framework you can maintain. We’ll build the application and your understanding together."}
            </p>
          </div>
          <div className="lab-hero-stamp">
            <span>BUILD</span>
            <b>→</b>
            <span>TEST</span>
            <b>→</b>
            <span>UNDERSTAND</span>
          </div>
        </section>
        {message && (
          <p className="lab-notice" role="status">
            {message}
            <button aria-label="Dismiss notice" onClick={() => setMessage("")}>
              ×
            </button>
          </p>
        )}
        {view === "store" && (
          <>
            <section className="lab-stats" aria-label="Lab overview">
              <div>
                <span>Sample products</span>
                <strong>
                  12<small> across 3 categories</small>
                </strong>
              </div>
              <div>
                <span>Backend connection</span>
                <strong className="lab-health">
                  <i data-ok={health === "API reachable"} />
                  {health}
                </strong>
              </div>
              <button onClick={() => navigate("learn")}>
                <span>Your exploration</span>
                <strong>
                  {completed.length}/10<small> exercises marked</small>
                </strong>
                <b>→</b>
              </button>
            </section>
            <div className="lab-store-heading">
              <div>
                <p className="lab-eyebrow">THE SAMPLE STORE</p>
                <h2>Objects for a good day.</h2>
              </div>
              <button className="lab-text-link" onClick={() => navigate("api")}>
                Inspect the product API →
              </button>
            </div>
            <form
              className="lab-filterbar"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search.trim());
                setPage(1);
              }}
            >
              <div className="lab-search">
                <label htmlFor="lab-search">Search products</label>
                <div>
                  <input
                    id="lab-search"
                    type="search"
                    placeholder="Try ‘Orbit’ or ‘notebook’"
                    maxLength={80}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button className="lab-primary" type="submit">
                    Search
                  </button>
                </div>
              </div>
              <label>
                Availability
                <select
                  aria-label="Availability"
                  value={stock}
                  onChange={(e) => {
                    setStock(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All products</option>
                  <option value="in">In stock</option>
                  <option value="out">Out of stock</option>
                </select>
              </label>
              <label>
                Sort by
                <select
                  aria-label="Sort by"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="name">Name: A–Z</option>
                </select>
              </label>
            </form>
            <div className="lab-results-heading">
              <div
                className="lab-category-tabs"
                role="group"
                aria-label="Product categories"
              >
                {["all", "tech", "desk", "everyday"].map((c) => (
                  <button
                    key={c}
                    aria-pressed={category === c}
                    onClick={() => {
                      setCategory(c);
                      setPage(1);
                    }}
                  >
                    {c === "all"
                      ? "Everything"
                      : c[0].toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
              <p role="status" aria-live="polite">
                {loading
                  ? "Loading catalogue…"
                  : error
                    ? "Catalogue unavailable"
                    : `${data?.pagination.total || 0} results · Page ${page} of ${Math.max(1, data?.pagination.totalPages || 0)}`}
              </p>
            </div>
            {error ? (
              <section className="lab-empty lab-panel" role="alert">
                <h3>Couldn’t load the catalogue.</h3>
                <p>{error}</p>
                <button
                  className="lab-primary"
                  onClick={() => setRetry((x) => x + 1)}
                >
                  Retry catalogue
                </button>
              </section>
            ) : loading ? (
              <div className="lab-product-grid" aria-label="Loading products">
                {[0, 1, 2].map((i) => (
                  <div className="lab-product-skeleton" key={i} />
                ))}
              </div>
            ) : data?.data.length ? (
              <section className="lab-product-grid" aria-label="Products">
                {data.data.map((p) => (
                  <article
                    className="lab-product"
                    key={p.id}
                    data-testid={"product-" + p.id}
                  >
                    <div className="lab-product-image">
                      <ProductArt product={p} />
                      <span className="lab-stock" data-out={!p.stock}>
                        {p.stock === 0
                          ? "Out of stock"
                          : p.stock <= 4
                            ? "Only " + p.stock + " left"
                            : "In stock"}
                      </span>
                      <span className="lab-product-id">
                        {p.id.toUpperCase()}
                      </span>
                    </div>
                    <div className="lab-product-info">
                      <p className="lab-product-category">
                        {p.category}
                        <span>★ {p.rating.toFixed(1)}</span>
                      </p>
                      <h3>{p.name}</h3>
                      <div>
                        <strong>{labMoney(p.priceMinor)}</strong>
                        <button
                          aria-label={"View " + p.name}
                          onClick={() => setDetailID(p.id)}
                        >
                          View product <span>→</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            ) : (
              <section className="lab-empty lab-panel">
                <span>{"[ ∅ ]"}</span>
                <h3>No products match these filters.</h3>
                <p>Try another name, category or availability.</p>
                <button
                  onClick={() => {
                    setSearch("");
                    setQuery("");
                    setCategory("all");
                    setStock("all");
                    setPage(1);
                  }}
                >
                  Clear filters
                </button>
              </section>
            )}
            {!error && !loading && !!data?.data.length && (
              <nav className="lab-pagination" aria-label="Catalogue pages">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Previous
                </button>
                <span>
                  Page {page} of {data.pagination.totalPages}
                </span>
                <button
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </nav>
            )}
            <section className="lab-bottom-banner">
              <div>
                <span className="lab-eyebrow">FROM BROWSING TO BUILDING</span>
                <h2>Your next click could be a test.</h2>
                <p>
                  Inspect one request. Write one assertion. Build from there.
                </p>
              </div>
              <button className="lab-primary" onClick={() => navigate("learn")}>
                Start the learning path →
              </button>
            </section>
          </>
        )}
        {view === "practice" && <PracticeStore />}
        {view === "api" && <APIExplorer key={apiPath} selectedPath={apiPath} />}
        {view === "learn" && (
          <LearningPath
            completed={completed}
            onToggle={toggleTask}
            onExplore={() => navigate("api", "/health")}
          />
        )}
        <footer className="lab-footer">
          <span>
            Automation Lab <b>v2.0 / Workflows</b>
          </span>
          <span>Fictional data · No real purchases · No account needed</span>
        </footer>
      </div>
      <dialog
        className="lab-dialog"
        ref={dialog}
        aria-labelledby="lab-detail-title"
        onClose={() => setDetailID(null)}
      >
        <div className="lab-dialog-heading">
          <span className="lab-eyebrow">PRODUCT DETAIL</span>
          <button
            onClick={() => setDetailID(null)}
            aria-label="Close product details"
          >
            ×
          </button>
        </div>
        <h2 id="lab-detail-title">{detail?.name || "Product details"}</h2>
        {detailError ? (
          <p role="alert">{detailError}</p>
        ) : detail ? (
          <>
            <ProductArt product={detail} />
            <p>{detail.description}</p>
            <div className="lab-detail-facts">
              <div>
                <span>Price</span>
                <strong>{labMoney(detail.priceMinor)}</strong>
              </div>
              <div>
                <span>Inventory</span>
                <strong>{detail.stock} in stock</strong>
              </div>
              <div>
                <span>Product ID</span>
                <code>{detail.id}</code>
              </div>
            </div>
            <button
              className="lab-primary"
              onClick={() => navigate("api", "/products/" + detail.id)}
            >
              Inspect this API response →
            </button>
          </>
        ) : (
          <p role="status">Loading product details…</p>
        )}
      </dialog>
    </main>
  );
}
