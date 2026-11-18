import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialWorkspace,
  setCart,
  checkout,
  transitionOrder,
  editProduct,
  applyWebhook,
  LabError,
} from "../lib/lab/commerce";
import { signSession, readSession, hashToken } from "../lib/lab/session";
const initial = () => initialWorkspace("a".repeat(64)),
  secret = "s".repeat(48);
test("checkout snapshots exact totals, consumes stock once and replays idempotently", () => {
  const source = setCart(initial(), "customer", {
    productId: "p-001",
    quantity: 2,
  });
  const result = checkout(
    source,
    "customer",
    { coupon: "SAVE10", payment: "approved" },
    "order-key-001",
  );
  assert.equal(result.order.subtotalMinor, 699800);
  assert.equal(result.order.discountMinor, 69980);
  assert.equal(result.order.totalMinor, 629820);
  assert.equal(result.doc.products[0].stock, 10);
  assert.equal(source.products[0].stock, 12);
  const again = checkout(
    result.doc,
    "customer",
    { coupon: "SAVE10", payment: "approved" },
    "order-key-001",
  );
  assert.equal(again.replayed, true);
  assert.equal(again.doc.products[0].stock, 10);
  assert.throws(
    () => checkout(result.doc, "customer", { coupon: "" }, "order-key-001"),
    (e) => e instanceof LabError && e.status === 409,
  );
  const refunded = transitionOrder(
    result.doc,
    "admin",
    result.order.id,
    "refund",
  );
  assert.equal(refunded.products[0].stock, 12);
  assert.equal(
    transitionOrder(refunded, "admin", result.order.id, "refund").products[0]
      .stock,
    12,
  );
});
test("cart, roles and rejected payments preserve business invariants", () => {
  assert.throws(() =>
    setCart(initial(), "customer", { productId: "p-003", quantity: 1 }),
  );
  assert.throws(() =>
    editProduct(initial(), "customer", "p-001", { stock: 99 }),
  );
  const doc = setCart(initial(), "customer", {
      productId: "p-001",
      quantity: 1,
    }),
    before = JSON.stringify(doc);
  assert.throws(() =>
    checkout(doc, "customer", { payment: "declined" }, "declined-key"),
  );
  assert.equal(JSON.stringify(doc), before);
  const o = checkout(doc, "customer", {}, "payment-key");
  assert.throws(() => transitionOrder(o.doc, "support", o.order.id, "refund"));
  assert.throws(() =>
    checkout(
      editProduct(doc, "admin", "p-001", { stock: 0 }),
      "customer",
      {},
      "stale-stock-key",
    ),
  );
});
test("webhook retries deduplicate and invalid transitions cannot release stock twice", () => {
  const start = checkout(
      setCart(initial(), "customer", { productId: "p-001", quantity: 1 }),
      "customer",
      { payment: "pending" },
      "pending-key",
    ),
    payload = {
      eventId: "event-key-001",
      orderId: start.order.id,
      status: "failed",
    };
  const result = applyWebhook(start.doc, payload);
  assert.equal(result.doc.products[0].stock, 12);
  assert.equal(applyWebhook(result.doc, payload).duplicate, true);
  assert.throws(() => applyWebhook(result.doc, { ...payload, status: "paid" }));
});
test("signed sessions bind workspace, epoch, expiry and logout revocation", () => {
  const doc = initial(),
    hash = hashToken("abc"),
    token = signSession(hash, "customer", doc.epoch, secret);
  const claims = readSession(token, hash, doc.epoch, [], secret);
  assert.equal(claims.role, "customer");
  for (const run of [
    () => readSession(token, hashToken("other"), doc.epoch, [], secret),
    () => readSession(token, hash, crypto.randomUUID(), [], secret),
    () => readSession(token, hash, doc.epoch, [claims.id], secret),
    () => readSession(token + "x", hash, doc.epoch, [], secret),
    () =>
      readSession(
        signSession(hash, "admin", doc.epoch, secret, -1),
        hash,
        doc.epoch,
        [],
        secret,
      ),
  ])
    assert.throws(run);
});
test("active-order products cannot be deleted before cancellation or refund", async () => {
  const { deleteProduct } = await import("../lib/lab/commerce");
  const result = checkout(
    setCart(initial(), "customer", { productId: "p-001", quantity: 1 }),
    "customer",
    {},
    "active-order-key",
  );
  assert.throws(() => deleteProduct(result.doc, "admin", "p-001"));
  const refunded = transitionOrder(
    result.doc,
    "admin",
    result.order.id,
    "refund",
  );
  assert.equal(
    deleteProduct(refunded, "admin", "p-001").products.some(
      (p) => p.id === "p-001",
    ),
    false,
  );
});
