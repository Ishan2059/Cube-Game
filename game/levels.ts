import type { ParasiteType } from "./parasites";

/* ================= levels =================
* Reaching `at` points enters the level: swaps the cube skin, ramps parasite
* speed, and shifts the spawn mix (weights are relative, normalised at spawn).
 *
 * Difficulty is driven by two rating fields that ramp in two phases:
 *   stick (0..1) — how aggressively parasites seek & cling to the cube.
 *                  Ramps across L1–L10 (0.15 → 1.0), then capped.
 *                  - scales down the spider/scorpion sidestep wander
 *                  - gives a chance to latch from an orthogonally-adjacent tile
 *                    instead of stepping onto the cube (feels "clingy").
 *   bite (×)     — health-depletion multiplier per bite (and shortens the bite
 *                  interval so bites land more often too). Held at 1× through
 *                  L10, then ramps across L11–L20 (1.0 → 2.5).
 *   armor        — extra crushes a beetle survives (first roll cracks its
 *                  shell and stuns it, the next one kills). Kicks in at ONYX.
 *   swarm (×)    — spawn-rate & max-population multiplier. Third difficulty
 *                  phase: ramps across L16–L20 so late game stays frantic.
 *
* Add a level = one row. */
export interface Level {
at: number; // score needed to enter
name: string;
skin: number; // cube colour
emissive?: number; // optional cube glow
speed: number; // parasite speed multiplier
  stick: number; // 0..1 clinginess (ramps L1–L10)
  bite: number; // bite damage × + bite-rate (ramps L11–L20)
  armor?: number; // extra beetle hits (default 0)
  swarm?: number; // spawn multiplier (default 1)
weights: Partial<Record<ParasiteType, number>>;
}

export const LEVELS: Level[] = [
{
at: 0,
name: "SPROUT",
skin: 0xf0e8d8,
speed: 1.0,
    stick: 0.15,
    bite: 1.0,
weights: { worm: 6, bug: 3, spider: 1 },
},
{
at: 500,
name: "GRUB",
skin: 0x8fbf6a,
speed: 1.15,
    stick: 0.24,
    bite: 1.0,
weights: { worm: 4, bug: 4, spider: 2, slug: 1 },
},
{
at: 1200,
name: "HARDENED",
skin: 0xe0b64e,
speed: 1.3,
    stick: 0.34,
    bite: 1.0,
weights: { worm: 3, bug: 4, spider: 3, scorpion: 1, slug: 1, flea: 1 },
},
{
at: 2200,
name: "IRON",
skin: 0x9aa0a6,
speed: 1.5,
    stick: 0.43,
    bite: 1.0,
weights: { worm: 2, bug: 3, spider: 4, scorpion: 2, beetle: 1, flea: 1, hornet: 1 },
},
{
at: 3600,
name: "OBSIDIAN",
skin: 0x3c2a4e,
speed: 1.7,
    stick: 0.53,
    bite: 1.0,
weights: { bug: 2, spider: 4, scorpion: 3, beetle: 2, hornet: 1, pillbug: 1, slug: 1 },
},
{
at: 5500,
name: "MOLTEN",
skin: 0xe05a6e,
emissive: 0x5a1420,
speed: 2.0,
    stick: 0.62,
    bite: 1.0,
weights: { spider: 3, scorpion: 4, beetle: 3, hornet: 1, mosquito: 2, termite: 1, pillbug: 1 },
},
  {
    at: 8000,
    name: "FORGED",
    skin: 0xb8421e,
    emissive: 0x3a1008,
    speed: 2.15,
    stick: 0.72,
    bite: 1.0,
    weights: { spider: 3, scorpion: 4, beetle: 4, hornet: 2, mosquito: 2, locust: 1, termite: 1 },
  },
  {
    at: 11000,
    name: "CHARCOAL",
    skin: 0x3a3a3a,
    speed: 2.3,
    stick: 0.81,
    bite: 1.0,
    weights: { spider: 2, scorpion: 4, beetle: 5, hornet: 2, mosquito: 2, pillbug: 2, termite: 2, locust: 1 },
  },
  {
    at: 15000,
    name: "BRONZE",
    skin: 0xb87333,
    speed: 2.45,
    stick: 0.91,
    bite: 1.0,
    weights: { spider: 2, scorpion: 3, beetle: 5, hornet: 2, mosquito: 3, pillbug: 2, termite: 2, locust: 2, eggsac: 1, flea: 1 },
  },
  {
    at: 20000,
    name: "GRANITE",
    skin: 0x6b6358,
    speed: 2.6,
    stick: 1.0,
    bite: 1.0,
    weights: { spider: 2, scorpion: 3, beetle: 6, hornet: 2, mosquito: 3, pillbug: 2, termite: 2, locust: 2, eggsac: 1, flea: 1, slug: 1 },
  },
  // —— bite phase: stick is maxed; each bite drains more and lands sooner ——
  {
    at: 27000,
    name: "COBALT",
    skin: 0x2b4a8a,
    emissive: 0x0a1a3a,
    speed: 2.75,
    stick: 1.0,
    bite: 1.15,
    weights: { scorpion: 3, beetle: 6, spider: 1, hornet: 3, mosquito: 3, pillbug: 2, termite: 2, locust: 2, eggsac: 1 },
  },
  {
    at: 35000,
    name: "JADE",
    skin: 0x3a8a5e,
    speed: 2.9,
    stick: 1.0,
    bite: 1.3,
    weights: { scorpion: 3, beetle: 7, hornet: 3, mosquito: 3, pillbug: 2, termite: 3, locust: 3, eggsac: 2 },
  },
  {
    at: 45000,
    name: "CRIMSON",
    skin: 0x8a1a2a,
    emissive: 0x300810,
    speed: 3.05,
    stick: 1.0,
    bite: 1.5,
    weights: { scorpion: 2, beetle: 8, hornet: 3, mosquito: 4, pillbug: 3, termite: 3, locust: 3, eggsac: 2 },
  },
  {
    at: 57000,
    name: "VIOLET",
    skin: 0x6a2a8a,
    emissive: 0x1a0a30,
    speed: 3.2,
    stick: 1.0,
    bite: 1.7,
    weights: { scorpion: 2, beetle: 8, hornet: 3, mosquito: 4, pillbug: 3, termite: 3, locust: 3, eggsac: 2, flea: 2 },
  },
  {
    at: 72000,
    name: "ONYX",
    skin: 0x1a1a22,
    emissive: 0x2e2e46, // brighter glow: dark skin must still read against the soil
    speed: 3.35,
    stick: 1.0,
    bite: 1.85,
    armor: 1,
    weights: { scorpion: 2, beetle: 9, hornet: 4, mosquito: 4, pillbug: 3, termite: 4, locust: 4, eggsac: 3 },
  },
  {
    at: 90000,
    name: "AMBER",
    skin: 0xd4901a,
    emissive: 0x3a2408,
    speed: 3.5,
    stick: 1.0,
    bite: 2.0,
    armor: 1,
    swarm: 1.15,
    weights: { scorpion: 2, beetle: 9, hornet: 4, mosquito: 5, pillbug: 3, termite: 4, locust: 4, eggsac: 3 },
  },
  {
    at: 110000,
    name: "EMERALD",
    skin: 0x1a8a4a,
    emissive: 0x0a3a1a,
    speed: 3.65,
    stick: 1.0,
    bite: 2.15,
    armor: 1,
    swarm: 1.3,
    weights: { scorpion: 2, beetle: 10, hornet: 4, mosquito: 5, pillbug: 4, termite: 4, locust: 5, eggsac: 3 },
  },
  {
    at: 135000,
    name: "SAPPHIRE",
    skin: 0x1a4ad4,
    emissive: 0x0a1a5a,
    speed: 3.8,
    stick: 1.0,
    bite: 2.3,
    armor: 1,
    swarm: 1.45,
    weights: { scorpion: 1, beetle: 10, hornet: 5, mosquito: 5, pillbug: 4, termite: 5, locust: 5, eggsac: 4 },
  },
  {
    at: 165000,
    name: "PHANTOM",
    skin: 0x4a1a5a,
    emissive: 0x2a0a3a,
    speed: 3.95,
    stick: 1.0,
    bite: 2.4,
    armor: 1,
    swarm: 1.6,
    weights: { scorpion: 1, beetle: 11, hornet: 5, mosquito: 6, pillbug: 4, termite: 5, locust: 6, eggsac: 4 },
  },
  {
    at: 200000,
    name: "VOID",
    skin: 0x0a0a14,
    emissive: 0x3d2160, // brighter glow: near-black skin needs it to stay visible
    speed: 4.1,
    stick: 1.0,
    bite: 2.5,
    armor: 1,
    swarm: 1.8,
    weights: { beetle: 12, scorpion: 2, hornet: 6, mosquito: 6, pillbug: 5, termite: 6, locust: 6, eggsac: 5 },
  },
];