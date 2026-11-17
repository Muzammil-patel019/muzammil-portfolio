import { test, expect } from "@playwright/test";
test("lab API contract supports filters, pagination and explicit errors without owner data", async ({
  request,
}) => {
  const health = await request.get("/api/lab/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({
    status: "ok",
    environment: "practice",
  });
  const first = await (await request.get("/api/lab/products")).json();
  expect(first.data).toHaveLength(6);
  expect(first.pagination).toMatchObject({ total: 12, totalPages: 2 });
  const desk = await (
    await request.get("/api/lab/products?category=desk")
  ).json();
  expect(desk.data).toHaveLength(4);
  expect(
    desk.data.every((p: { category: string }) => p.category === "desk"),
  ).toBe(true);
  const detail = await (await request.get("/api/lab/products/p-001")).json();
  expect(detail.data).toMatchObject({ id: "p-001", priceMinor: 349900 });
  const missing = await request.get("/api/lab/products/missing");
  expect(missing.status()).toBe(404);
  expect((await missing.json()).error.code).toBe("PRODUCT_NOT_FOUND");
  for (const query of [
    "page=0",
    "pageSize=25",
    "category=unknown",
    "page=1&page=2",
    "unknown=1",
  ]) {
    const r = await request.get("/api/lab/products?" + query);
    expect(r.status()).toBe(400);
    expect((await r.json()).error.code).toBe("INVALID_QUERY");
  }
  expect((await request.post("/api/lab/products", { data: {} })).status()).toBe(
    405,
  );
  const schema = await (await request.get("/api/lab/openapi")).json();
  expect(schema.paths["/products/{id}"]).toBeTruthy();
  expect(JSON.stringify(first)).not.toMatch(
    /owner_id|access_token|email|subscription/,
  );
  const alias = await request.get("/api/health", {
    headers: { host: "lab.muzammilpatel.com" },
  });
  expect(alias.status()).toBe(200);
});
test("storefront searches, filters, paginates and displays server-backed details", async ({
  page,
}) => {
  await page.goto("/lab");
  const catalogue = page.getByRole("region", { name: "Products", exact: true });
  await expect(catalogue.getByRole("article")).toHaveCount(6);
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await expect(catalogue).toContainText("Daypack");
  await page
    .getByRole("group", { name: "Product categories" })
    .getByRole("button", { name: "Desk", exact: true })
    .click();
  await expect(catalogue.getByRole("article")).toHaveCount(4);
  await page.getByLabel("Availability", { exact: true }).selectOption("out");
  await expect(
    page.getByRole("heading", { name: "No products match these filters." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByLabel("Search products", { exact: true }).fill("Orbit");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(catalogue.getByRole("article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "View Orbit headphones", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("12 in stock");
  await expect(dialog).toContainText("₹3,499");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page
    .getByRole("button", { name: "View Orbit headphones", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Inspect this API response →", exact: true })
    .click();
  await expect(page.getByTestId("request-url")).toHaveText(
    "/api/lab/products/p-001",
  );
  await page
    .getByRole("button", { name: "Send request →", exact: true })
    .click();
  await expect(page.getByTestId("api-response")).toContainText('"id": "p-001"');
});
test("learning progress is local and resettable; starter is downloadable; layouts fit", async ({
  page,
}) => {
  await page.goto("/lab?view=learn");
  const task = page.getByTestId("exercise-health");
  await task.getByRole("checkbox").check();
  await page.reload();
  await expect(task.getByRole("checkbox")).toBeChecked();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download Python starter ↓", exact: true })
    .click();
  expect((await downloaded).suggestedFilename()).toBe(
    "automation-lab-starter.zip",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "↺ Reset workspace", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Products", exact: true })
      .getByRole("article"),
  ).toHaveCount(6);
  await page
    .getByRole("navigation", { name: "Lab workspaces" })
    .getByRole("button", { name: /Learning path/ })
    .click();
  await expect(task.getByRole("checkbox")).not.toBeChecked();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ["store", "api", "learn"]) {
      await page.goto("/lab?view=" + view);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "view " + view + " width " + width,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/lab");
  await expect(
    page.getByRole("region", { name: "Products", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/automation-lab-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await page.screenshot({
    path: "/tmp/automation-lab-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("catalogue recovers from a failed request and API explorer exposes 400 responses", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/lab/products?*", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { error: { message: "Temporary test failure" } },
        })
      : route.continue(),
  );
  await page.goto("/lab");
  await expect(page.locator(".lab-empty[role=alert]")).toContainText(
    "Temporary test failure",
  );
  fail = false;
  await page
    .getByRole("button", { name: "Retry catalogue", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Products", exact: true })
      .getByRole("article"),
  ).toHaveCount(6);
  await page
    .getByRole("navigation", { name: "Lab workspaces" })
    .getByRole("button", { name: /API Explorer/ })
    .click();
  await page
    .getByLabel("Endpoint", { exact: true })
    .selectOption("/products?page=0");
  await page
    .getByRole("button", { name: "Send request →", exact: true })
    .click();
  await expect(page.getByTestId("api-response")).toContainText("INVALID_QUERY");
  await expect(
    page.getByRole("region", { name: "API response", exact: true }),
  ).toContainText("400");
});
