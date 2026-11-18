import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { storage, tokenFrom, signingSecret } from "@/lib/lab/store";
import { hashToken, signSession, readSession } from "@/lib/lab/session";
import {
  initialWorkspace,
  demoAccounts,
  cartSummary,
  setCart,
  checkout,
  transitionOrder,
  editProduct,
  createProduct,
  deleteProduct,
  applyWebhook,
  publicOrder,
  event,
  fail,
} from "@/lib/lab/commerce";
import { json, errorResponse, body, scenario } from "@/lib/lab/http";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  try {
    const mode = await scenario(request),
      path = (await context.params).path.join("/"),
      method = request.method,
      token = tokenFrom(request),
      row = await storage("read", token),
      doc = row.document;
    if (path === "reset" && method === "POST") {
      const fresh = initialWorkspace(randomBytes(32).toString("hex"));
      const saved = await storage("save", token, fresh, row.revision);
      return json({
        reset: true,
        revision: saved.revision,
        sessionInvalidated: true,
      });
    }
    if (path === "destroy" && method === "DELETE") {
      await storage("delete", token);
      return json({ deleted: true });
    }
    if (path === "session" && method === "POST") {
      const input = z
          .object({ email: z.string().max(100), password: z.string().max(100) })
          .strict()
          .parse(await body(request)),
        account = demoAccounts.find(
          (a) => a.email === input.email && a.password === input.password,
        );
      if (!account)
        fail(
          "INVALID_CREDENTIALS",
          401,
          "Use the listed fictional demo credentials.",
        );
      return json({
        sessionToken: signSession(
          hashToken(token),
          account.role,
          doc.epoch,
          signingSecret(),
        ),
        user: { role: account.role, email: account.email },
        expiresIn: 3600,
      });
    }
    const auth =
        request.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1] || "",
      session = readSession(
        auth,
        hashToken(token),
        doc.epoch,
        doc.revoked,
        signingSecret(),
      ),
      role = session.role;
    if (path === "session" && method === "DELETE") {
      const next = structuredClone(doc);
      if (doc.revoked.length >= 100)
        fail(
          "SESSION_LIMIT",
          429,
          "Reset this disposable run before creating more sessions.",
        );
      next.revoked = [...doc.revoked, session.id];
      await storage("save", token, next, row.revision);
      return json({ signedOut: true });
    }
    if (path === "state" && method === "GET")
      return json({
        role,
        revision: row.revision,
        expiresAt: row.expiresAt,
        products: doc.products,
        cart: cartSummary(doc, role),
        orders: doc.orders
          .filter((o) => role !== "customer" || o.user === role)
          .map(publicOrder),
        events:
          role === "customer"
            ? doc.events.filter((e) => e.actor === role)
            : doc.events,
        ...(role === "admin" ? { webhookSecret: doc.webhookSecret } : {}),
        storage:
          process.env.LAB_STORE_MODE === "memory" && !process.env.VERCEL
            ? "ephemeral-test-memory"
            : "postgres",
      });
    if (path === "cart" && method === "GET")
      return json(cartSummary(doc, role));
    if (path === "cart" && method === "POST") {
      const next = setCart(doc, role, await body(request)),
        saved = await storage("save", token, next, row.revision);
      return json({ ...cartSummary(next, role), revision: saved.revision });
    }
    if (path === "orders" && method === "GET")
      return json({
        data: doc.orders
          .filter((o) => role !== "customer" || o.user === role)
          .map(publicOrder),
      });
    if (path === "orders" && method === "POST") {
      let input = await body(request);
      if (mode === "declined") input = { ...input, payment: "declined" };
      const result = checkout(
        doc,
        role,
        input,
        request.headers.get("Idempotency-Key") || "",
      );
      if (!result.replayed)
        await storage("save", token, result.doc, row.revision);
      return json(
        { data: publicOrder(result.order), replayed: result.replayed },
        result.replayed ? 200 : 201,
      );
    }
    if (/^orders\/[^/]+$/.test(path) && method === "PATCH") {
      const input = z
          .object({ action: z.enum(["cancel", "refund"]) })
          .strict()
          .parse(await body(request)),
        id = path.split("/")[1],
        next = transitionOrder(doc, role, id, input.action);
      await storage("save", token, next, row.revision);
      return json({ data: publicOrder(next.orders.find((o) => o.id === id)!) });
    }
    if (path === "products" && method === "POST") {
      const next = createProduct(doc, role, await body(request));
      await storage("save", token, next, row.revision);
      return json({ data: next.products.at(-1) }, 201);
    }
    if (/^products\/[^/]+$/.test(path) && method === "DELETE") {
      const next = deleteProduct(doc, role, path.split("/")[1]);
      await storage("save", token, next, row.revision);
      return json({ deleted: true });
    }
    if (/^products\/[^/]+$/.test(path) && method === "PATCH") {
      const next = editProduct(
        doc,
        role,
        path.split("/")[1],
        await body(request),
      );
      const saved = await storage("save", token, next, row.revision);
      return json({
        data: next.products.find((p) => p.id === path.split("/")[1]),
        revision: saved.revision,
      });
    }
    if (path === "webhooks" && method === "POST") {
      const provided = Buffer.from(
          request.headers.get("X-Lab-Webhook-Key") || "",
        ),
        expected = Buffer.from(doc.webhookSecret);
      if (
        role !== "admin" ||
        provided.length !== expected.length ||
        !timingSafeEqual(provided, expected)
      )
        fail(
          "WEBHOOK_UNAUTHORIZED",
          403,
          "Demo admin and this workspace's webhook key are required.",
        );
      const result = applyWebhook(doc, await body(request));
      if (!result.duplicate)
        await storage("save", token, result.doc, row.revision);
      return json({ accepted: true, duplicate: result.duplicate });
    }
    return fail(
      "ENDPOINT_NOT_FOUND",
      404,
      "Unknown practice endpoint or method.",
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export const GET = handle,
  POST = handle,
  PATCH = handle,
  DELETE = handle;
