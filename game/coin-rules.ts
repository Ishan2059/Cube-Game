/** Cosmetic currency is independent of leaderboard points. */
export const COIN_BOOST_SECONDS = 12;
export const COIN_MULTIPLIER = 2;
export function coinsForKills(kills: number): number {
  return Math.floor(Math.min(kills, 300) / 5) + Math.floor(Math.max(0, kills - 300) / 10);
}
const hash = (x: number, z: number) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
/** Scarce single coins repeat across the infinite map, including negative tiles. */
export function coinAt(x: number, z: number): boolean {
  if (z === 0 && x === 2) return true;
  if (Math.abs(x) <= 1 && Math.abs(z) <= 1) return false;
  const cx = Math.floor(x / 5), cz = Math.floor(z / 5);
  if (hash(cx + 31, cz - 71) > .12) return false;
  const lx = x - cx * 5, lz = z - cz * 5;
  return hash(cx - 19, cz + 57) < .5
    ? lz === 2 && lx === 2
    : lx === 2 && lz === 2;
}
/** Records each map pickup once per run, even after it leaves the visible region. */
export function createCoinLedger() {
  const collected = new Set<string>();
  let region="meadow";
  return {
    setRegion(value: string) { region=value; },
    has(x: number, z: number) { return collected.has(`${region}:${x},${z}`); },
    collect(x: number, z: number) {
      const key = `${region}:${x},${z}`;
      if (collected.has(key)) return false;
      collected.add(key); return true;
    },
    reset() { collected.clear(); },
  };
}

/** At most one loose coin per three active bugs, with a hard cap of four. */
export function visibleCoinBudget(bugs:number){return Math.min(4,Math.floor(Math.max(0,bugs)/3));}
