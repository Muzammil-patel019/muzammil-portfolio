import { test, expect, type Page } from "@playwright/test";
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
async function tab(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Organizer sections" })
    .getByRole("button", { name, exact: true })
    .click();
}
test("organizer requires owner login and anonymous writes are denied", async ({
  page,
}) => {
  const response = await page.goto("/organizer");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(
    page.getByRole("link", { name: "Sign in to Organizer" }),
  ).toHaveAttribute("href", "/login?next=organizer");
  expect((await page.request.get("/api/organizer")).status()).toBe(401);
  expect(
    (await page.request.post("/api/organizer", { data: {} })).status(),
  ).toBe(401);
  await page.goto("/login?next=organizer");
  await expect(
    page.getByRole("heading", { name: "Your private organizer" }),
  ).toBeVisible();
});
test("expenses, budgets and CSV remain accurate while switching private tabs", async ({
  page,
}) => {
  await page.goto("/organizer?demo=1");
  await page
    .getByRole("button", { name: "+ Add expense", exact: true })
    .click();
  await page.getByLabel("Expense description", { exact: true }).fill("Lunch");
  await page.getByLabel("Amount spent (INR)", { exact: true }).fill("150.25");
  await page.getByLabel("Expense category", { exact: true }).fill("Food");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.locator(".organizer-record")).toContainText("₹150.25");
  await page.getByRole("button", { name: "Set a budget", exact: true }).click();
  await page.getByLabel("Budget limit (INR)", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Save budget", exact: true }).click();
  await expect(page.locator(".organizer-budget")).toContainText("₹50.25 over");
  await tab(page, "Applications");
  await tab(page, "Expenses");
  await expect(page.locator(".organizer-record")).toContainText("Lunch");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export all expenses" }).click();
  expect((await dl).suggestedFilename()).toBe("expenses.csv");
  await page.getByRole("button", { name: "Edit expense", exact: true }).click();
  await page.getByLabel("Amount spent (INR)", { exact: true }).fill("75");
  await page.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(page.locator(".organizer-budget")).toContainText("₹25.00 left");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page
    .getByRole("button", { name: "Toggle dark mode", exact: true })
    .click();
  await page.screenshot({
    path: "/tmp/organizer-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("applications track stage history and supply interview reminders", async ({
  page,
}) => {
  await page.goto("/organizer?demo=1&tab=jobs");
  await page
    .getByRole("button", { name: "+ Add application", exact: true })
    .click();
  await page.getByLabel("Company", { exact: true }).fill("Example employer");
  await page.getByLabel("Role", { exact: true }).fill("Automation engineer");
  await page.getByLabel("Follow-up date (optional)", { exact: true }).fill(day);
  await page
    .getByLabel("Interview date and time (IST)", { exact: true })
    .fill(day + "T10:30");
  await page
    .getByRole("button", { name: "Save application", exact: true })
    .click();
  await page
    .getByLabel("Move application", { exact: true })
    .selectOption("Interview");
  await page.getByText("Status history · 2", { exact: true }).click();
  await expect(page.locator(".organizer-details").last()).toContainText(
    "Interview",
  );
  await tab(page, "Reminders");
  await expect(page.locator(".organizer-reminder-list")).toContainText(
    "Example employer interview",
  );
  await expect(page.locator(".organizer-reminder-list")).toContainText("10:30");
});
test("savings preserve movement history and reject an overdraft without losing the form", async ({
  page,
}) => {
  await page.goto("/organizer?demo=1&tab=goals");
  await page
    .getByRole("button", { name: "+ Add savings goal", exact: true })
    .click();
  await page.getByLabel("Goal name", { exact: true }).fill("Emergency fund");
  await page.getByLabel("Savings target (INR)", { exact: true }).fill("1000");
  await page
    .getByRole("button", { name: "Save savings goal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record savings movement", exact: true })
    .click();
  await page.getByLabel("Movement amount (INR)", { exact: true }).fill("500");
  await page
    .getByRole("button", { name: "Save savings movement", exact: true })
    .click();
  await expect(page.locator(".organizer-goal")).toContainText("50%");
  await page
    .getByRole("button", { name: "Record savings movement", exact: true })
    .click();
  await page
    .getByLabel("Savings movement", { exact: true })
    .selectOption("withdrawal");
  await page.getByLabel("Movement amount (INR)", { exact: true }).fill("501");
  await page
    .getByRole("button", { name: "Save savings movement", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Withdrawals cannot exceed",
  );
  await expect(
    page.getByLabel("Movement amount (INR)", { exact: true }),
  ).toHaveValue("501");
  await page.getByLabel("Movement amount (INR)", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "Save savings movement", exact: true })
    .click();
  await expect(page.locator(".organizer-goal")).toContainText("40%");
  await page.getByText("Savings history · 2", { exact: true }).click();
  await expect(page.locator(".organizer-ledger-row")).toHaveCount(2);
});
test("private notes can be searched, pinned and restored; reminders snooze and reopen", async ({
  page,
}) => {
  await page.goto("/organizer?demo=1&tab=notes");
  await page
    .getByRole("button", { name: "+ Add note or bookmark", exact: true })
    .click();
  await page.getByLabel("Note title", { exact: true }).fill("Study resources");
  await page.getByLabel("Entry type", { exact: true }).selectOption("bookmark");
  await page
    .getByLabel("Bookmark link (optional for notes)", { exact: true })
    .fill("https://example.com");
  await page
    .getByLabel("Tags (comma separated)", { exact: true })
    .fill("study, testing");
  await page
    .getByLabel("Note content", { exact: true })
    .fill("Review browser assertions\n- [ ] Practice tests");
  await page
    .getByRole("button", { name: "Save note or bookmark", exact: true })
    .click();
  await page.getByLabel("Practice tests", { exact: true }).check();
  await page.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Private notes" }),
  ).toContainText("PINNED");
  await page
    .getByLabel("Search notes and tags", { exact: true })
    .fill("testing");
  await expect(
    page.getByRole("heading", { name: "Study resources" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive note", exact: true }).click();
  await page.getByLabel("Show archived notes", { exact: true }).check();
  await page.getByRole("button", { name: "Restore note", exact: true }).click();
  await tab(page, "Reminders");
  await page
    .getByRole("button", { name: "+ Add personal reminder", exact: true })
    .click();
  await page.getByLabel("Reminder title", { exact: true }).fill("Review plans");
  await page.getByLabel("Reminder due date", { exact: true }).fill(day);
  await page
    .getByRole("button", { name: "Save personal reminder", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Snooze 7 days", exact: true })
    .click();
  await expect(page.locator(".organizer-reminder")).toHaveCount(0);
  await page
    .getByLabel("Reminder window", { exact: true })
    .selectOption("hidden");
  await page
    .getByRole("button", { name: "Restore reminder", exact: true })
    .click();
  await page.getByLabel("Reminder window", { exact: true }).selectOption("all");
  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download reminder calendar" })
    .click();
  expect((await dl).suggestedFilename()).toBe("personal-reminders.ics");
  await page
    .getByRole("button", { name: "Mark reminder done", exact: true })
    .click();
  await expect(page.locator(".organizer-reminder")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reopen reminder", exact: true })
    .click();
  await expect(page.locator(".organizer-reminder")).toHaveCount(1);
});
