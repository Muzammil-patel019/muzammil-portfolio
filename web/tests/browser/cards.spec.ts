import { test, expect } from "@playwright/test";

test("Cards requires sign-in and APIs never expose anonymous financial data", async ({
  page,
}) => {
  const response = await page.goto("/cards");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(
    page.getByRole("link", { name: "Sign in to Cards", exact: true }),
  ).toHaveAttribute("href", "/login?next=cards");
  expect((await page.request.get("/api/cards")).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/cards", {
        data: {
          revision: 0,
          document: { version: 1, cards: [], statements: [] },
        },
      })
    ).status(),
  ).toBe(401);
  await page.goto("/login?next=cards");
  await expect(
    page.getByRole("heading", { name: "Your cards, privately" }),
  ).toBeVisible();
});

test("card bills track minimum and full receipts, dates, corrections and archived history", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cards?demo=1");
  await page
    .getByRole("button", { name: "Add your first card", exact: true })
    .click();
  await page.getByLabel("Card nickname", { exact: true }).fill("Everyday");
  await page.getByLabel("Bank / issuer").fill("Example Bank");
  await page.getByLabel("Last four digits").fill("1234");
  await page.getByLabel("Credit limit (INR)").fill("100000");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await expect(page.locator(".cards-wallet")).toContainText("••••");
  await page
    .getByRole("button", { name: "+ Record statement", exact: true })
    .click();
  await page.getByLabel("Statement date", { exact: true }).fill("2026-11-01");
  await page.getByLabel("Actual payment due date").fill("2026-11-20");
  await page.getByLabel("Total bill (INR)").fill("5000");
  await page.getByLabel("Minimum due (INR)").fill("500");
  await page
    .getByRole("button", { name: "Save statement", exact: true })
    .click();
  await expect(page.locator(".cards-detail-grid")).toContainText("₹5,000.00");
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(page.getByLabel("Amount paid (INR)")).toBeInViewport();
  await page.getByLabel("Amount paid (INR)").fill("500");
  await page.getByLabel("Payment date", { exact: true }).fill("2026-11-02");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(page.locator(".cards-detail-grid")).toContainText(
    "Minimum recorded as paid",
  );
  await expect(page.locator(".cards-detail-grid")).toContainText("₹4,500.00");
  await page.getByRole("button", { name: "Archive card", exact: true }).click();
  await expect(page.locator(".cards-status")).toContainText(
    "unpaid latest bill",
  );
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByLabel("Amount paid (INR)").fill("5000");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(page.locator(".cards-status")).toContainText(
    "remaining balance",
  );
  await page.getByLabel("Amount paid (INR)").fill("4500");
  await page.getByLabel("Payment date", { exact: true }).fill("2026-11-03");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(page.locator(".cards-bill-hero>strong")).toHaveText(
    "Paid in full",
  );
  await page
    .getByRole("button", { name: "View all history", exact: true })
    .click();
  await expect(page.locator(".cards-payment-history li")).toHaveCount(2);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Correct / remove", exact: true })
    .last()
    .click();
  await expect(page.locator(".cards-payment-history li")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByLabel("Amount paid (INR)").fill("4500");
  await page.getByLabel("Payment date", { exact: true }).fill("2026-11-03");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(page.locator(".cards-payment-history li")).toHaveCount(2);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export statement history" }).click();
  expect((await downloading).suggestedFilename()).toBe("card-statements.csv");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Archive card", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Archived", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".cards-payment-history li")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "/tmp/cards-history-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "/tmp/cards-history-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Start with your first card." }),
  ).toBeVisible();
});

test("minimum and full-payment shortcuts produce clear receipts and a payment timeline", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cards?demo=1");
  await page
    .getByRole("button", { name: "Add your first card", exact: true })
    .click();
  await page.getByLabel("Card nickname", { exact: true }).fill("Everyday");
  await page.getByLabel("Bank / issuer").fill("Example Bank");
  await page.getByLabel("Last four digits").fill("1234");
  await page.getByLabel("Credit limit (INR)").fill("100000");
  await page.getByRole("button", { name: "Save card", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Record statement", exact: true })
    .click();
  await page.getByLabel("Statement date", { exact: true }).fill("2026-11-01");
  await page.getByLabel("Actual payment due date").fill("2026-11-03");
  await page.getByLabel("Total bill (INR)").fill("5000");
  await page.getByLabel("Minimum due (INR)").fill("500");
  await page
    .getByRole("button", { name: "Save statement", exact: true })
    .click();
  await page.getByRole("button", { name: "Overdue", exact: true }).click();
  await expect(page.locator(".cards-wallet-item")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByRole("button", { name: /Minimum remaining ₹500.00/ }).click();
  await expect(page.getByLabel("Amount paid (INR)")).toHaveValue("500.00");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Payment recorded" }),
  ).toContainText("₹4,500.00 still outstanding");
  await page
    .getByRole("button", { name: "Mark bill paid", exact: true })
    .click();
  await expect(page.getByLabel("Amount paid (INR)")).toHaveValue("4500.00");
  await page
    .getByRole("button", { name: "Confirm full payment", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Payment recorded" }),
  ).toContainText("This bill is paid in full.");
  await expect(page.locator(".cards-wallet-item")).toHaveCount(0);
  await page.getByRole("button", { name: "Paid", exact: true }).click();
  await expect(page.locator(".cards-wallet-item")).toHaveCount(1);
  await page
    .getByRole("button", { name: "View all history", exact: true })
    .click();
  await page.getByRole("button", { name: "Payment log", exact: true }).click();
  await expect(page.locator(".cards-payment-log>article")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export payments", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("card-payments.csv");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "/tmp/cards-payment-log.png",
    fullPage: true,
    animations: "disabled",
  });
});
