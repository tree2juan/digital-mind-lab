// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * E2E smoke tests for the static site (no Azure Functions API dependency —
 * those checkpoint-grading flows are covered by manual verification against
 * a local `func start` + SWA CLI instance; see docs/test-validation-report.md
 * for what was run and its results). This config only needs a plain static
 * file server for index.html.
 */
module.exports = defineConfig({
  testDir: "./tests/e2e",
  // Python's http.server (used for `webServer` below, to avoid adding a
  // static-server dependency) is single-threaded and cannot reliably serve
  // Playwright's default parallel workers — serialize instead. The suite is
  // small (seconds, not minutes), so this has no real cost.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4813",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python -m http.server 4813",
    url: "http://127.0.0.1:4813/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
