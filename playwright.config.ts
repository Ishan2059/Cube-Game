import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "test/browser",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3118", channel: process.env.PLAYWRIGHT_CHANNEL, trace: "retain-on-failure", launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } },
  webServer: { command: "npm run dev -- --hostname 127.0.0.1 --port 3118", url: "http://127.0.0.1:3118", reuseExistingServer: !process.env.CI, timeout: 120000 },
});
