/* ================= out-of-game menu screens =================
 * Owns the DOM screens around the run: Start, Guide, Shop, Settings, plus
 * the pause-menu quick toggles and toasts. The engine calls initMenus() once
 * at boot; navigation between these screens self-wires. Markup/styling
 * follows the UI kit in docs/CubeCrush UI.html.
 *
 * Leaderboard ("RANKS") is intentionally a stub — that feature is being
 * built separately. The buttons exist (design hooks) but only show a toast.
 * Skins/Trails/Auras all share one shop grid (#skin-list) and buy/equip
 * flow — renderShop() swaps its contents based on the active tab.
 */

import {
  getBest,
  getCoins,
  spendCoins,
  getOwnedSkins,
  ownSkin,
  getEquippedSkin,
  setEquippedSkin,
  getOwnedTrails,
  ownTrail,
  getEquippedTrail,
  setEquippedTrail,
  getOwnedAuras,
  ownAura,
  getEquippedAura,
  setEquippedAura,
  getSettings,
  patchSettings,
  type Settings,
} from "./storage";
import { SKINS, skinById, mountSkinPreview, getSkinThumbnail, type SkinDef } from "./skins";
import { TRAILS, mountTrailPreview, type TrailDef } from "./trails";
import { AURAS, mountAuraPreview, type AuraDef } from "./auras";
import { BEASTS, getBugThumbs } from "./bestiary";
import { setMuted, playCoin, audio } from "./audio";
import { openItemModal, closeItemModal, initItemModal, type ItemModalItem } from "./itemModal";

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
  // the hero cube on the Start screen previews the equipped skin, as a
  // snapshot of the real cube mesh — see getSkinThumbnail
  const sk = skinById(getEquippedSkin());
  $("hero-cube").style.background = `url(${getSkinThumbnail(sk.id)}) center / contain no-repeat`;
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
type ShopTab = "skins" | "trails" | "auras";
let shopTab: ShopTab = "skins";

function shopCardHTML(
  id: string,
  name: string,
  price: number,
  isOwned: boolean,
  isEquipped: boolean,
  coins: number,
  swatch: string,
) {
  const state = isEquipped
    ? `<span class="skin-state equipped">✓ EQUIPPED</span>`
    : isOwned
      ? `<span class="skin-state owned">OWNED</span>`
      : `<span class="skin-state price${coins < price ? " locked" : ""}"><span class="coin-disc small"></span>${price}</span>`;
  return `
    <button class="skin-card${isEquipped ? " equipped" : ""}" data-item="${id}" aria-label="Preview ${name}">
      <span class="skin-preview"><span class="skin-cube" style="background:${swatch}"></span></span>
      <span class="skin-name">${name}</span>
      ${state}
    </button>`;
}

const SHOP_HINTS: Record<ShopTab, string> = {
  skins: "Earn coins by crushing parasites. Skins are cosmetic — pure drip.",
  trails: "A fading streak that follows the cube while it's rolling.",
  auras: "A soft glow that pulses around the cube at all times.",
};

function renderShop() {
  $("tab-skins").classList.toggle("active", shopTab === "skins");
  $("tab-trails").classList.toggle("active", shopTab === "trails");
  $("tab-auras").classList.toggle("active", shopTab === "auras");
  $("shop-hint").textContent = SHOP_HINTS[shopTab];

  const list = $("skin-list");
  const coins = getCoins();
  if (shopTab === "skins") {
    const owned = getOwnedSkins();
    const equipped = getEquippedSkin();
    list.innerHTML = SKINS.map((sk) =>
      shopCardHTML(
        sk.id,
        sk.name,
        sk.price,
        owned.includes(sk.id),
        equipped === sk.id,
        coins,
        `url(${getSkinThumbnail(sk.id)}) center / contain no-repeat`,
      ),
    ).join("");
  } else if (shopTab === "trails") {
    const owned = getOwnedTrails();
    const equipped = getEquippedTrail();
    list.innerHTML = TRAILS.map((t) =>
      shopCardHTML(t.id, t.name, t.price, owned.includes(t.id), equipped === t.id, coins, t.previewSwatch),
    ).join("");
  } else {
    const owned = getOwnedAuras();
    const equipped = getEquippedAura();
    list.innerHTML = AURAS.map((a) =>
      shopCardHTML(a.id, a.name, a.price, owned.includes(a.id), equipped === a.id, coins, a.previewSwatch),
    ).join("");
  }
}

function switchShopTab(tab: ShopTab) {
  if (shopTab === tab) return;
  shopTab = tab;
  renderShop();
}

/** Builds the generic modal's view of a skin: current owned/equipped
 *  snapshot, its live preview, and the buy/equip actions that actually
 *  touch storage — the modal itself never spends coins or equips. */
function buildSkinItem(sk: SkinDef): ItemModalItem {
  const afterChange = () => {
    renderShop();
    updateMenuStats();
    // the engine listens and restyles the live cube immediately
    window.dispatchEvent(new CustomEvent("crush:skin"));
  };
  return {
    name: sk.name,
    price: sk.price,
    owned: getOwnedSkins().includes(sk.id),
    equipped: getEquippedSkin() === sk.id,
    mountPreview: (el) => mountSkinPreview(el, sk),
    onBuy: () => {
      if (!spendCoins(sk.price)) {
        toast(`Not enough coins — need 🪙 ${sk.price}`);
        return;
      }
      ownSkin(sk.id);
      setEquippedSkin(sk.id);
      playCoin();
      toast(`${sk.name} unlocked & equipped!`);
      afterChange();
      closeItemModal();
    },
    onEquip: () => {
      setEquippedSkin(sk.id);
      toast(`${sk.name} equipped`);
      afterChange();
      closeItemModal();
    },
  };
}

/** Same contract as buildSkinItem — Trails equip alongside a skin, not in
 *  place of one, so "equipped" here only ever compares trail ids. */
function buildTrailItem(t: TrailDef): ItemModalItem {
  const afterChange = () => {
    renderShop();
    updateMenuStats();
    window.dispatchEvent(new CustomEvent("crush:trail"));
  };
  return {
    name: t.name,
    price: t.price,
    owned: getOwnedTrails().includes(t.id),
    equipped: getEquippedTrail() === t.id,
    mountPreview: (el) => mountTrailPreview(el, t),
    onBuy: () => {
      if (!spendCoins(t.price)) {
        toast(`Not enough coins — need 🪙 ${t.price}`);
        return;
      }
      ownTrail(t.id);
      setEquippedTrail(t.id);
      playCoin();
      toast(`${t.name} trail unlocked & equipped!`);
      afterChange();
      closeItemModal();
    },
    onEquip: () => {
      setEquippedTrail(t.id);
      toast(t.id === "none" ? "Trail off" : `${t.name} trail equipped`);
      afterChange();
      closeItemModal();
    },
  };
}

function buildAuraItem(a: AuraDef): ItemModalItem {
  const afterChange = () => {
    renderShop();
    updateMenuStats();
    window.dispatchEvent(new CustomEvent("crush:aura"));
  };
  return {
    name: a.name,
    price: a.price,
    owned: getOwnedAuras().includes(a.id),
    equipped: getEquippedAura() === a.id,
    mountPreview: (el) => mountAuraPreview(el, a),
    onBuy: () => {
      if (!spendCoins(a.price)) {
        toast(`Not enough coins — need 🪙 ${a.price}`);
        return;
      }
      ownAura(a.id);
      setEquippedAura(a.id);
      playCoin();
      toast(`${a.name} aura unlocked & equipped!`);
      afterChange();
      closeItemModal();
    },
    onEquip: () => {
      setEquippedAura(a.id);
      toast(a.id === "none" ? "Aura off" : `${a.name} aura equipped`);
      afterChange();
      closeItemModal();
    },
  };
}

function onShopClick(e: Event) {
  const btn = (e.target as HTMLElement).closest<HTMLElement>(".skin-card");
  const id = btn?.dataset.item;
  if (!id) return;
  audio(); // user gesture — safe moment to unlock the AudioContext
  if (shopTab === "skins") {
    const sk = SKINS.find((s) => s.id === id);
    if (sk) openItemModal(buildSkinItem(sk), getCoins());
  } else if (shopTab === "trails") {
    const t = TRAILS.find((x) => x.id === id);
    if (t) openItemModal(buildTrailItem(t), getCoins());
  } else {
    const a = AURAS.find((x) => x.id === id);
    if (a) openItemModal(buildAuraItem(a), getCoins());
  }
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
    shopTab = "skins"; // every fresh visit from the menu starts on Skins
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

  on("tab-skins", () => switchShopTab("skins"));
  on("tab-trails", () => switchShopTab("trails"));
  on("tab-auras", () => switchShopTab("auras"));
  on("skin-list", onShopClick);

  on("set-sound", () => toggleSetting((s) => ({ sound: !s.sound })));
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
    window.dispatchEvent(new CustomEvent("crush:trail"));
    window.dispatchEvent(new CustomEvent("crush:aura"));
    toast("Progress wiped. Fresh cube.");
  });

  const disposeItemModal = initItemModal();

  applySettingsEffects(getSettings());
  syncSettingsUI();
  updateMenuStats();

  return () => {
    clearTimeout(resetTimer);
    for (const [el, ev, fn] of handlers) el.removeEventListener(ev, fn);
    disposeItemModal();
  };
}
