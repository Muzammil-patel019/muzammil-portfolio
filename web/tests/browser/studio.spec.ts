import { test, expect } from "@playwright/test";
import { resumeFilename } from "../../lib/resume-filename";
import { readFile } from "node:fs/promises";
test("public pages and studio fit desktop and mobile", async ({ page }) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/",
      "/projects",
      "/resume",
      "/blog",
      "/links",
      "/login",
      "/admin?demo=1",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ), `${path} at ${width}px`,
      ).toBe(true);
    }
  }
});
test("anonymous clients cannot access private API operations", async ({
  request,
}) => {
  for (const [method, path] of [
    ["GET", "/api/versions"],
    ["POST", "/api/versions"],
    ["POST", "/api/publish"],
    ["POST", "/api/pdf"],
  ]) {
    expect((await request.fetch(path, { method, data: {} })).status()).toBe(
      401,
    );
  }
});
test("tailored copies preserve the master and export the edited content", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/admin?demo=1");
  await page
    .getByRole("button", { name: "Save privately", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText(
    "Saved in this demo session",
  );
  await page.locator("#version-name").fill("Java application");
  await page.locator("#kind").selectOption("tailored");
  await page.locator("#ct-tools").fill("Java, Selenium");
  await page.locator("#resume-layout").selectOption("compact");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await page
    .getByRole("button", { name: "Master profile master", exact: true })
    .click();
  await expect(page.locator("#ct-tools")).toHaveValue(
    "Python, TestComplete, Cucumber, Gherkin",
  );
  await expect(page.locator("#resume-layout")).toHaveValue("comfortable");
  await page
    .getByRole("button", { name: "Java application tailored", exact: true })
    .click();
  await expect(page.locator("#ct-tools")).toHaveValue("Java, Selenium");
  await expect(page.locator("#resume-layout")).toHaveValue("compact");
  await page.locator("#jd").fill("Java Selenium Playwright Docker SQL");
  await expect(page.locator("body")).toContainText("Playwright, Docker");
  const json = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  const file = await (await json).path();
  expect(JSON.parse(await readFile(file!, "utf8")).projects[2].tools).toEqual([
    "Java",
    "Selenium",
  ]);
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const generatedPDF = await pdf;
  expect(generatedPDF.suggestedFilename()).toBe(resumeFilename());
  const output = await generatedPDF.path();
  expect((await readFile(output!)).subarray(0, 4).toString()).toBe("%PDF");
  await expect(
    page.getByRole("button", { name: "Publish to portfolio" }),
  ).toBeDisabled();
  await page.goto("/resume");
  await expect(page.locator("main")).toContainText("Python · TestComplete");
});

test("mobile navigation supports Escape, outside clicks, and current-page state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects");
  await expect(page.locator('#main-nav a[href="/projects"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  const toggle = page.getByRole("button", { name: "Menu", exact: true });
  await toggle.click();
  await page.getByRole("link", { name: "Resume", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await toggle.click();
  // Click below the open dropdown, where the page is actually exposed.
  await page.mouse.click(375, 820);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.goto("/missing-page");
  await expect(
    page.getByRole("heading", { name: "This page wandered off." }),
  ).toBeVisible();
});

test("sticky editor actions save edits and remain reachable while scrolling", async ({
  page,
}) => {
  await page.goto("/admin?demo=1");
  await page.locator("#name").fill("Muzammil Patel");
  const bar = page.getByLabel("Resume actions");
  await bar.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status").first()).toContainText(
    "Saved in this demo session",
  );
  await expect(
    bar.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeDisabled();
  await page.locator("#education").scrollIntoViewIfNeeded();
  await expect(
    bar.getByRole("button", { name: "Export PDF", exact: true }),
  ).toBeInViewport();
});

test("home presents each selected project once and links to filterable details", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Muzammil Patel." })).toBeVisible();
  await expect(page.locator(".project-teaser")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "IGT Azurion" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Elever" })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "CT-Incisive" })).toHaveCount(1);
  await page.getByRole("link", { name: "Read about CT-Incisive" }).click();
  await expect(page).toHaveURL(/\/projects#project-ct$/);
  await expect(page.locator("#project-ct")).toBeVisible();
  await page.getByRole("button", { name: "Desktop", exact: true }).click();
  await expect(page.locator(".experience-grid article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "IGT Azurion" })).toBeVisible();
  await page.getByRole("button", { name: "Web", exact: true }).click();
  await expect(page.locator(".experience-grid article")).toHaveCount(2);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open learning hub" })).toHaveAttribute("href", "/learning");
});
