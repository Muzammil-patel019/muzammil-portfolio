import { test, expect } from "@playwright/test";
test("personal hub is owner-gated and financial APIs reject anonymous callers", async ({
  page,
}) => {
  const response = await page.goto("/dashboard");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(
    page.getByRole("link", { name: "Sign in to your dashboard", exact: true }),
  ).toHaveAttribute("href", "/login?next=dashboard");
  expect((await page.request.get("/api/dashboard")).status()).toBe(401);
  expect((await page.request.get("/api/renewals")).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/renewals", {
        data: { revision: 0, document: { version: 1, items: [] } },
      })
    ).status(),
  ).toBe(401);
  await page.goto("/login?next=dashboard");
  await expect(
    page.getByRole("heading", { name: "Your personal hub", exact: true }),
  ).toBeVisible();
});
test("renewals roll forward with history, update the agenda and keep archived records", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard?demo=1&tab=renewals");
  await page
    .getByRole("button", { name: "+ Add renewal", exact: true })
    .click();
  await page.getByLabel("Renewal name", { exact: true }).fill("Domain renewal");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Domain");
  await page.getByLabel("Provider (optional)").fill("Example registrar");
  await page
    .getByLabel("Due / expiry date", { exact: true })
    .fill("2026-01-31");
  await page
    .getByRole("combobox", { name: "Repeat", exact: true })
    .selectOption("monthly");
  await page.getByLabel("Estimated amount (INR, optional)").fill("1000");
  await page.getByRole("button", { name: "Save renewal", exact: true }).click();
  await expect(page.locator(".hub-renewal-item")).toHaveCount(1);
  const calendar = page.waitForEvent("download");
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  expect((await calendar).suggestedFilename()).toBe("renewal-reminder.ics");
  await page
    .getByRole("button", { name: "Record renewal", exact: true })
    .click();
  await expect(page.getByLabel("Next actual due date")).toHaveValue(
    "2026-02-28",
  );
  await page.getByLabel("Completion date", { exact: true }).fill("2026-01-20");
  await page.getByLabel("Amount recorded (INR)").fill("1200");
  await page
    .getByRole("button", { name: "Confirm renewal", exact: true })
    .click();
  await page.getByText("Renewal history · 1", { exact: true }).click();
  await expect(page.locator(".hub-renewal-history")).toContainText(
    "31 Jan 2026 → 28 Feb 2026",
  );
  await expect(page.locator(".hub-renewal-history")).toContainText("₹1,200.00");
  await page
    .getByRole("navigation", { name: "Dashboard sections" })
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await expect(page.locator(".hub-agenda")).toContainText("Domain renewal");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "/tmp/personal-hub-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("navigation", { name: "Dashboard sections" })
    .getByRole("button", { name: "Renewals", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page.locator(".hub-renewal-item")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Renewal status", exact: true })
    .selectOption("archived");
  await expect(page.locator(".hub-renewal-item")).toHaveCount(1);
  await expect(page.locator(".hub-renewal-history")).toContainText(
    "31 Jan 2026",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Renewal status", exact: true })
    .selectOption("active");
  await page
    .getByRole("button", { name: "Record renewal", exact: true })
    .click();
  await expect(page.getByLabel("Next actual due date")).toHaveValue(
    "2026-03-31",
  );
  await page.getByRole("button", { name: "Close form", exact: true }).click();
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "/tmp/renewals-mobile-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Keep your next important date here." }),
  ).toBeVisible();
});
