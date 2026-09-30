import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  use: {
    baseURL: "http://127.0.0.1:4321",
    // The spin reel settles instantly under reduced motion — fast, stable E2E.
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    launchOptions: {
      // PLAYWRIGHT_CHROME_PATH=/opt/meta-chromium/chrome on this VM.
      // Unset → Playwright's bundled Chromium (`npx playwright install chromium`).
      ...(process.env.PLAYWRIGHT_CHROME_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
        : {}),
      args: [
        "--no-sandbox",
        "--no-proxy-server",
        "--disable-features=LocalNetworkAccessChecks",
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // --ignore-lock: Astro 7 refuses a second dev server while one is already
    // running (e.g. your own on another port); this one is test-only.
    command: "npm run dev -- --port 4321 --host 127.0.0.1 --ignore-lock",
    // Under an AI agent Astro forces background mode, which --ignore-lock
    // rejects. This variable (set by Astro for its own background child)
    // skips that detection so the server stays in the foreground.
    // BM11_E2E hides the dev toolbar (astro.config.mjs).
    env: { ASTRO_DEV_BACKGROUND: "1", BM11_E2E: "1" },
    url: "http://127.0.0.1:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
