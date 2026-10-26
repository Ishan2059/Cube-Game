/* ================= persistent storage (localStorage) =================
 * Everything the game remembers between sessions lives here: best scores,
 * the coin wallet, cosmetic ownership, and settings. Online rankings and
 * authenticated identity are handled by the server API.
 */

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / private mode — play on without persistence */
  }
}

/* ---------- simple scalars ---------- */
export const getBest = () => Number(localStorage.getItem("crush-best") || 0);
export const setBest = (v: number) =>
  localStorage.setItem("crush-best", String(v));

export const getCoins = () => read<number>("crush-coins", 0);
export const addCoins = (n: number) => {
  const total = getCoins() + n;
  write("crush-coins", total);
  return total;
};
/** Deduct coins if affordable. Returns false (and deducts nothing) if not. */
export const spendCoins = (n: number) => {
  const bal = getCoins();
  if (bal < n) return false;
  write("crush-coins", bal - n);
  return true;
};

/* ---------- skins ---------- */
export const getOwnedSkins = () => {
  const owned = read<string[]>("crush-skins-owned", []);
  return owned.includes("classic") ? owned : ["classic", ...owned];
};
export const ownSkin = (id: string) => {
  const owned = getOwnedSkins();
  if (!owned.includes(id)) write("crush-skins-owned", [...owned, id]);
};
export const getEquippedSkin = () => read<string>("crush-skin", "classic");
export const setEquippedSkin = (id: string) => write("crush-skin", id);

/* ---------- trails & auras ----------
 * Same owned-list / equipped-id shape as skins. "none" is the always-owned,
 * default-equipped id for both — cosmetic layers are opt-in, not forced. */
export const getOwnedTrails = () => {
  const owned = read<string[]>("crush-trails-owned", []);
  return owned.includes("none") ? owned : ["none", ...owned];
};
export const ownTrail = (id: string) => {
  const owned = getOwnedTrails();
  if (!owned.includes(id)) write("crush-trails-owned", [...owned, id]);
};
export const getEquippedTrail = () => read<string>("crush-trail", "none");
export const setEquippedTrail = (id: string) => write("crush-trail", id);

export const getOwnedAuras = () => {
  const owned = read<string[]>("crush-auras-owned", []);
  return owned.includes("none") ? owned : ["none", ...owned];
};
export const ownAura = (id: string) => {
  const owned = getOwnedAuras();
  if (!owned.includes(id)) write("crush-auras-owned", [...owned, id]);
};
export const getEquippedAura = () => read<string>("crush-aura", "none");
export const setEquippedAura = (id: string) => write("crush-aura", id);

/* ---------- settings ---------- */
export type ControlMode = "dpad" | "swipe";
export interface Settings {
  sound: boolean;
  difficulty: "normal" | "casual";
  colorblind: boolean;
  // Touch-only; ignored on desktop (keyboard is always the desktop scheme).
  // Defaults to dpad — see game/device.ts for the touch-capability check
  // that gates whether this ever surfaces in Settings or in-game.
  controlMode: ControlMode;
}
const DEFAULT_SETTINGS: Settings = {
  sound: true,
  difficulty: "normal",
  colorblind: false,
  controlMode: "dpad",
};
export const getSettings = (): Settings => ({
  ...DEFAULT_SETTINGS,
  ...read<Partial<Settings>>("crush-settings", {}),
});
export const patchSettings = (p: Partial<Settings>): Settings => {
  const next = { ...getSettings(), ...p };
  write("crush-settings", next);
  return next;
};
