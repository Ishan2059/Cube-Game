import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`game, rankings and reset at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    // Browser checks isolate rendering/flows; real API semantics are tested
    // independently against Redis, without production credentials.
    await page.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/session") return route.fulfill({json:{pid:"browser-player"}});
      if (url.pathname === "/api/run") return route.fulfill({json:{runId:"browser-run",pid:"browser-player",mode:"normal",expiresAt:Date.now()+86400000}});
      if (url.pathname === "/api/me") return route.fulfill({json:{streak:0,atRisk:false}});
      if (url.pathname === "/api/reset") return route.fulfill({json:{ok:true}});
      return route.fulfill({json:{top10:[],neighbors:[],me:null,myRank:null,total:0,mode:url.searchParams.get("mode")||"normal"}});
    });
    await page.goto("/");
    await expect(page.locator("#start-screen")).toBeVisible();
    await page.locator("#board-btn").click();
    await page.locator("#board-mode").selectOption("casual");
    await expect(page.locator("#leaderboard")).toContainText("CASUAL");
    await page.locator("#board-close").click();
    await page.locator("#start-btn").click();
    // Startup builds the exploration scene after obtaining the run ticket.
    // Software WebGL on CI can spend over five seconds on that first frame.
    await expect(page.locator("#start-screen")).toBeHidden({ timeout: 30000 });
    await page.keyboard.press("ArrowRight");
    await page.locator("#pause-btn").click();
    await expect(page.locator("#pause-screen")).toBeVisible();
    await page.locator("#pause-menu").click();
    await page.locator("#settings-btn").click();
    await page.evaluate(()=>localStorage.setItem("crush-best","300000"));
    await page.locator("#reset-progress").click();
    await Promise.all([
      page.waitForEvent("load"),
      page.locator("#reset-progress").click(),
    ]);
    await expect(page.locator("#start-screen")).toBeVisible();
    await expect(page.locator("#menu-best")).toHaveText("0");
    expect(await page.evaluate(()=>localStorage.getItem("crush-best"))).toBeNull();
    expect(errors).toEqual([]);
  });
}
