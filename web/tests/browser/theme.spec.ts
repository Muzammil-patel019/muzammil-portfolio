import { test, expect } from "@playwright/test";
test("theme follows the system, persists across all spaces and keeps resumes printable", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({path:"/tmp/dark-portfolio.png",fullPage:true,animations:"disabled"});
  const toggle = page.getByRole("button", {name:"Toggle dark mode"});
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", {name:"Toggle dark mode"}).click();
  for (const url of ["/resume", "/admin", "/login", "/learning", "/subscriptions?demo=1", "/shared/"+"c".repeat(22), "/group/"+"g".repeat(22)]) {
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", {name:"Toggle dark mode"})).toBeVisible();
  }
  await page.goto("/resume");
  await expect(page.locator(".resume-preview")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.emulateMedia({media:"print"});
  await expect(page.getByRole("button", {name:"Toggle dark mode"})).not.toBeVisible();
});
test("standalone lessons share the theme and work when storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(Storage.prototype, "getItem", {value(){throw new Error("blocked")}}); Object.defineProperty(Storage.prototype,"setItem", {value(){throw new Error("blocked")}}); });
  await page.goto("/learning/lab.html");
  await page.getByRole("button", {name:"Toggle dark mode"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", {name:"Toggle dark mode"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("learning iframe updates immediately with the parent theme", async ({page}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const frame = document.createElement("iframe"); frame.title = "Theme test lab"; frame.src = "/learning/lab.html"; document.body.append(frame);
  });
  const frame = page.frameLocator('iframe[title="Theme test lab"]');
  await expect(frame.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button",{name:"Toggle dark mode"}).click();
  await expect(frame.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(frame.getByRole("button",{name:"Toggle dark mode"})).toHaveCount(0);
});
