/* Creature field guide. */

import { type ParasiteType } from "./parasites";

export interface BeastInfo {
  type: ParasiteType;
  name: string;
  desc: string;
}

export const BEASTS: BeastInfo[] = [
  { type: "worm", name: "WORM", desc: "Slow crawler. Free points — roll over it." },
  { type: "bug", name: "BUG", desc: "Standard chaser. Beelines for the cube and climbs on." },
  { type: "spider", name: "SPIDER", desc: "Drops silk webs on the ground that slow your rolling." },
  { type: "scorpion", name: "SCORPION", desc: "Its sting poisons you — health drains for a few seconds." },
  { type: "beetle", name: "BEETLE", desc: "Armored. First crush cracks the shell, second one kills." },
  { type: "slug", name: "SLUG", desc: "Trails sticky slime that stalls you mid-roll." },
  { type: "termite", name: "TERMITE", desc: "Digs pits that block your path until they collapse." },
  { type: "hornet", name: "HORNET", desc: "Its bite dazes you — controls invert for a moment." },
  { type: "mosquito", name: "MOSQUITO", desc: "Drains double health when it bites. Squash fast." },
  { type: "pillbug", name: "PILLBUG", desc: "Curls into an armored ball while moving — only crushable when still." },
  { type: "flea", name: "FLEA", desc: "Erratic hopper. Hard to land on — corner it." },
  { type: "locust", name: "LOCUST", desc: "Lunges two tiles straight at you every few seconds." },
  { type: "eggsac", name: "EGG SAC", desc: "Hatches a brood of bugs if you ignore it. Crush on sight." },
  { type: "spitter", name: "SPITTER", desc: "Lobs acid globs from range — keep moving or eat the splat. Close the gap and crush it." },
];

/** Approved portraits; no additional WebGL context for the guide. */
export function getBugThumbs(): Record<string, string> {
  return Object.fromEntries(BEASTS.map(b => [b.type, `/game-art/creatures/${b.type}.webp`]));
}
