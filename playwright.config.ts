import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT || 3118);
export default defineConfig({
  testDir: "test/browser",
  workers: 1,
  timeout: 60000,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: process.env.PLAYWRIGHT_CHANNEL, trace: "retain-on-failure", launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } },
  webServer: { command: `npm run ${process.env.CI ? "start" : "dev"} -- --hostname 127.0.0.1 --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI, timeout: 120000 },
});
