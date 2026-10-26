import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "test/browser",
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3118", channel: process.env.PLAYWRIGHT_CHANNEL, trace: "retain-on-failure", launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } },
  webServer: { command: process.env.CI ? "npm run start -- --hostname 127.0.0.1 --port 3118" : "npm run dev -- --hostname 127.0.0.1 --port 3118", url: "http://127.0.0.1:3118", reuseExistingServer: !process.env.CI, timeout: 120000 },
});
