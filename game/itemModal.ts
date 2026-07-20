/* ================= generic item preview modal =================
 * Opens when a shop card (Skins now; Trails/Auras reuse this later) is
 * tapped. Knows nothing about what the item actually IS — the caller
 * supplies a name/price/owned/equipped snapshot, a mountPreview() that
 * renders whatever preview makes sense for that item kind (a live
 * in-game cube render for skins), and buy/equip callbacks that own the
 * actual purchase/equip logic (and are responsible for closing the modal
 * once done, via closeItemModal()).
 */

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export interface ItemModalItem {
  name: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  /** Mounts a live preview into `container`; returns a cleanup fn run on close. */
  mountPreview: (container: HTMLElement) => () => void;
  /** Only invoked when owned=false and coins >= price (button is disabled otherwise). */
  onBuy: () => void;
  /** Only invoked when owned=true and equipped=false. */
  onEquip: () => void;
}

let current: ItemModalItem | null = null;
let unmountPreview: (() => void) | null = null;
let lastFocused: HTMLElement | null = null;

function renderState(coins: number) {
  const item = current;
  if (!item) return;
  $("item-modal-name").textContent = item.name;
  const priceEl = $("item-modal-price");
  const actionEl = $("item-modal-action") as HTMLButtonElement;
  actionEl.classList.remove("locked", "danger");
  actionEl.disabled = false;

  if (item.equipped) {
    priceEl.innerHTML = `<span class="skin-state equipped">✓ EQUIPPED</span>`;
    actionEl.textContent = "✓ EQUIPPED";
    actionEl.disabled = true;
    actionEl.classList.add("locked");
  } else if (item.owned) {
    priceEl.innerHTML = `<span class="skin-state owned">OWNED</span>`;
    actionEl.textContent = "EQUIP";
  } else if (coins >= item.price) {
    priceEl.innerHTML = `<span class="skin-state price"><span class="coin-disc small"></span>${item.price}</span>`;
    actionEl.textContent = `BUY — ${item.price}`;
  } else {
    const need = item.price - coins;
    priceEl.innerHTML = `<span class="skin-state price locked"><span class="coin-disc small"></span>${item.price}</span>`;
    actionEl.textContent = `NEED ${need.toLocaleString()} MORE`;
    actionEl.disabled = true;
    actionEl.classList.add("locked");
  }
}

/** Opens the modal for `item`. `coins` is the player's current wallet —
 *  a fresh snapshot each open, used only to decide the action button's state. */
export function openItemModal(item: ItemModalItem, coins: number) {
  current = item;
  lastFocused = (document.activeElement as HTMLElement) ?? null;
  renderState(coins);

  // unhide first: mountPreview() reads the container's layout size on its
  // first frame, which is 0×0 while the modal is still display:none
  $("item-modal").classList.remove("hidden");

  const preview = $("item-modal-preview");
  preview.innerHTML = "";
  unmountPreview = item.mountPreview(preview);

  $("item-modal-close").focus();
}

export function closeItemModal() {
  if (!current) return;
  unmountPreview?.();
  unmountPreview = null;
  current = null;
  $("item-modal").classList.add("hidden");
  $("item-modal-preview").innerHTML = "";
  lastFocused?.focus();
  lastFocused = null;
}

function onAction() {
  const item = current;
  if (!item || item.equipped) return;
  if (item.owned) item.onEquip();
  else item.onBuy();
}

/** Wires close (backdrop/✕/Escape) and the action button. Call once at boot. */
export function initItemModal(): () => void {
  const modal = $("item-modal");
  const onBackdrop = (e: MouseEvent) => {
    if (e.target === modal) closeItemModal();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeItemModal();
  };
  modal.addEventListener("click", onBackdrop);
  $("item-modal-close").addEventListener("click", closeItemModal);
  $("item-modal-action").addEventListener("click", onAction);
  document.addEventListener("keydown", onKey);

  return () => {
    modal.removeEventListener("click", onBackdrop);
    $("item-modal-close").removeEventListener("click", closeItemModal);
    $("item-modal-action").removeEventListener("click", onAction);
    document.removeEventListener("keydown", onKey);
  };
}
