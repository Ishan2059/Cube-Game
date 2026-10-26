// Rules shared by the renderer and score validator. Keep score arithmetic here.
export const PARASITES = {
  worm: { points: 10, interval: 1.15, goo: 0x77c04a, name: "worm" },
  bug: { points: 25, interval: 0.62, goo: 0xc46a3a, name: "bug" },
  spider: { points: 40, interval: 0.85, goo: 0x8a5aa8, name: "spider" },
  scorpion: { points: 80, interval: 0.5, goo: 0xc4903a, name: "scorpion" },
  beetle: { points: 120, interval: 0.8, goo: 0x4a8a3a, name: "beetle" },
  slug: { points: 20, interval: 1.45, goo: 0x9ab04a, name: "slug" },
  termite: { points: 35, interval: 0.72, goo: 0xd8c088, name: "termite" },
  hornet: { points: 60, interval: 0.55, goo: 0xd8a83a, name: "hornet" },
  mosquito: { points: 45, interval: 0.42, goo: 0xa83a3a, name: "mosquito" },
  pillbug: { points: 55, interval: 0.8, goo: 0x8a7a6a, name: "pillbug" },
  flea: { points: 35, interval: 0.4, goo: 0x5a3a2a, name: "flea" },
  locust: { points: 70, interval: 0.72, goo: 0x8aa84a, name: "locust" },
  eggsac: { points: 40, interval: 2, goo: 0xd8d0b8, name: "egg sac" },
  spitter: { points: 90, interval: 0.95, goo: 0x7ac05a, name: "spitter" },
} as const;

export type Difficulty = "normal" | "casual";
export const COMBO_WINDOW = 2.5;
export const RAMPAGE_AT = 4;
export const MAX_RUN_SECONDS = 6 * 60 * 60;
export const MAX_RUN_EVENTS = 60_000;
export const RUN_TTL = 7 * 24 * 60 * 60;
export type RunEvent = [timeMs: number, kind: keyof typeof PARASITES | "break"];
export function killPoints(type: keyof typeof PARASITES, combo: number): number {
  return PARASITES[type].points * Math.min(combo, 8) * (combo >= RAMPAGE_AT ? 2 : 1);
}
