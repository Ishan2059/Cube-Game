import { test, expect } from "@playwright/test";
import bank from "../../game/audio-bank.json";

test("paid cosmetics, legacy selection, previews and guide", async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/**",route=>route.fulfill({json:{top10:[],neighbors:[],me:null,streak:0}}));
  await page.addInitScript(()=>{
    if(localStorage.getItem("qa-cosmetics"))return;localStorage.setItem("qa-cosmetics","1");
    localStorage.setItem("crush-coins","30000");
    localStorage.setItem("crush-skins-owned",JSON.stringify(["classic","venom"]));
    localStorage.setItem("crush-skin",JSON.stringify("venom"));
    localStorage.setItem("crush-trails-owned",JSON.stringify(["none","ember"]));
    localStorage.setItem("crush-trail",JSON.stringify("ember"));
  });
  await page.goto("/");
  await expect(page.locator("#hero-skin-label")).toHaveText("MOSSLING");
  await page.locator("#shop-btn").click();
  await expect(page.locator("#tab-auras")).toHaveCount(0);
  await expect(page.locator(".skin-card")).toHaveCount(11);
  await expect(page.locator('[data-item="mossling"]')).toContainText("EQUIPPED");
  const skinIds=await page.locator(".skin-card").evaluateAll(cards=>cards.map(c=>(c as HTMLElement).dataset.item!));
  for(const id of skinIds) {
    await page.locator(`[data-item="${id}"]`).click();
    await expect(page.locator("#item-modal-preview canvas")).toBeVisible();
    if(id==="boba") {
      await expect(page.locator("#item-modal-action")).toContainText("BUY");
      await expect(page.locator("#item-modal-price")).toContainText("600");
      await page.locator("#item-modal-action").click();
      await expect(page.locator("#shop-coins")).toHaveText("29,400");
    } else await page.locator("#item-modal-close").click();
    await expect(page.locator("#item-modal-preview canvas")).toHaveCount(0);
  }
  await page.locator("#tab-trails").click();
  await expect(page.locator(".skin-card")).toHaveCount(11);
  await expect(page.locator('[data-item="afterburn"]')).toContainText("EQUIPPED");
  const trailIds=await page.locator(".skin-card").evaluateAll(cards=>cards.map(c=>(c as HTMLElement).dataset.item!));
  for(const id of trailIds) {
    await page.locator(`[data-item="${id}"]`).click();
    await expect(page.locator("#item-modal-preview canvas")).toBeVisible();
    if(id==="bubble-pop"){
      await expect(page.locator("#item-modal-action")).toContainText("BUY");
      await page.locator("#item-modal-action").click();
      await expect(page.locator("#shop-coins")).toHaveText("28,800");
    }else await page.locator("#item-modal-close").click();
  }
  await page.locator("#shop-back").click();
  await expect(page.locator("#hero-skin-label")).toHaveText("BOBA BUDDY");
  await page.locator("#howto-btn").click();
  await expect(page.locator(".beast img")).toHaveCount(14);
  await expect.poll(()=>page.locator(".beast img").evaluateAll(images=>images.every(i=>(i as HTMLImageElement).naturalWidth>0))).toBe(true);
  await page.locator('[data-beast="spider"]').click();
  await expect(page.locator("#beast-modal")).toBeVisible();
  await page.reload();
  await expect(page.locator("#hero-skin-label")).toHaveText("BOBA BUDDY");
  await page.evaluate(()=>localStorage.setItem("crush-coins","0"));
  await page.locator("#shop-btn").click();await page.locator('[data-item="magma"]').click();
  await expect(page.locator("#item-modal-action")).toBeDisabled();
  await expect(page.locator("#item-modal-price")).toContainText("1600");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("crush-trails-owned")||"[]"))).toContain("bubble-pop");
  expect(errors).toEqual([]);
});

test("every sound cue has a browser-decodable sample", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  const results=await page.evaluate(async entries=>{
    const context=new AudioContext();const failed:string[]=[];
    // Sequential decoding keeps the test's peak memory bounded.
    for(const [id,cue] of entries) {
      for(const stem of cue.files){
        const response=await fetch(stem+".ogg");
        try { const decoded=await context.decodeAudioData(await response.arrayBuffer());if(decoded.length===0) failed.push(id); }
        catch {failed.push(id+":"+stem);}
      }
    }
    await context.close();return failed;
  },Object.entries(bank));
  expect(results).toEqual([]);
});
