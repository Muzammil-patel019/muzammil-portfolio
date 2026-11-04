import { test, expect, type Download, type Page } from "@playwright/test";

const token = "a".repeat(43);
const personalView = {
  plan: {
    name: "YouTube Premium",
    paymentNote: "Pay to the manager and confirm once sent.",
    interval: "monthly",
  },
  member: { id: "11111111-1111-4111-8111-111111111111", name: "Alice" },
  cycles: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      startDate: "2026-11-01",
      dueDate: "2026-11-05",
      renewalDate: "2026-12-01",
      currency: "INR",
      amountMinor: 3367,
      payments: [{ amountMinor: 1000, date: "2026-11-02" }],
    },
  ],
};

async function createDemo(page: Page) {
  await page.goto("/subscriptions?demo=1");
  await page.getByLabel("Total subscription price").fill("101.00");
  await page.getByLabel("Billing schedule starts").fill("2026-11-01");
  await page
    .getByLabel("Members — one name per line")
    .fill("Manager\nAlice\nBob");
  await page.getByRole("button", { name: "Create plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No bills yet." }),
  ).toBeVisible();
}

async function openCycle(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Open next cycle" }).click();
  await expect(page.getByLabel("View cycle")).toBeVisible();
}

function memberRow(page: Page, name: string) {
  return page.locator("tbody tr").filter({
    has: page.getByText(name, { exact: true }),
  });
}

async function downloadText(download: Download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("The downloaded file is unavailable.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

test("demo splits every paise, records partial payments, and preserves old bills after changes", async ({
  page,
}) => {
  await createDemo(page);
  await openCycle(page);
  const firstCycle = await page.getByLabel("View cycle").inputValue();
  await expect(memberRow(page, "Manager").locator("td").nth(1)).toHaveText(
    "₹33.67",
  );
  await expect(memberRow(page, "Alice").locator("td").nth(1)).toHaveText(
    "₹33.67",
  );
  await expect(memberRow(page, "Bob").locator("td").nth(1)).toHaveText(
    "₹33.66",
  );

  await memberRow(page, "Alice")
    .getByRole("button", { name: "Record payment" })
    .click();
  await page.getByLabel("Amount received").fill("10.00");
  await page
    .getByLabel("Private reference / note")
    .fill("Private bank reference");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(memberRow(page, "Alice")).toContainText("Part paid");
  await expect(memberRow(page, "Alice").locator("td").nth(2)).toHaveText(
    "₹10.00",
  );
  await expect(memberRow(page, "Alice").locator("td").nth(3)).toHaveText(
    "₹23.67",
  );

  await memberRow(page, "Alice")
    .getByRole("button", { name: "Record payment" })
    .click();
  await page.getByLabel("Amount received").fill("23.68");
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Payment exceeds this member’s remaining balance.",
  );
  await expect(memberRow(page, "Alice").locator("td").nth(2)).toHaveText(
    "₹10.00",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await page
    .getByRole("button", { name: "Plan & members", exact: true })
    .click();
  await expect(page.getByLabel("Billing schedule starts")).toBeEnabled();
  await expect(page.getByLabel("Billing frequency")).toBeEnabled();
  await page.getByLabel("Total subscription price").fill("120.00");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Plan & members", exact: true })
    .click();
  await page
    .locator(".plan-member-list li")
    .filter({ hasText: "Bob" })
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await expect(
    page.locator(".plan-member-list li").filter({ hasText: "Bob" }),
  ).toContainText("Inactive · history kept");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await openCycle(page);
  await expect(page.locator("tbody tr:not(.plan-inline-receipt)")).toHaveCount(
    2,
  );
  await expect(memberRow(page, "Manager").locator("td").nth(1)).toHaveText(
    "₹60.00",
  );
  await expect(memberRow(page, "Alice").locator("td").nth(1)).toHaveText(
    "₹60.00",
  );
  await expect(page.getByLabel("View cycle").locator("option")).toHaveCount(2);

  await page.getByLabel("View cycle").selectOption(firstCycle);
  await expect(page.locator("tbody tr:not(.plan-inline-receipt)")).toHaveCount(
    3,
  );
  await expect(memberRow(page, "Bob").locator("td").nth(1)).toHaveText(
    "₹33.66",
  );
  await expect(memberRow(page, "Alice").locator("td").nth(1)).toHaveText(
    "₹33.67",
  );
  await expect(memberRow(page, "Alice").locator("td").nth(3)).toHaveText(
    "₹23.67",
  );
  await page
    .getByText("Payment history & corrections", { exact: true })
    .click();
  await expect(page.locator(".plan-history")).toContainText(
    "Private bank reference",
  );
});

test("opening another cycle discards an unsubmitted payment without changing either bill", async ({
  page,
}) => {
  await createDemo(page);
  await openCycle(page);
  const firstCycle = await page.getByLabel("View cycle").inputValue();
  await memberRow(page, "Alice")
    .getByRole("button", { name: "Record payment" })
    .click();
  await page.getByLabel("Amount received").fill("10.00");
  await page.getByLabel("Private reference / note").fill("Never submitted");

  await openCycle(page);
  await expect(page.getByLabel("View cycle")).not.toHaveValue(firstCycle);
  await expect(
    page.getByRole("heading", { name: "Record payment for Alice" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save payment", exact: true }),
  ).toHaveCount(0);
  for (const name of ["Manager", "Alice", "Bob"]) {
    await expect(memberRow(page, name).locator("td").nth(2)).toHaveText(
      "₹0.00",
    );
  }

  await page.getByLabel("View cycle").selectOption(firstCycle);
  for (const name of ["Manager", "Alice", "Bob"]) {
    await expect(memberRow(page, name).locator("td").nth(2)).toHaveText(
      "₹0.00",
    );
  }
  await page
    .getByText("Payment history & corrections", { exact: true })
    .click();
  await expect(page.locator(".plan-history")).toContainText(
    "No payments recorded yet.",
  );
  await expect(page.locator(".plan-history")).not.toContainText(
    "Never submitted",
  );
});

test("demo is explicit, cannot create shared links, and clears on refresh", async ({
  page,
}) => {
  await createDemo(page);
  await expect(page.getByText("Demo mode.", { exact: false })).toContainText(
    "Refreshing clears this session.",
  );
  for (const button of await page
    .getByRole("button", { name: "Create link", exact: true })
    .all()) {
    await expect(button).toBeDisabled();
  }
  await expect(
    page.getByRole("button", { name: /^Copy link for / }),
  ).toHaveCount(3);
  await openCycle(page);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Set up your plan" }),
  ).toBeVisible();
  await expect(page.getByLabel("Total subscription price")).toHaveValue("");
  await expect(page.getByLabel("Members — one name per line")).toHaveValue("");
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("manager space requires login and anonymous APIs cannot read or change plans", async ({
  page,
  request,
}) => {
  await page.goto("/subscriptions");
  await expect(
    page.getByRole("link", { name: "Sign in to manage" }),
  ).toHaveAttribute("href", "/login?next=subscriptions");
  await expect(
    page.getByRole("button", { name: "Open next cycle" }),
  ).toHaveCount(0);
  for (const endpoint of ["/api/subscriptions", "/api/subscriptions/share"]) {
    const read = await request.get(endpoint);
    expect(read.status()).toBe(401);
    expect(read.headers()["cache-control"]).toContain("no-store");
    const write = await request.post(endpoint, { data: {} });
    expect(write.status()).toBe(401);
  }
  const missingToken = await request.get("/api/subscriptions/view");
  expect(missingToken.status()).toBe(404);
  const queryToken = await request.get(
    `/api/subscriptions/view?token=${token}`,
  );
  expect(queryToken.status()).toBe(404);

  await page.goto("/");
  await expect(page.locator('a[href^="/subscriptions"]')).toHaveCount(0);
});

test("personal view sends its fragment token only in the authorization header and exports the due date", async ({
  page,
}) => {
  const requests: {
    url: string;
    authorization: string | undefined;
    referer: string | undefined;
  }[] = [];
  await page.route("**/api/subscriptions/view", async (route) => {
    const request = route.request();
    requests.push({
      url: request.url(),
      authorization: request.headers().authorization,
      referer: request.headers().referer,
    });
    await route.fulfill({ json: personalView });
  });
  await page.goto(`/subscriptions/view#${token}`);
  await expect(
    page.getByRole("heading", { name: "YouTube Premium", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("HELLO, ALICE", { exact: true })).toBeVisible();

  await expect(page.locator(".plan-personal-summary")).toContainText("₹23.67");
  await expect(
    page.getByRole("button", { name: "Help", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText("Manager", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Bob", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Private bank reference", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /Record payment|Save settings|Create link|Revoke/,
    }),
  ).toHaveCount(0);

  await expect(page.locator(".plan-member-cycle")).toContainText(
    "2 Nov 2026 · ₹10.00",
  );

  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download payment calendar date" })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("subscription-payment.ics");
  const calendar = await downloadText(download);
  expect(calendar).toContain("BEGIN:VCALENDAR\r\n");
  expect(calendar).toContain("DTSTART;VALUE=DATE:20261105");
  expect(calendar).toContain("DTEND;VALUE=DATE:20261106");
  expect(calendar).toContain("SUMMARY:YouTube Premium payment due");
  expect(calendar).toContain("Amount remaining: ₹23.67");
  expect(calendar).not.toContain(token);

  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(2);
  for (const request of requests) {
    expect(new URL(request.url).pathname).toBe("/api/subscriptions/view");
    expect(new URL(request.url).search).toBe("");
    expect(request.url).not.toContain(token);
    expect(request.authorization).toBe(`Bearer ${token}`);
    expect(request.referer).toBeUndefined();
  }
});

test("revoked personal links clear previously visible billing details", async ({
  page,
}) => {
  let revoked = false;
  await page.route("**/api/subscriptions/view", (route) =>
    route.fulfill(
      revoked
        ? {
            status: 404,
            json: { error: "This link is invalid or has been revoked." },
          }
        : { json: personalView },
    ),
  );
  await page.goto(`/subscriptions/view#${token}`);
  await expect(
    page.getByRole("heading", { name: "YouTube Premium", exact: true }),
  ).toBeVisible();
  revoked = true;
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "This link is invalid or has been revoked.",
  );
  await expect(page.getByText("₹23.67", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "YouTube Premium", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
});

test("incomplete personal links explain recovery without sending a token request", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/subscriptions/view", async (route) => {
    requests++;
    await route.abort();
  });
  await page.goto("/subscriptions/view#incomplete");
  await expect(page.getByRole("status")).toHaveText(
    "This personal link is missing or incomplete. Ask your plan manager for a new link.",
  );
  expect(requests).toBe(0);
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
});

test("member receipts identify billing month and exact period on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/subscriptions/view", (route) =>
    route.fulfill({ json: personalView }),
  );
  await page.goto(`/subscriptions/view#${token}`);
  await page.getByRole("button", { name: "History", exact: true }).click();
  const receipts = page.locator(".plan-receipts");
  await expect(receipts).toContainText("November 2026");
  await expect(receipts).toContainText("1 Nov 2026 – 1 Dec 2026");
  await expect(receipts).toContainText("2 Nov 2026");
  await expect(receipts).toContainText("₹10.00");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const href = await page
    .getByRole("link", { name: "Pay ₹23.67 with UPI" })
    .first()
    .getAttribute("href");
  expect(new URL(href!).searchParams.get("am")).toBe("23.67");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("plan deletion requires the exact plan name and resets the demo", async ({
  page,
}) => {
  await createDemo(page);
  await page
    .getByRole("button", { name: "Plan & members", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept("wrong name"));
  await page.getByRole("button", { name: "Delete plan permanently" }).click();
  await expect(
    page.getByRole("button", { name: "Delete plan permanently" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept("YouTube Premium"));
  await page.getByRole("button", { name: "Delete plan permanently" }).click();
  await expect(
    page.getByRole("button", { name: "Create plan", exact: true }),
  ).toBeVisible();
});

test("member join date and past periods stay visible in the statement", async ({
  page,
}) => {
  await createDemo(page);
  await page
    .getByRole("button", { name: "Plan & members", exact: true })
    .click();
  await page.getByLabel("Joined date for Alice").fill("2026-10-05");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByText("Add a past billing period", { exact: true }).click();
  await page.getByLabel("Past period starts").fill("2026-10-01");
  await page.getByLabel("Total price for this period").fill("90.00");
  await page
    .getByRole("button", { name: "Add past period", exact: true })
    .click();
  await expect(page.getByLabel("View cycle")).toContainText("2026-10-01");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Open next cycle", exact: true })
    .click();
  await expect(page.getByLabel("View cycle")).toHaveValue(/.+/);
  await expect(
    page.getByLabel("View cycle").locator("option:checked"),
  ).toContainText("2026-11-01");
});

test("multiple subscription tabs keep their documents separate", async ({
  page,
}) => {
  await createDemo(page);
  await openCycle(page);
  await page
    .getByRole("button", { name: "+ Add subscription", exact: true })
    .click();
  await page.getByLabel("Plan name", { exact: true }).fill("Cloud storage");
  await page.getByLabel("Total subscription price").fill("120");
  await page.getByLabel("Billing frequency").selectOption("quarterly");
  await page.getByLabel("Billing schedule starts").fill("2026-11-01");
  await page.getByLabel("Members — one name per line").fill("Manager\nAlice");
  await page.getByRole("button", { name: "Create plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cloud storage", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "YouTube Premium", exact: true })
    .click();
  await expect(page.getByLabel("View cycle")).toBeVisible();
  await page
    .getByRole("button", { name: "Plan & members", exact: true })
    .click();
  await page.getByLabel("Billing frequency").selectOption("half-yearly");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(page.getByLabel("View cycle")).toContainText("2026-11-01");
  await page
    .getByRole("button", { name: "Cloud storage", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No bills yet.", exact: true }),
  ).toBeVisible();
});

test("reported payment waits for opening and delay, without confirming receipt", async ({
  page,
}) => {
  await page.clock.install();
  let opened = false,
    reported = false;
  await page.route("**/api/subscriptions/view", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      if (body.action === "opened") opened = true;
      if (body.action === "paid") reported = true;
      await route.fulfill({ json: { reported } });
    } else await route.fulfill({ json: personalView });
  });
  await page.goto(`/subscriptions/view#${token}`);
  const paidButton = page.getByRole("button", {
    name: "I’ve paid",
    exact: true,
  });
  await expect(paidButton).toBeDisabled();
  await page.getByRole("link", { name: "Pay ₹23.67 with UPI" }).click();
  await expect.poll(() => opened).toBe(true);
  await expect(page.getByRole("button", { name: /I’ve paid/ })).toBeDisabled();
  await page.clock.fastForward(11000);
  await page.getByRole("button", { name: "I’ve paid", exact: true }).click();
  await expect.poll(() => reported).toBe(true);
  await expect(
    page.getByRole("button", { name: "Reported paid · awaiting confirmation" }),
  ).toBeDisabled();
  await expect(page.locator(".plan-simple-summary")).toContainText("₹23.67");
});

test("short branded links support coverage requests and confirmed-payment activity", async ({
  page,
}) => {
  const code = "c".repeat(22);
  const requests: { action: string; months: number }[] = [];
  await page.route("**/api/subscriptions/view", async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${code}`);
    if (route.request().method() === "POST") {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ json: { reported: false } });
    } else await route.fulfill({ json: personalView });
  });
  const response = await page.goto(`/shared/${code}`);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await page.getByRole("radio", { name: "Quarterly", exact: true }).check();
  await expect(
    page.getByRole("link", { name: "Pay ₹91.01 with UPI" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request this schedule", exact: true })
    .click();
  await expect
    .poll(() =>
      requests.some((r) => r.action === "preference" && r.months === 3),
    )
    .toBe(true);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.locator(".plan-activity-grid button[data-paid=true]"),
  ).toHaveCount(1);
  await page.locator(".plan-activity-grid button[data-paid=true]").click();
  await expect(page.locator(".plan-activity-selection")).toContainText(
    "₹10.00 confirmed",
  );
  await page.getByLabel("Payment activity year").selectOption("2026");
});

test("manager confirmation places excess money into credit and applies it to the next bill", async ({
  page,
}) => {
  await createDemo(page);
  await openCycle(page);
  await memberRow(page, "Alice")
    .getByRole("button", { name: "Record payment" })
    .click();
  await page.getByLabel("Amount received").fill("100.00");
  await page.getByLabel("Record excess as advance credit").check();
  await page.getByRole("button", { name: "Save payment", exact: true }).click();
  await page
    .getByText("Payment history & corrections", { exact: true })
    .click();
  await expect(page.locator(".plan-history")).toContainText("₹66.33 remaining");
  await openCycle(page);
  await expect(memberRow(page, "Alice").locator("td").nth(2)).toHaveText(
    "₹33.67",
  );
  await expect(memberRow(page, "Alice").locator("td").nth(3)).toHaveText(
    "₹0.00",
  );
});

test("group invitation shows first names and submits a private join request", async ({ page }) => {
  const code = "g".repeat(22);
  let submitted: unknown;
  await page.route("**/api/subscriptions/group", async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${code}`);
    if (route.request().method() === "PUT") {
      submitted = route.request().postDataJSON();
      await route.fulfill({ json: { requested: true } });
    } else await route.fulfill({ json: { name: "Premium friends", members: [{ firstName: "Alice" }, { firstName: "Bob" }] } });
  });
  const response = await page.goto(`/group/${code}`);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Premium friends" })).toBeVisible();
  await expect(page.locator(".plan-group-members")).toContainText("Alice");
  await page.getByLabel("Your name").fill("New Friend");
  await page.getByLabel("Email for the manager").fill("friend@example.com");
  await page.getByRole("button", { name: "Request to join", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Request sent" })).toBeVisible();
  expect(submitted).toEqual({ name: "New Friend", email: "friend@example.com" });
});
