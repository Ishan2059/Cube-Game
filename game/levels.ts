import type { ParasiteType } from "./parasites";

/* ================= levels =================
 * Reaching `at` points enters the level: swaps the cube skin, ramps parasite
 * speed, and shifts the spawn mix (weights are relative, normalised at spawn).
 * Add a level = one row. */
export interface Level {
  at: number; // score needed to enter
  name: string;
  skin: number; // cube colour
  emissive?: number; // optional cube glow
  speed: number; // parasite speed multiplier
  weights: Partial<Record<ParasiteType, number>>;
}

export const LEVELS: Level[] = [
  {
    at: 0,
    name: "SPROUT",
    skin: 0xf0e8d8,
    speed: 1.0,
    weights: { worm: 6, bug: 3, spider: 1 },
  },
  {
    at: 500,
    name: "GRUB",
    skin: 0x8fbf6a,
    speed: 1.15,
    weights: { worm: 4, bug: 4, spider: 2 },
  },
  {
    at: 1000,
    name: "HARDENED",
    skin: 0xe0b64e,
    speed: 1.3,
    weights: { worm: 3, bug: 4, spider: 3, scorpion: 1 },
  },
  {
    at: 1500,
    name: "IRON",
    skin: 0x9aa0a6,
    speed: 1.5,
    weights: { worm: 2, bug: 3, spider: 4, scorpion: 2, beetle: 1 },
  },
  {
    at: 2000,
    name: "OBSIDIAN",
    skin: 0x3c2a4e,
    speed: 1.7,
    weights: { bug: 2, spider: 4, scorpion: 3, beetle: 2 },
  },
  {
    at: 2500,
    name: "MOLTEN",
    skin: 0xe05a6e,
    emissive: 0x5a1420,
    speed: 2.0,
    weights: { spider: 3, scorpion: 4, beetle: 3 },
  },
];
