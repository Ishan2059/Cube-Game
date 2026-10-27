# Exploration revamp

Current scope, 2026-10-27. Later requests supersede the earlier mutation and photoreal terrain directions.

## Gameplay

- Original grass/grid retained, with restrained dry soil variation and fine surface grain. Procedural road, wood, mud and ash materials use the same restrained tile detail. Stylized teal water has animated highlights and contact ripples, not expensive live scene reflections.
- One rare outdoor hell gate at (96, -72), with its corresponding return gate in hell. No repeated nearby portals. Roads and bridges cross the infinite deterministic terrain at irregular offsets with gently curved, differently phased paths in selected 64-tile regions. Only selected intersections have houses. Bush patches use sparse 13-tile regions; they no longer fill every clearing.
- Random obstacle density halved (.065 to .0325). Giant mode breaks all five obstacle props with pooled bouncing fragments, dust and wood/stone/metal audio. Structural house walls and map boundaries remain solid.
- Jump with Space or the new on-screen jump button. Horizontal range follows accumulated movement speed and snaps to valid tile landings; speed boosts extend it. A stationary jump is a small hop. Bridge rails and house walls remain boundaries.
- Six bugs spawn at the start, within a 5?8 tile ring. Spawns continue every roughly 1.1 seconds initially and accelerate. Population grows from 12 to 32; egg broods share the hard cap. Unlocks and swarm pressure depend on elapsed time, without levels or cube color changes.
- Loose coins: one in selected 5?5 cells (12%), at most one visible coin per three active bugs, capped at four. No loose coins in cabins/water/lava. Chests are separate rare discoveries (32% of 48?48 regions), repositioned onto safe accessible terrain.
- Cabin loot is seeded per house and run: varied coin amounts, occasional healing, and a varied or absent power-up. Revisiting does not refill loot. Cabin transitions fade to black, with black surroundings outside the playable wooden room.
- Coin multiplier lasts 12 seconds and displays its remaining duration. Coins are credited once, immediately, including kills and chest rewards.
- Bush patches cover a full 3?3 area. The cube and trail are completely hidden while inside, attached insects drop off, and enemies search the last visible location. Wind/contact bending and damped recoil run in one instanced draw.
- Insects cannot enter water. The cube must return to land before entering a bridge at its end; it cannot climb from water through the railing.
- Hell has demon-styled creatures and damaging lava. Dying there returns to the normal world, keeps earned loot, and locks the gate for four hours, persisted locally across reloads.

## Visuals and sound

- Ten skin materials and ten trail styles, plus the original defaults. Cosmetic previews and thumbnails are rendered from the gameplay factories. Skin/trail prices are restored; the temporary preview unlock in `game/cosmetic-access.ts` is disabled. Stored purchases and coins remain intact.
- Trails use reference-derived ribbon and particle maps, wavy motion, style-specific drift/gravity and fading terrain traces. Trail residue has a separate, stationary texture transform.
- Fourteen articulated insect models with matching reference palettes and recognizable bodies, eyes, shells and appendages. Each creature uses one skinned draw. Models interpret the reference renders in 3D; they are not pixel-identical copies of those images.
- Falling entrance, squash/settle, impact and expanding dust. Existing menus and ranking flows remain, with only the jump control and gameplay readouts added.
- Terrain-specific foley is quieter than reward/impact cues. Movement sounds share one exclusive channel. Water entry cancels dry movement tails and pending loads at takeoff; replacement sounds start only after the previous channel fades out. Water exit uses a single exit splash, not a second grass layer. No generic cube-roll thump is used during ordinary movement.
- Door, chest, portal, bush, splash, lava, jump, destruction and loot sounds; quiet realm ambience. Original synthesis sources are in `Audio/tools`, with OGG and WAV runtime copies. Audio is capped at 12 voices, 64 decoded buffers and four concurrent loads.
- Auras and mutations removed from runtime.

## Rendering and provenance

Nearby content streams around the cube. Grass, pebbles, coins, bushes and debris are instanced. Insect shadow casters are capped at eight; pose updates slow for distant bugs; unused creature pools are bounded per type/realm. This limits workload but does not guarantee a particular frame rate on every device.

Approved source portraits: `design-assets/unified-v1` and `design-assets/creatures`. Runtime material provenance: `design-assets/runtime-materials/manifest.json` and `design-assets/exploration/trail-uv.json`. Earlier generated realistic terrain/foliage masters remain archived, but are no longer loaded by the game. `game/world-materials.ts` generates the current stylized world textures.

Rebuild base assets with `node scripts/prepare-game-assets.cjs`; generate exploration audio with `python Audio/tools/build_exploration.py` after installing `Audio/tools/requirements.txt`. Regenerate thumbnails with `node scripts/export-cosmetics.cjs` (requires Playwright and an installed browser; `PLAYWRIGHT_CHANNEL` selects it).

## Verification

- `npm test`: scoring/save regressions, models, cosmetic preservation, audio limits and terrain sound routing, world traversal, loot rarity, cover, coin limits, jump range and timed creature unlocks.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run test:browser`: desktop/mobile flows, all cosmetic previews and decoding every OGG variant.
- Local development smoke test: coin collection, momentum jump, giant destruction, water/bridge rejection, cabin entry/loot/revisit, hell entry/death/lockout persistence, invisible bush cover and a 32-insect population. Temporary debug access is removed before the final build.

Real hardware frame-rate testing and a listening pass on the player's own speakers/headphones are still useful; headless software rendering cannot establish those subjective/device-specific results. This change does not include bosses, real-time multiplayer, login redesign or the full earlier roguelite roadmap.
