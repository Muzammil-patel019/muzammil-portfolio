import { test, expect, type APIRequestContext } from "@playwright/test";
async function create(request: APIRequestContext) {
  const r = await request.post("/api/lab/workspaces");
  expect(r.status()).toBe(201);
  return (await r.json()).workspaceToken as string;
}
async function login(
  request: APIRequestContext,
  workspace: string,
  role: string,
) {
  const r = await request.post("/api/lab/workspace/session", {
    headers: { "X-Lab-Workspace": workspace },
    data: { email: role + "@lab.test", password: "Practice123!" },
  });
  expect(r.status()).toBe(200);
  return {
    "X-Lab-Workspace": workspace,
    Authorization: "Bearer " + (await r.json()).sessionToken,
  };
}
test("disposable workflows enforce roles, idempotency, isolation, refund and reset", async ({
  request,
}) => {
  const a = await create(request),
    b = await create(request);
  try {
    const customer = await login(request, a, "customer"),
      admin = await login(request, a, "admin"),
      other = await login(request, b, "customer");
    expect(
      (
        await request.get("/api/lab/workspace/state", {
          headers: { ...customer, "X-Lab-Workspace": b },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await request.patch("/api/lab/workspace/products/p-001", {
          headers: customer,
          data: { stock: 1 },
        })
      ).status(),
    ).toBe(403);
    await request.post("/api/lab/workspace/cart", {
      headers: customer,
      data: { productId: "p-001", quantity: 2 },
    });
    const key = crypto.randomUUID(),
      headers = { ...customer, "Idempotency-Key": key },
      data = { coupon: "SAVE10", payment: "approved" };
    const first = await request.post("/api/lab/workspace/orders", {
      headers,
      data,
    });
    expect(first.status()).toBe(201);
    const order = (await first.json()).data;
    expect(order.totalMinor).toBe(629820);
    const replay = await request.post("/api/lab/workspace/orders", {
      headers,
      data,
    });
    expect(replay.status()).toBe(200);
    expect((await replay.json()).data.id).toBe(order.id);
    const state = await (
      await request.get("/api/lab/workspace/state", { headers: admin })
    ).json();
    expect(state.products[0].stock).toBe(10);
    const untouched = await (
      await request.get("/api/lab/workspace/state", { headers: other })
    ).json();
    expect(untouched.products[0].stock).toBe(12);
    expect(untouched.orders).toHaveLength(0);
    expect(
      (
        await request.patch("/api/lab/workspace/orders/" + order.id, {
          headers: customer,
          data: { action: "refund" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.patch("/api/lab/workspace/orders/" + order.id, {
          headers: admin,
          data: { action: "refund" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post("/api/lab/workspace/reset", {
          headers: admin,
          data: {},
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.get("/api/lab/workspace/state", { headers: customer })
      ).status(),
    ).toBe(401);
  } finally {
    await request.delete("/api/lab/workspace/destroy", {
      headers: { "X-Lab-Workspace": a },
    });
    await request.delete("/api/lab/workspace/destroy", {
      headers: { "X-Lab-Workspace": b },
    });
  }
});
test("provider retries and request-scoped faults preserve state", async ({
  request,
}) => {
  const run = await create(request);
  try {
    const headers = await login(request, run, "admin");
    expect(
      (
        await request.post("/api/lab/workspace/cart", {
          headers: { ...headers, "X-Lab-Scenario": "unavailable" },
          data: { productId: "p-001", quantity: 1 },
        })
      ).status(),
    ).toBe(503);
    expect(
      (await (await request.get("/api/lab/workspace/cart", { headers })).json())
        .items,
    ).toHaveLength(0);
    await request.post("/api/lab/workspace/cart", {
      headers,
      data: { productId: "p-001", quantity: 1 },
    });
    const created = await request.post("/api/lab/workspace/orders", {
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      data: { payment: "pending" },
    });
    expect(created.status()).toBe(201);
    const order = (await created.json()).data;
    const state = await (
        await request.get("/api/lab/workspace/state", { headers })
      ).json(),
      event = {
        eventId: crypto.randomUUID(),
        orderId: order.id,
        status: "paid",
      },
      auth = { ...headers, "X-Lab-Webhook-Key": state.webhookSecret };
    expect(
      (
        await request.post("/api/lab/workspace/webhooks", {
          headers: auth,
          data: event,
        })
      ).status(),
    ).toBe(200);
    const retry = await request.post("/api/lab/workspace/webhooks", {
      headers: auth,
      data: event,
    });
    expect((await retry.json()).duplicate).toBe(true);
    expect(
      (
        await request.delete("/api/lab/workspace/session", { headers })
      ).status(),
    ).toBe(200);
    expect(
      (await request.get("/api/lab/workspace/state", { headers })).status(),
    ).toBe(401);
  } finally {
    await request.delete("/api/lab/workspace/destroy", {
      headers: { "X-Lab-Workspace": run },
    });
  }
});
test("practice store completes customer/admin workflow on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lab?view=practice");
  await page
    .getByRole("button", { name: "Create practice run", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sign in to demo account", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Practice inventory" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Add Orbit headphones to practice cart",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Checkout coupon", { exact: true })
    .selectOption("SAVE10");
  await page
    .getByRole("button", { name: "Place fake order", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Practice orders" }),
  ).toContainText("₹3,149");
  await page.getByLabel("Demo account", { exact: true }).selectOption("admin");
  await page
    .getByRole("button", { name: "Sign in to demo account", exact: true })
    .click();
  await page.getByRole("button", { name: "Refund order", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Practice orders" }),
  ).toContainText("refunded");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await page.screenshot({
    path: "/tmp/lab-workflows-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete run", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create practice run", exact: true }),
  ).toBeVisible();
});

test("concurrent customers cannot oversell the last unit and admin CRUD is run-scoped", async ({
  request,
}) => {
  const run = await create(request);
  try {
    const admin = await login(request, run, "admin"),
      customer = await login(request, run, "customer");
    expect(
      (
        await request.patch("/api/lab/workspace/products/p-001", {
          headers: admin,
          data: { stock: 1 },
        })
      ).status(),
    ).toBe(200);
    for (const headers of [admin, customer])
      expect(
        (
          await request.post("/api/lab/workspace/cart", {
            headers,
            data: { productId: "p-001", quantity: 1 },
          })
        ).status(),
      ).toBe(200);
    const responses = await Promise.all(
      [admin, customer].map((headers) =>
        request.post("/api/lab/workspace/orders", {
          headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
          data: { payment: "approved" },
        }),
      ),
    );
    expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
    const state = await (
      await request.get("/api/lab/workspace/state", { headers: admin })
    ).json();
    expect(state.products[0].stock).toBe(0);
    expect(state.orders).toHaveLength(1);
    const created = await request.post("/api/lab/workspace/products", {
      headers: admin,
      data: {
        id: "p-new-test",
        name: "New test item",
        category: "desk",
        description: "Fake data",
        priceMinor: 12345,
        stock: 2,
        rating: 0,
        art: "notebook",
        color: "#d6e6e4",
      },
    });
    expect(created.status()).toBe(201);
    expect(
      (
        await request.delete("/api/lab/workspace/products/p-new-test", {
          headers: admin,
        })
      ).status(),
    ).toBe(200);
  } finally {
    await request.delete("/api/lab/workspace/destroy", {
      headers: { "X-Lab-Workspace": run },
    });
  }
});
