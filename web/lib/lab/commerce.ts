import { z } from "zod";
import { products as seed, type Product } from "./catalogue";
export const roles = ["customer", "support", "admin"] as const;
export type Role = (typeof roles)[number];
export class LabError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(code: string, status: number, message: string): never {
  throw new LabError(code, status, message);
}
const cartItem = z
  .object({
    productId: z.string().max(30),
    quantity: z.number().int().min(1).max(10),
  })
  .strict();
const product = z
  .object({
    id: z.string().regex(/^p-[A-Za-z0-9-]{1,25}$/),
    name: z.string().trim().min(2).max(80),
    category: z.enum(["tech", "desk", "everyday"]),
    description: z.string().max(500),
    priceMinor: z.number().int().min(0).max(10000000),
    stock: z.number().int().min(0).max(1000),
    rating: z.number().min(0).max(5),
    art: z.enum([
      "headphones",
      "keyboard",
      "speaker",
      "lamp",
      "notebook",
      "stand",
      "bag",
      "bottle",
      "pouch",
      "mouse",
      "timer",
      "cup",
    ]),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  })
  .strict();
const order = z.object({
  id: z.uuid(),
  user: z.enum(roles),
  items: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        quantity: z.number().int().min(1).max(10),
        unitMinor: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(10),
  subtotalMinor: z.number().int(),
  discountMinor: z.number().int(),
  totalMinor: z.number().int(),
  coupon: z.string(),
  status: z.enum(["paid", "pending", "failed", "cancelled", "refunded"]),
  released: z.boolean(),
  createdAt: z.string(),
  idempotencyKey: z.string(),
  requestSignature: z.string(),
});
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    epoch: z.uuid(),
    products: z.array(product).max(30),
    carts: z.object({
      customer: z.array(cartItem).max(10),
      support: z.array(cartItem).max(10),
      admin: z.array(cartItem).max(10),
    }),
    orders: z.array(order).max(50),
    events: z
      .array(
        z.object({
          id: z.uuid(),
          type: z.string(),
          actor: z.string(),
          at: z.string(),
        }),
      )
      .max(100),
    revoked: z.array(z.string()).max(100),
    processedWebhooks: z
      .array(z.object({ id: z.string(), signature: z.string() }))
      .max(100),
    webhookSecret: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type Workspace = z.infer<typeof workspaceSchema>;
export function initialWorkspace(secret: string): Workspace {
  return {
    version: 1,
    epoch: crypto.randomUUID(),
    products: structuredClone(seed),
    carts: { customer: [], support: [], admin: [] },
    orders: [],
    events: [],
    revoked: [],
    processedWebhooks: [],
    webhookSecret: secret,
  };
}
export function event(doc: Workspace, type: string, actor: string) {
  doc.events = [
    ...doc.events,
    { id: crypto.randomUUID(), type, actor, at: new Date().toISOString() },
  ].slice(-100);
}
export function cartSummary(doc: Workspace, user: Role) {
  const items = doc.carts[user].map((i) => {
    const p = doc.products.find((p) => p.id === i.productId);
    return {
      ...i,
      name: p?.name || "Unavailable product",
      priceMinor: p?.priceMinor || 0,
      stock: p?.stock || 0,
    };
  });
  return {
    items,
    subtotalMinor: items.reduce((n, i) => n + i.quantity * i.priceMinor, 0),
    currency: "INR",
  };
}
export function setCart(source: Workspace, user: Role, input: unknown) {
  const item = z
    .object({
      productId: z.string().max(30),
      quantity: z.number().int().min(0).max(10),
    })
    .strict()
    .parse(input);
  const doc = structuredClone(source),
    p = doc.products.find((p) => p.id === item.productId);
  if (!p)
    fail("PRODUCT_NOT_FOUND", 404, "Product not found in this workspace.");
  if (item.quantity > p.stock)
    fail(
      "INSUFFICIENT_STOCK",
      409,
      "Requested quantity exceeds current stock.",
    );
  const cart = doc.carts[user].filter((i) => i.productId !== item.productId);
  if (item.quantity) cart.push(item);
  if (cart.length > 10)
    fail(
      "CART_LIMIT",
      422,
      "A cart can contain at most ten different products.",
    );
  doc.carts[user] = cart;
  event(doc, "cart.updated", user);
  return workspaceSchema.parse(doc);
}
export function checkout(
  source: Workspace,
  user: Role,
  input: unknown,
  key: string,
) {
  const body = z
    .object({
      coupon: z.enum(["", "SAVE10"]).default(""),
      payment: z.enum(["approved", "declined", "pending"]).default("approved"),
    })
    .strict()
    .parse(input);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key))
    fail(
      "IDEMPOTENCY_REQUIRED",
      400,
      "Send an Idempotency-Key of 8–80 letters, numbers, underscores or hyphens.",
    );
  const signature = JSON.stringify(body),
    previous = source.orders.find(
      (o) => o.user === user && o.idempotencyKey === key,
    );
  if (previous) {
    if (previous.requestSignature !== signature)
      fail(
        "IDEMPOTENCY_CONFLICT",
        409,
        "This key was used with a different checkout request.",
      );
    return { doc: source, order: previous, replayed: true };
  }
  if (source.orders.length >= 50)
    fail(
      "ORDER_LIMIT",
      422,
      "Reset this disposable workspace before creating more orders.",
    );
  const items = source.carts[user].map((i) => {
    const p = source.products.find((p) => p.id === i.productId);
    if (!p || p.stock < i.quantity)
      fail("INSUFFICIENT_STOCK", 409, "Inventory changed. Review your cart.");
    return { ...i, name: p.name, unitMinor: p.priceMinor };
  });
  if (!items.length) fail("EMPTY_CART", 422, "Add a product before checkout.");
  if (body.payment === "declined")
    fail(
      "PAYMENT_DECLINED",
      422,
      "Simulated payment declined. No money or inventory was moved.",
    );
  const subtotalMinor = items.reduce((n, i) => n + i.quantity * i.unitMinor, 0),
    discountMinor =
      body.coupon === "SAVE10" ? Math.floor(subtotalMinor / 10) : 0;
  const doc = structuredClone(source),
    created = {
      id: crypto.randomUUID(),
      user,
      items,
      subtotalMinor,
      discountMinor,
      totalMinor: subtotalMinor - discountMinor,
      coupon: body.coupon,
      status:
        body.payment === "pending" ? ("pending" as const) : ("paid" as const),
      released: false,
      createdAt: new Date().toISOString(),
      idempotencyKey: key,
      requestSignature: signature,
    };
  for (const i of items)
    doc.products.find((p) => p.id === i.productId)!.stock -= i.quantity;
  doc.orders.push(created);
  doc.carts[user] = [];
  event(doc, "order.created", user);
  return { doc: workspaceSchema.parse(doc), order: created, replayed: false };
}
function release(doc: Workspace, o: Workspace["orders"][number]) {
  if (!o.released) {
    for (const i of o.items) {
      const p = doc.products.find((p) => p.id === i.productId);
      if (p) p.stock += i.quantity;
    }
    o.released = true;
  }
}
export function transitionOrder(
  source: Workspace,
  role: Role,
  id: string,
  action: "cancel" | "refund",
) {
  const doc = structuredClone(source),
    o = doc.orders.find((o) => o.id === id);
  if (!o) fail("ORDER_NOT_FOUND", 404, "Order not found.");
  if (role === "customer" && o.user !== role)
    fail("FORBIDDEN", 403, "Customers can access only their own orders.");
  if (action === "refund" && role !== "admin")
    fail("FORBIDDEN", 403, "Only the demo admin can issue refunds.");
  const next = action === "cancel" ? "cancelled" : "refunded";
  if (o.status === next) return doc;
  if (
    action === "refund"
      ? o.status !== "paid"
      : !["paid", "pending"].includes(o.status)
  )
    fail("INVALID_TRANSITION", 409, "This order cannot make that transition.");
  release(doc, o);
  o.status = next;
  event(doc, "order." + next, role);
  return workspaceSchema.parse(doc);
}
export function editProduct(
  source: Workspace,
  role: Role,
  id: string,
  input: unknown,
) {
  if (role !== "admin")
    fail("FORBIDDEN", 403, "Only the demo admin can edit inventory.");
  const changes = product
    .pick({ name: true, priceMinor: true, stock: true, description: true })
    .partial()
    .strict()
    .refine((v) => Object.keys(v).length > 0)
    .parse(input);
  const doc = structuredClone(source),
    p = doc.products.find((p) => p.id === id);
  if (!p) fail("PRODUCT_NOT_FOUND", 404, "Product not found.");
  Object.assign(p, changes);
  event(doc, "inventory.updated", role);
  return workspaceSchema.parse(doc);
}
export function applyWebhook(source: Workspace, input: unknown) {
  const payload = z
      .object({
        eventId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
        orderId: z.uuid(),
        status: z.enum(["paid", "failed"]),
      })
      .strict()
      .parse(input),
    signature = JSON.stringify(payload),
    old = source.processedWebhooks.find((e) => e.id === payload.eventId);
  if (old) {
    if (old.signature !== signature)
      fail(
        "EVENT_CONFLICT",
        409,
        "This event ID was used with different data.",
      );
    return { doc: source, duplicate: true };
  }
  const doc = structuredClone(source),
    o = doc.orders.find((o) => o.id === payload.orderId);
  if (!o) fail("ORDER_NOT_FOUND", 404, "Order not found.");
  if (o.status !== "pending")
    fail(
      "INVALID_TRANSITION",
      409,
      "Only pending orders accept a payment event.",
    );
  if (payload.status === "failed") release(doc, o);
  o.status = payload.status;
  doc.processedWebhooks = [
    ...doc.processedWebhooks,
    { id: payload.eventId, signature },
  ].slice(-100);
  event(doc, "webhook." + payload.status, "provider-simulator");
  return { doc: workspaceSchema.parse(doc), duplicate: false };
}
export function publicOrder(o: Workspace["orders"][number]) {
  const { requestSignature, idempotencyKey, ...visible } = o;
  return visible;
}
export const demoAccounts = roles.map((role) => ({
  role,
  email: role + "@lab.test",
  password: "Practice123!",
}));
export const asProducts = (doc: Workspace): Product[] => doc.products;
export function createProduct(source: Workspace, role: Role, input: unknown) {
  if (role !== "admin")
    fail("FORBIDDEN", 403, "Only the demo admin can create products.");
  const p = product.parse(input);
  if (source.products.some((i) => i.id === p.id))
    fail("PRODUCT_EXISTS", 409, "Product ID already exists.");
  if (source.products.length >= 30)
    fail("PRODUCT_LIMIT", 422, "A run supports at most thirty products.");
  const doc = structuredClone(source);
  doc.products.push(p);
  event(doc, "inventory.created", role);
  return workspaceSchema.parse(doc);
}
export function deleteProduct(source: Workspace, role: Role, id: string) {
  if (role !== "admin")
    fail("FORBIDDEN", 403, "Only the demo admin can delete products.");
  if (!source.products.some((p) => p.id === id))
    fail("PRODUCT_NOT_FOUND", 404, "Product not found.");
  if (
    Object.values(source.carts).some((items) =>
      items.some((i) => i.productId === id),
    ) ||
    source.orders.some(
      (o) =>
        ["pending", "paid"].includes(o.status) &&
        o.items.some((i) => i.productId === id),
    )
  )
    fail(
      "PRODUCT_IN_USE",
      409,
      "Remove this product from carts and cancel or refund active orders before deleting it.",
    );
  const doc = structuredClone(source);
  doc.products = doc.products.filter((p) => p.id !== id);
  event(doc, "inventory.deleted", role);
  return workspaceSchema.parse(doc);
}
