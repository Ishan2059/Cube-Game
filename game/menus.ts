/* ================= out-of-game menu screens =================
 * Owns the DOM screens around the run: Start, Guide, Shop, Settings, plus
 * the pause-menu quick toggles and toasts. The engine calls initMenus() once
 * at boot; navigation between these screens self-wires. Markup/styling
 * follows the UI kit in docs/CubeCrush UI.html.
 *
 * Leaderboard ("RANKS") is intentionally a stub — that feature is being
 * built separately. The buttons exist (design hooks) but only show a toast,
 * as do the TRAILS/AURAS shop tabs and D-PAD/TILT control schemes.
 */

import {
  getBest,
  getCoins,
  spendCoins,
  getOwnedSkins,
  ownSkin,
  getEquippedSkin,
  setEquippedSkin,
  getSettings,
  patchSettings,
  type Settings,
} from "./storage";
import { SKINS, skinById } from "./skins";
import { BEASTS, getBugThumbs } from "./bestiary";
import { setMuted, playCoin, audio } from "./audio";

const $ = (id: string) => document.getElementById(id) as HTMLElement;

/* ---------- toast ---------- */
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- stats ---------- */
export function updateMenuStats() {
  $("menu-best").textContent = getBest().toLocaleString();
  const coins = getCoins().toLocaleString();
  $("menu-coins").textContent = coins;
  $("shop-coins").textContent = coins;
  // the hero cube on the Start screen previews the equipped skin
  const sk = skinById(getEquippedSkin());
  $("hero-cube").style.background = sk.previewConic;
  $("hero-skin-label").textContent = sk.name;
}

/* ---------- settings ---------- */
function applySettingsEffects(s: Settings) {
  setMuted(!s.sound);
  document.body.dataset.colorblind = s.colorblind ? "1" : "";
}

function syncSettingsUI() {
  const s = getSettings();
  // pill switches light up via an .on class
  $("set-sound").classList.toggle("on", s.sound);
  $("set-haptics").classList.toggle("on", s.haptics);
  $("set-colorblind").classList.toggle("on", s.colorblind);
  $("set-difficulty")
    .querySelectorAll<HTMLElement>(".seg-opt")
    .forEach((el) =>
      el.classList.toggle("active", el.dataset.v === s.difficulty),
    );
}

function toggleSetting(patch: (s: Settings) => Partial<Settings>) {
  const next = patchSettings(patch(getSettings()));
  applySettingsEffects(next);
  syncSettingsUI();
}

/* ---------- shop ---------- */
function renderShop() {
  const list = $("skin-list");
  const owned = getOwnedSkins();
  const equipped = getEquippedSkin();
  const coins = getCoins();
  list.innerHTML = SKINS.map((sk) => {
    const isOwned = owned.includes(sk.id);
    const isEquipped = equipped === sk.id;
    const act = isEquipped ? "" : isOwned ? "equip" : "buy";
    const state = isEquipped
      ? `<span class="skin-state equipped">✓ EQUIPPED</span>`
      : isOwned
        ? `<span class="skin-state owned">TAP TO EQUIP</span>`
        : `<span class="skin-state price${coins < sk.price ? " locked" : ""}"><span class="coin-disc small"></span>${sk.price}</span>`;
    return `
      <button class="skin-card${isEquipped ? " equipped" : ""}" data-skin="${sk.id}" data-act="${act}">
        <span class="skin-preview"><span class="skin-cube" style="background:${sk.previewConic}"></span></span>
        <span class="skin-name">${sk.name}</span>
        ${state}
      </button>`;
  }).join("");
}

function onShopClick(e: Event) {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".skin-card");
  if (!btn || !btn.dataset.act) return;
  const sk = SKINS.find((s) => s.id === btn.dataset.skin);
  if (!sk) return;
  audio(); // user gesture — safe moment to unlock the AudioContext
  if (btn.dataset.act === "buy") {
    if (!spendCoins(sk.price)) {
      toast(`Not enough coins — need 🪙 ${sk.price}`);
      return;
    }
    ownSkin(sk.id);
    setEquippedSkin(sk.id);
    playCoin();
    toast(`${sk.name} unlocked & equipped!`);
  } else {
    setEquippedSkin(sk.id);
    toast(`${sk.name} equipped`);
  }
  renderShop();
  updateMenuStats();
  // the engine listens and restyles the live cube immediately
  window.dispatchEvent(new CustomEvent("crush:skin"));
}

/* ---------- bestiary (guide screen) ---------- */
// thumbnails come from the real in-game meshes; rendered once, lazily,
// the first time the Guide opens (offscreen WebGL, ~a frame of work)
let bestiaryBuilt = false;
function buildBestiary() {
  if (bestiaryBuilt) return;
  bestiaryBuilt = true;
  const thumbs = getBugThumbs();
  $("bestiary").innerHTML = BEASTS.map(
    (b) => `
    <button class="beast" data-beast="${b.type}">
      <img src="${thumbs[b.type]}" alt="${b.name}" />
      <span>${b.name}</span>
    </button>`,
  ).join("");
}

function onBestiaryClick(e: Event) {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".beast");
  if (!btn) return;
  const beast = BEASTS.find((b) => b.type === btn.dataset.beast);
  if (!beast) return;
  ($("beast-img") as HTMLImageElement).src = getBugThumbs()[beast.type];
  $("beast-title").textContent = beast.name;
  $("beast-desc").textContent = beast.desc;
  $("beast-modal").classList.remove("hidden");
}

function closeBeastModal() {
  $("beast-modal").classList.add("hidden");
}

/* ---------- navigation ---------- */
const MENU_SCREENS = [
  "start-screen",
  "howto-screen",
  "shop-screen",
  "settings-screen",
] as const;

function show(id: (typeof MENU_SCREENS)[number]) {
  fromPause = false; // any full-menu navigation clears the pause overlay path
  for (const s of MENU_SCREENS) $(s).classList.toggle("hidden", s !== id);
  if (id === "start-screen") updateMenuStats();
  if (id === "howto-screen") buildBestiary();
  if (id === "shop-screen") {
    renderShop();
    updateMenuStats();
  }
}

// Settings and the Guide can also open on top of the pause menu mid-run;
// their back buttons must then return to pause, not the start screen.
let fromPause = false;
function openFromPause(id: "settings-screen" | "howto-screen") {
  fromPause = true;
  if (id === "howto-screen") buildBestiary();
  $("pause-screen").classList.add("hidden");
  $(id).classList.remove("hidden");
}
function backFrom(id: "settings-screen" | "howto-screen") {
  if (fromPause) {
    fromPause = false;
    $(id).classList.add("hidden");
    $("pause-screen").classList.remove("hidden");
  } else {
    show("start-screen");
  }
}

/** Return to the Start screen from anywhere (also used by the engine). */
export function showStart() {
  show("start-screen");
}

/* ---------- wiring ---------- */
export function initMenus(): () => void {
  const handlers: Array<[HTMLElement, string, EventListener]> = [];
  const on = (id: string, fn: EventListener, ev = "click") => {
    const el = $(id);
    el.addEventListener(ev, fn);
    handlers.push([el, ev, fn]);
  };
  const soon = () => toast("Coming soon 👀");

  on("howto-btn", () => show("howto-screen"));
  on("shop-btn", () => show("shop-screen"));
  on("settings-btn", () => show("settings-screen"));
  on("top-gear", () => show("settings-screen"));
  on("howto-back", () => backFrom("howto-screen"));
  on("shop-back", () => show("start-screen"));
  on("settings-back", () => backFrom("settings-screen"));
  on("pause-settings", () => openFromPause("settings-screen"));
  on("pause-howto", () => openFromPause("howto-screen"));

  on("bestiary", onBestiaryClick);
  on("beast-close", closeBeastModal);
  on("beast-modal", (e) => {
    if (e.target === $("beast-modal")) closeBeastModal(); // backdrop tap
  });

  // board-btn + gameover-ranks open the leaderboard modal (wired in engine).
  // stubs: trails/auras/d-pad/tilt exist in the design but aren't in this build
  on("tab-trails", soon);
  on("tab-auras", soon);
  on("ctl-dpad", soon);
  on("ctl-tilt", soon);

  on("skin-list", onShopClick);

  on("set-sound", () => toggleSetting((s) => ({ sound: !s.sound })));
  on("set-haptics", () => toggleSetting((s) => ({ haptics: !s.haptics })));
  on("set-difficulty", () =>
    toggleSetting((s) => ({
      difficulty: s.difficulty === "normal" ? "casual" : "normal",
    })),
  );
  on("set-colorblind", () =>
    toggleSetting((s) => ({ colorblind: !s.colorblind })),
  );
  // reset progress: double-tap to confirm, wipes every crush-* key
  let resetArmed = false;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  const RESET_LABEL = "⟲ RESET PROGRESS";
  on("reset-progress", () => {
    const btn = $("reset-progress");
    if (!resetArmed) {
      resetArmed = true;
      btn.textContent = "TAP AGAIN TO CONFIRM";
      btn.classList.add("armed");
      resetTimer = setTimeout(() => {
        resetArmed = false;
        btn.textContent = RESET_LABEL;
        btn.classList.remove("armed");
      }, 3000);
      return;
    }
    clearTimeout(resetTimer);
    resetArmed = false;
    btn.textContent = RESET_LABEL;
    btn.classList.remove("armed");
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("crush-")) localStorage.removeItem(k);
    }
    applySettingsEffects(getSettings());
    syncSettingsUI();
    updateMenuStats();
    window.dispatchEvent(new CustomEvent("crush:skin"));
    toast("Progress wiped. Fresh cube.");
  });

  applySettingsEffects(getSettings());
  syncSettingsUI();
  updateMenuStats();

  return () => {
    clearTimeout(resetTimer);
    for (const [el, ev, fn] of handlers) el.removeEventListener(ev, fn);
  };
}
