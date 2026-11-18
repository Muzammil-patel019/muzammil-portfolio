"use client";
import { useEffect, useRef, useState } from "react";
import { labMoney, type Product } from "@/lib/lab/catalogue";
import { demoAccounts, type Role } from "@/lib/lab/commerce";
import { ProductArt } from "./ProductArt";
type Run = { workspaceToken: string; sessionToken: string };
type State = {
  role: Role;
  revision: number;
  expiresAt: string;
  storage: string;
  products: Product[];
  cart: {
    items: {
      productId: string;
      name: string;
      quantity: number;
      priceMinor: number;
    }[];
    subtotalMinor: number;
  };
  orders: {
    id: string;
    user: string;
    status: string;
    totalMinor: number;
    createdAt: string;
    items: { name: string; quantity: number }[];
  }[];
  events: { id: string; type: string; actor: string; at: string }[];
  webhookSecret?: string;
};
const key = "mp-lab-run-v1";
export function PracticeStore() {
  const [run, setRun] = useState<Run>({ workspaceToken: "", sessionToken: "" }),
    [state, setState] = useState<State | null>(null),
    [role, setRole] = useState<Role>("customer"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [scenario, setScenario] = useState("normal"),
    [coupon, setCoupon] = useState(""),
    [payment, setPayment] = useState("approved");
  const checkoutKey = useRef("");
  function persist(next: Run) {
    setRun(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setMessage(
        "This run stays in this tab because browser storage is unavailable.",
      );
    }
  }
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      if (
        typeof value.workspaceToken === "string" &&
        /^[a-f0-9]{48}$/.test(value.workspaceToken)
      ) {
        const restored = {
          workspaceToken: value.workspaceToken,
          sessionToken:
            typeof value.sessionToken === "string" ? value.sessionToken : "",
        };
        setRun(restored);
        if (restored.sessionToken) void load(restored);
      }
    } catch {}
  }, []);
  async function api(
    path: string,
    method = "GET",
    body?: unknown,
    extra: Record<string, string> = {},
    current = run,
    mode = scenario,
  ) {
    const response = await fetch("/api/lab/" + path, {
        method,
        credentials: "omit",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Lab-Workspace": current.workspaceToken,
          Authorization: "Bearer " + current.sessionToken,
          "X-Lab-Scenario": mode,
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      value = await response.json();
    if (!response.ok) {
      if (response.status === 401 && current.sessionToken) {
        persist({ ...current, sessionToken: "" });
        setState(null);
      }
      throw Error(
        `${response.status} ${value.error?.code || "ERROR"}: ${value.error?.message || "Request failed"}`,
      );
    }
    return value;
  }
  async function load(current = run) {
    try {
      const value = await api(
        "workspace/state",
        "GET",
        undefined,
        {},
        current,
        "normal",
      );
      setState(value);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const controls = (
    <div className="lab-run-controls">
      <label>
        Request scenario
        <select
          aria-label="Request scenario"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
        >
          <option value="normal">Normal</option>
          <option value="slow">Slow · 750 ms</option>
          <option value="unavailable">Service unavailable · 503</option>
          <option value="expired">Session expired · 401</option>
          <option value="declined">Payment declined</option>
        </select>
      </label>
      <button
        disabled={busy || !run.sessionToken}
        onClick={() => void action(() => load())}
      >
        Refresh run
      </button>
      <button
        disabled={busy || !run.workspaceToken}
        onClick={() =>
          void action(async () => {
            if (
              !confirm(
                "Reset only this disposable run? Orders, carts and inventory edits will be removed and demo sessions invalidated.",
              )
            )
              return;
            await api("workspace/reset", "POST", {}, {}, run, "normal");
            persist({ ...run, sessionToken: "" });
            setState(null);
            setScenario("normal");
            setMessage("Run reset. Sign in to a demo role again.");
          })
        }
      >
        Reset practice data
      </button>
      <button
        disabled={busy || !run.workspaceToken}
        onClick={() =>
          void action(async () => {
            if (!confirm("Delete this disposable run?")) return;
            await api(
              "workspace/destroy",
              "DELETE",
              undefined,
              {},
              run,
              "normal",
            );
            persist({ workspaceToken: "", sessionToken: "" });
            setState(null);
            setMessage("Practice run deleted.");
          })
        }
      >
        Delete run
      </button>
    </div>
  );
  return (
    <>
      <section className="lab-panel">
        <div className="lab-section-title">
          <div>
            <p className="lab-eyebrow">ISOLATED, FICTIONAL DATA</p>
            <h2>A store you can change.</h2>
          </div>
          <span className="lab-pill">
            {state
              ? state.storage === "postgres"
                ? "Postgres · revision " + state.revision
                : "Local test memory · revision " + state.revision
              : "Disposable practice run"}
          </span>
        </div>
        <p className="lab-muted">
          Each run has separate stock, carts and orders, expires after 24 hours,
          and uses public demo credentials. No real purchases or personal
          account registration. The workspace token owns this disposable run;
          demo roles operate inside it.
        </p>
        {!run.workspaceToken ? (
          <button
            className="lab-primary"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                const result = await api("workspaces", "POST", {});
                persist({
                  workspaceToken: result.workspaceToken,
                  sessionToken: "",
                });
                setMessage("Run created. Choose a demo role to begin.");
              })
            }
          >
            Create practice run
          </button>
        ) : (
          <>
            {controls}
            <details className="lab-run-tokens">
              <summary>Tokens for your API tests</summary>
              <p>
                Keep these out of public logs. They access this fictional run
                only. Reset invalidates demo sessions.
              </p>
              <label>
                Workspace token
                <input
                  aria-label="Workspace token"
                  readOnly
                  value={run.workspaceToken}
                />
              </label>
              <label>
                Demo session token
                <textarea
                  aria-label="Demo session token"
                  readOnly
                  value={run.sessionToken}
                />
              </label>
            </details>
          </>
        )}
        <p className="lab-run-message" role="status">
          {message}
        </p>
        {run.workspaceToken && (
          <form
            className="lab-role-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const account = demoAccounts.find((a) => a.role === role)!,
                  result = await api("workspace/session", "POST", {
                    email: account.email,
                    password: account.password,
                  }),
                  next = { ...run, sessionToken: result.sessionToken };
                persist(next);
                await load(next);
              });
            }}
          >
            <label>
              Demo account
              <select
                aria-label="Demo account"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {demoAccounts.map((a) => (
                  <option key={a.role} value={a.role}>
                    {a.email}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Demo password: <code>Practice123!</code>
            </p>
            <button className="lab-primary" disabled={busy}>
              Sign in to demo account
            </button>
            {run.sessionToken && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await api("workspace/session", "DELETE");
                    persist({ ...run, sessionToken: "" });
                    setState(null);
                    setMessage("Signed out. That demo session is now revoked.");
                  })
                }
              >
                Sign out of demo account
              </button>
            )}
          </form>
        )}
      </section>
      {state && (
        <>
          <div className="lab-section-title">
            <h2>Run inventory</h2>
            <span className="lab-pill">Signed in as {state.role}</span>
          </div>
          <section
            className="lab-product-grid lab-run-products"
            aria-label="Practice inventory"
          >
            {state.products.map((p) => (
              <article className="lab-product" key={p.id}>
                <ProductArt product={p} />
                <div className="lab-product-info">
                  <h3>{p.name}</h3>
                  <p>
                    {labMoney(p.priceMinor)} · {p.stock} available
                  </p>
                  <button
                    disabled={busy || p.stock === 0}
                    aria-label={"Add " + p.name + " to practice cart"}
                    onClick={() =>
                      void action(async () => {
                        const existing = state.cart.items.find(
                          (i) => i.productId === p.id,
                        );
                        await api("workspace/cart", "POST", {
                          productId: p.id,
                          quantity: (existing?.quantity || 0) + 1,
                        });
                        await load();
                      })
                    }
                  >
                    Add to cart
                  </button>
                  {state.role === "admin" && (
                    <form
                      className="lab-inventory-edit"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const values = new FormData(e.currentTarget);
                        void action(async () => {
                          await api("workspace/products/" + p.id, "PATCH", {
                            stock: Number(values.get("stock")),
                            priceMinor: Number(values.get("price")),
                          });
                          await load();
                        });
                      }}
                    >
                      <label>
                        Stock
                        <input
                          name="stock"
                          aria-label={p.name + " stock"}
                          type="number"
                          min="0"
                          max="1000"
                          required
                          defaultValue={p.stock}
                          key={p.stock}
                        />
                      </label>
                      <label>
                        Price in paise
                        <input
                          name="price"
                          aria-label={p.name + " price in paise"}
                          type="number"
                          min="0"
                          max="10000000"
                          required
                          defaultValue={p.priceMinor}
                          key={p.priceMinor}
                        />
                      </label>
                      <button disabled={busy}>Save inventory</button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            if (
                              !confirm(
                                "Delete this run product? Completed order snapshots are retained.",
                              )
                            )
                              return;
                            await api("workspace/products/" + p.id, "DELETE");
                            await load();
                          })
                        }
                      >
                        Delete run product
                      </button>
                    </form>
                  )}
                </div>
              </article>
            ))}
          </section>
          {state.role === "admin" && (
            <section className="lab-panel">
              <h2>Create a run product</h2>
              <form
                className="lab-role-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    values = new FormData(form);
                  void action(async () => {
                    await api("workspace/products", "POST", {
                      id: "p-" + crypto.randomUUID().slice(0, 8),
                      name: String(values.get("name")),
                      category: String(values.get("category")),
                      description:
                        "A fictional product added by the demo admin.",
                      priceMinor: Number(values.get("price")),
                      stock: Number(values.get("stock")),
                      rating: 0,
                      art: "notebook",
                      color: "#d6e6e4",
                    });
                    form.reset();
                    await load();
                  });
                }}
              >
                <label>
                  Product name
                  <input
                    name="name"
                    aria-label="New product name"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
                <label>
                  Category
                  <select name="category" aria-label="New product category">
                    <option>desk</option>
                    <option>tech</option>
                    <option>everyday</option>
                  </select>
                </label>
                <label>
                  Price in paise
                  <input
                    name="price"
                    aria-label="New product price"
                    type="number"
                    min="0"
                    max="10000000"
                    required
                  />
                </label>
                <label>
                  Stock
                  <input
                    name="stock"
                    aria-label="New product stock"
                    type="number"
                    min="0"
                    max="1000"
                    required
                  />
                </label>
                <button disabled={busy}>Create run product</button>
              </form>
            </section>
          )}
          <section className="lab-panel" aria-label="Practice cart">
            <h2>Your practice cart</h2>
            <p className="lab-muted">
              Stock is reserved at checkout. Every quantity and price is checked
              again on the server.
            </p>
            {!state.cart.items.length ? (
              <p>Your cart is empty.</p>
            ) : (
              <>
                {state.cart.items.map((item) => (
                  <div className="lab-cart-row" key={item.productId}>
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <strong>{labMoney(item.quantity * item.priceMinor)}</strong>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await api("workspace/cart", "POST", {
                            productId: item.productId,
                            quantity: 0,
                          });
                          await load();
                        })
                      }
                    >
                      Remove {item.name}
                    </button>
                  </div>
                ))}
                <h3>Subtotal: {labMoney(state.cart.subtotalMinor)}</h3>
                <form
                  className="lab-role-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      checkoutKey.current ||= crypto.randomUUID();
                      await api(
                        "workspace/orders",
                        "POST",
                        { coupon, payment },
                        { "Idempotency-Key": checkoutKey.current },
                      );
                      checkoutKey.current = "";
                      await load();
                      setMessage(
                        "Fake order created. No real payment was made.",
                      );
                    });
                  }}
                >
                  <label>
                    Coupon
                    <select
                      aria-label="Checkout coupon"
                      value={coupon}
                      onChange={(e) => {
                        setCoupon(e.target.value);
                        checkoutKey.current = "";
                      }}
                    >
                      <option value="">No coupon</option>
                      <option value="SAVE10">SAVE10 · 10% off</option>
                    </select>
                  </label>
                  <label>
                    Fake payment
                    <select
                      aria-label="Fake payment"
                      value={payment}
                      onChange={(e) => {
                        setPayment(e.target.value);
                        checkoutKey.current = "";
                      }}
                    >
                      <option value="approved">Approved</option>
                      <option value="declined">Declined</option>
                      <option value="pending">Pending webhook</option>
                    </select>
                  </label>
                  <button className="lab-primary" disabled={busy}>
                    Place fake order
                  </button>
                </form>
              </>
            )}
          </section>
          <section className="lab-panel" aria-label="Practice orders">
            <h2>
              {state.role === "customer" ? "Your orders" : "All run orders"}
            </h2>
            {!state.orders.length ? (
              <p className="lab-muted">No orders in this view yet.</p>
            ) : (
              state.orders.map((order) => (
                <article className="lab-order-row" key={order.id}>
                  <div>
                    <h3>
                      {labMoney(order.totalMinor)} · {order.status}
                    </h3>
                    <code>{order.id}</code>
                    <p>
                      {order.user} ·{" "}
                      {order.items
                        .map((i) => i.name + " × " + i.quantity)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="lab-order-actions">
                    {["paid", "pending"].includes(order.status) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api("workspace/orders/" + order.id, "PATCH", {
                              action: "cancel",
                            });
                            await load();
                          })
                        }
                      >
                        Cancel order
                      </button>
                    )}
                    {state.role === "admin" && order.status === "paid" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api("workspace/orders/" + order.id, "PATCH", {
                              action: "refund",
                            });
                            await load();
                          })
                        }
                      >
                        Refund order
                      </button>
                    )}
                    {state.role === "admin" && order.status === "pending" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api(
                              "workspace/webhooks",
                              "POST",
                              {
                                eventId: crypto.randomUUID(),
                                orderId: order.id,
                                status: "paid",
                              },
                              { "X-Lab-Webhook-Key": state.webhookSecret! },
                            );
                            await load();
                          })
                        }
                      >
                        Simulate paid webhook
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
          <section className="lab-panel">
            <h2>Run audit trail</h2>
            <p className="lab-muted">
              Up to 100 state-changing events, stored with this run. Credentials
              are excluded.
            </p>
            <div className="lab-audit">
              {state.events
                .slice()
                .reverse()
                .map((e) => (
                  <p key={e.id}>
                    <code>{e.type}</code>
                    <span>
                      {e.actor} · {new Date(e.at).toLocaleTimeString()}
                    </span>
                  </p>
                ))}
            </div>
            {state.role === "admin" && (
              <details>
                <summary>Provider simulator key</summary>
                <p className="lab-muted">
                  The webhook receiver requires this run’s demo admin token and
                  this key. This is a controlled practice receiver, not a
                  connection to a real payment provider.
                </p>
                <code className="lab-token-code">{state.webhookSecret}</code>
              </details>
            )}
          </section>
        </>
      )}
    </>
  );
}
