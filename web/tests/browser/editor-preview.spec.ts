import { test, expect } from "@playwright/test";

test("desktop resume preview stays visible while editing and scrolls independently", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin?demo=1");
  const preview = page.getByRole("region", {
    name: "Scrollable resume preview",
  });
  await page.locator("#education").scrollIntoViewIfNeeded();
  await expect(preview).toBeInViewport();
  const top = await preview.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  expect(top).toBeGreaterThanOrEqual(90);
  await preview.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(
    await preview.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  await page.locator("#education").fill("Updated education for preview");
  await expect(preview).toContainText("Updated education for preview");
  await expect(
    page.getByRole("button", { name: "Publish to portfolio" }),
  ).toBeInViewport();
});

test("phone studio switches between editing and preview without hiding actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin?demo=1");
  await page.locator("#name").fill("Phone Preview Example");
  await page
    .getByRole("button", { name: "Preview resume", exact: true })
    .click();
  const preview = page.getByRole("region", {
    name: "Scrollable resume preview",
  });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Phone Preview Example");
  await expect(page.locator("#name")).toBeHidden();
  await expect(
    page
      .getByLabel("Resume actions")
      .getByRole("button", { name: "Export PDF" }),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Edit fields", exact: true }).click();
  await expect(page.locator("#name")).toHaveValue("Phone Preview Example");
  await expect(preview).toBeHidden();
});
