import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:80",
    viewport: { width: 1440, height: 900 },
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
});