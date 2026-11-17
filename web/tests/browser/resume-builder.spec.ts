import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
test("style, order, links and optional sections survive versions and the downloaded PDF", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin?demo=1");
  await page
    .getByRole("button", { name: "Classic Traditional · serif", exact: true })
    .click();
  await expect(page.locator(".resume-preview")).toHaveClass(
    /resume-template-classic/,
  );
  await page.locator("#linkedin").fill("https://www.linkedin.com/in/example");
  await page.locator("#website").fill("https://example.com/work");
  await page
    .locator("#certifications")
    .fill("Automation certificate · Example issuer · 2026");
  await page
    .locator("#achievements")
    .fill("Created a reusable test reporting tool");
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Move Education up", exact: true })
      .click();
  await expect(page.locator("[data-resume-section]").first()).toHaveAttribute(
    "data-resume-section",
    "education",
  );
  await page
    .getByRole("button", { name: "Move project 1 down", exact: true })
    .click();
  const firstProject = await page
    .locator(".resume-project h4")
    .first()
    .textContent();
  await page
    .getByRole("button", { name: "Save privately", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText(
    "Saved in this demo session",
  );
  const exported = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export JSON backup", exact: true })
    .click();
  const saved = JSON.parse(
    await readFile((await (await exported).path())!, "utf8"),
  );
  expect(saved.template).toBe("classic");
  expect(saved.sectionOrder[0]).toBe("education");
  expect(saved.projects[0].name).toBe(firstProject);
  await page.locator("#version-name").fill("Modern copy");
  await page
    .getByRole("button", {
      name: "Modern Left aligned · sans serif",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Save as new version", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Master profile master", exact: true })
    .click();
  await expect(page.locator(".resume-preview")).toHaveClass(
    /resume-template-classic/,
  );
  await expect(page.locator("#certifications")).toHaveValue(
    "Automation certificate · Example issuer · 2026",
  );
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const path = (await (await downloaded).path())!;
  expect((await readFile(path)).subarray(0, 4).toString()).toBe("%PDF");
  const text = execFileSync("pdftotext", [path, "-"], { encoding: "utf8" });
  expect(text).toContain("EDUCATION");
  expect(text).toContain("PROFESSIONAL SUMMARY");
  expect(text.indexOf("EDUCATION")).toBeLessThan(
    text.indexOf("PROFESSIONAL SUMMARY"),
  );
  expect(text).toContain("Automation certificate");
  expect(text).toContain("Created a reusable test reporting tool");
  expect(text).toContain("example.com/work");
  await page.screenshot({
    path: "/tmp/resume-studio-updated-desktop.png",
    fullPage: false,
    animations: "disabled",
  });
});
test("phone editing, safe links, checklist feedback and print show only the current document", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin?demo=1");
  await page.locator("#website").fill("javascript:alert(1)");
  await page
    .getByRole("button", { name: "Save privately", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText("website");
  await expect(
    page.locator('.resume-preview a[href^="javascript:"]'),
  ).toHaveCount(0);
  await page.locator("#website").fill("https://example.com");
  await page.locator("#skills").fill("Java, Selenium, SQL,");
  await page
    .getByRole("button", { name: "Save privately", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText(
    "Saved in this demo session",
  );
  await page
    .getByRole("navigation", { name: "Resume fields" })
    .getByRole("button", { name: "Extras", exact: true })
    .click();
  await expect(page.locator("#certifications")).toBeFocused();
  await page.locator("#certifications").fill("Browser automation training");
  await page
    .getByRole("button", { name: "Preview resume", exact: true })
    .click();
  await expect(page.locator(".resume-preview")).toContainText(
    "Browser automation training",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await page.screenshot({
    path: "/tmp/resume-studio-updated-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.didPrint = "yes";
    };
  });
  await page
    .getByRole("button", { name: "Print current resume", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-did-print", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".studio-versions")).toBeHidden();
  await expect(page.locator(".studio-fields")).toBeHidden();
  await expect(page.locator(".studio-actionbar")).toBeHidden();
  await expect(page.locator(".resume-preview")).toBeVisible();
});
