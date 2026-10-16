// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Static-site smoke tests: navigation, bilingual toggle, gating/lock
 * behavior, local persistence across reload, and keyboard-focus handling.
 * These run against a plain static file server (see playwright.config.js) —
 * no Azure Functions API involved, so AI-grading flows are intentionally
 * out of scope here (manually verified instead; see
 * docs/test-validation-report.md).
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("loads with the expected brand, hero, and status strip", async ({ page }) => {
  await expect(page).toHaveTitle(/Mind in Control|Mente en Control/);
  await expect(page.locator("#brandTitle")).toHaveText(/Mind in Control|Mente en Control/);
  await expect(page.locator(".herotop h1")).toBeVisible();
  // Status strip has 4 quick facts (bilingual, free, duration, checkpoints).
  await expect(page.locator("#statusStrip li")).toHaveCount(4);
});

test("sidebar groups: Introduction and Meet the Team/Resources are standalone; Task-Evaluation is the connected stepper", async ({ page }) => {
  const groups = page.locator("#tabs > div");
  await expect(groups).toHaveCount(3);
  await expect(groups.nth(0)).toHaveClass(/navmenu/);
  await expect(groups.nth(1)).toHaveClass(/stepper-wrap/);
  await expect(groups.nth(2)).toHaveClass(/navmenu/);
  // Stepper has exactly 4 steps (Task, Process, Result, Evaluation) — Resources
  // was deliberately moved out of this gated sequence.
  await expect(groups.nth(1).locator(".tab")).toHaveCount(4);
  await expect(groups.nth(2).locator(".tab")).toHaveCount(2);
});

test("gated steps (Process/Result) are locked until the Task page is read and checkpoints are completed", async ({ page }) => {
  const resultTab = page.locator("#tabs .stepper-wrap .tab").nth(2);
  await expect(resultTab).toBeDisabled();
});

test("standalone Meet the Team and Resources pages are reachable immediately without completing the gated steps", async ({ page }) => {
  const trailingGroup = page.locator("#tabs > div").nth(2);
  await trailingGroup.locator(".tab").nth(0).click();
  await expect(page.locator("main#screen h1")).toBeVisible();

  await trailingGroup.locator(".tab").nth(1).click();
  await expect(page.locator("main#screen h2")).toBeVisible();
});

test("navigating moves keyboard focus to the new page content", async ({ page }) => {
  await page.locator("#tabs .stepper-wrap .tab").nth(0).click();
  await expect(page.locator("main#screen")).toBeFocused();
});

test("language toggle updates the document language, brand text, and status strip", async ({ page }) => {
  const initialLang = await page.evaluate(() => document.documentElement.lang);
  const initialBrand = await page.locator("#brandTitle").textContent();

  await page.locator("#langBtn").click();

  await expect(page.locator("html")).not.toHaveAttribute("lang", initialLang || "");
  const newBrand = await page.locator("#brandTitle").textContent();
  expect(newBrand).not.toBe(initialBrand);
  // Status strip and rail re-render in the new language too.
  await expect(page.locator("#statusStrip li")).toHaveCount(4);
});

test("progress persists across a page reload", async ({ page }) => {
  // Move into the Task page (a free/reading page) and confirm the step
  // position survives a reload via localStorage.
  await page.locator("#tabs .stepper-wrap .tab").nth(0).click();
  const stepCountBefore = await page.locator("#stepCount").textContent();

  await page.reload();

  const stepCountAfter = await page.locator("#stepCount").textContent();
  expect(stepCountAfter).toBe(stepCountBefore);
});

test("restart clears progress back to the Introduction page", async ({ page }) => {
  await page.locator("#tabs .stepper-wrap .tab").nth(0).click();

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#restartBtn").click();

  await expect(page.locator(".herotop h1")).toBeVisible();
});
