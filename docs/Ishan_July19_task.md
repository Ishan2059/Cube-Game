# CubeCrush — UI Integration & Feature Task Plan
**Prepared for:** Fable 5 (execution agent)
**Prepared by:** Ishan
**Date:** July 19, 2026
**Live game:** https://cubecrush.vercel.app

---

## 1. Objective

Integrate a new, already-designed UI (Start screen, Pause menu, and related menu screens) into the live CubeCrush game, and layer in three new product features: **coins**, **3 cube skins**, and **more visible power-ups**. Everything must be **mobile responsive first** — the majority of users are on mobile phones.

The **in-game HUD / actual gameplay screen does not change**. Only the surrounding menu/UI screens (Start, Pause, Game Over, How-to-Play, Shop, Settings) are being replaced/upgraded.

---

## 2. Context

- The current live game (`cubecrush.vercel.app`) has minimal/placeholder UI: a bare Start screen ("CRUSH" title, instructions, "ROLL OUT" button), a simple "PAUSED" overlay with a Resume button, and a simple "OVERRUN" game-over overlay with a restart prompt.
- A full hi-fi UI kit was designed separately in Claude Design (dark subterranean arcade aesthetic, toxic-venom accent color, tactile/pressable buttons, Anton + Space Grotesk + Space Mono fonts). It covers 8 screens:
  - **Mobile:** Start / Home, Pause, Game Over, How-to-Play, Shop / Skins, Settings
  - **Web (secondary):** Start, Pause
- Reference file: `CubeCrush UI.dc.html` — shared via this link:
  `https://claude.ai/design/p/8e5ebaed-cfc8-4aae-b7b2-a901e2df253e?file=CubeCrush+UI.dc.html&via=share`
  - ⚠️ **Important:** This link sits behind Claude.ai login and could not be auto-fetched. Fable 5 (or whoever executes this) will need direct access to the Claude Design project, or Ishan will need to export/screenshot the screens and attach them, before pixel-accurate implementation can start.
  - These were designed from the game's *text/copy only* — not matched pixel-for-pixel to the live game's current visuals. Some visual reconciliation against the live game will be needed during integration.
- Live game's existing copy/microcopy to preserve (do not rewrite unless asked):
  - Title: "CRUSH" / "Roll. Smash. Rampage." / "Parasites climb. You are heavy. Do the math."
  - Start button: "ROLL OUT"
  - Pause: "PAUSED" / "Take a breath. The horde waits." / "RESUME"
  - Game Over: "OVERRUN" / "CRUSH AGAIN (R)"
  - HUD concepts referenced in copy: score, BEST score, LVL + level name (e.g. "SPROUT"), RAMPAGE mode, "LATCHED!" parasite warning
  - Power-ups mentioned: ⚡ speed, ★ giant (3×3 crush)
  - Hazards mentioned: spider webs (slow), scorpion poison (drain over time)
  - Enemy types mentioned: slugs, termites, hornets, pillbugs, locusts, egg sacs

---

## 3. Scope

### ✅ In scope
1. Replace/rebuild the following screens using the new UI kit as the design reference:
   - Start / Home screen
   - Pause menu
   - Game Over screen
   - How-to-Play / tutorial screen
   - Shop / Skins screen
   - Settings screen
2. Add an **in-game coins** feature (currency the player earns and can spend — needed to support the skins shop).
3. Add **3 cube skins** the player can unlock/select (currently the game has one default cube look — build out 2 additional skins + skin-select UI, wired to the new Shop screen).
4. Improve **power-up visibility** — players are currently ignoring power-ups; needs stronger visual treatment (icon prominence, glow/animation, on-screen callout, and/or a mention in the How-to-Play screen) so players notice and use them.
5. **Mobile responsiveness across all touched screens** — this is the top priority since most users are on mobile. Web/desktop is secondary but should not break.

### 🚫 Explicitly out of scope (do not build, do not touch)
- **Leaderboard** — another person is already building this feature. Do not implement, redesign, or wire it up. Leave a placeholder/stub if the new UI kit includes a leaderboard entry point, but don't build functionality behind it.
- **Daily challenges** — not part of this task. Ignore any mention of it in the design file.
- **The in-game HUD / active gameplay screen** — the actual moment-to-moment gameplay UI (health, score ticker, level indicator, rampage banner, latch warning, etc. while playing) stays exactly as it is today. Only the surrounding menu screens change.

---

## 4. Feature Details

### 4.1 New UI Integration (Start, Pause, Game Over, How-to-Play, Shop, Settings)
- Use `CubeCrush UI.dc.html` as the visual/UX reference for layout, styling, typography, color system, and button treatment.
- Preserve the existing game copy listed in Section 2 unless a specific screen in the new UI kit clearly supersedes it — flag any copy conflicts rather than silently overwriting.
- Settings screen should include: audio, haptics/vibration, controls, difficulty, colorblind mode (as covered in the reference design) — quick sound/music toggles should also be reachable directly from Pause.
- Keep hooks/placeholders for Leaderboard where the design shows it, but non-functional (see Out of Scope).

### 4.2 Coins
- Introduce a persistent coin balance for the player.
- Define (or confirm with Ishan if unclear) how coins are earned — e.g., per parasite squashed, per level survived, end-of-run bonus, etc.
- Display coin balance on the Start screen and Shop screen (matching the new UI kit's stat display treatment).
- Coins are the spend currency for unlocking skins (see 4.3).

### 4.3 Skins (3 total)
- Current game has 1 default cube appearance. Add **2 additional skins** for a total of 3.
- Build a Shop / Skin-select UI (per the new UI kit's Shop screen) where players can preview, unlock (via coins), and equip a skin.
- Selected skin should persist and apply to the actual in-game cube — this is the one exception where the "in-game UI doesn't change" rule doesn't apply, since the cube's *skin/appearance* is cosmetic, not a HUD/UI change. Gameplay HUD itself still stays untouched.

### 4.4 Power-up visibility
- Players are currently missing/ignoring power-ups (⚡ speed, ★ giant, and any healing ♥ pickups).
- Increase visual prominence in-run: stronger glow/animation/color contrast, brief on-screen callout or icon pulse when one spawns or is picked up.
- Reinforce power-up awareness in the How-to-Play screen with clear icons/labels so new players know what to look for.

### 4.5 Mobile responsiveness
- Treat mobile as the primary target for every screen touched in this task (Start, Pause, Game Over, How-to-Play, Shop, Settings).
- Web/desktop layout is secondary — should remain functional and visually consistent, but mobile layout/interaction (touch targets, spacing, swipe affordances) takes priority in any trade-off.
- Test at common phone breakpoints; verify no overflow, cramped tap targets, or truncated text on smaller screens.

---

## 5. Explicit Non-Goals (recap)
- No leaderboard implementation.
- No daily challenges implementation.
- No changes to the live gameplay HUD/behavior beyond what's needed to display the equipped skin and improved power-up visibility.
- No redesign of core gameplay mechanics (movement, squashing, latching, rampage logic).

---

## 6. Open Questions / Assumptions to confirm with Ishan before/while building
- Exact coin-earning rule(s) and any coin costs per skin (flat price vs. tiered).
- Whether the 2 new skins have specific visual concepts already in mind, or need to be designed fresh in the same "dark subterranean arcade / toxic-venom" style as the rest of the UI kit.
- Access to the actual `CubeCrush UI.dc.html` design file content, since it's behind Claude.ai auth and wasn't directly retrievable — Ishan should share exported screens/assets or grant access.
- Whether any copy in the new UI kit should override the existing live-game copy listed in Section 2.

---

## 7. Definition of Done
- [ ] Start, Pause, Game Over, How-to-Play, Shop, and Settings screens all match the new UI kit's design language and are live in the actual game.
- [ ] In-game gameplay HUD is untouched apart from displaying the equipped skin and more visible power-ups.
- [ ] Coins are earned, persisted, and spendable in the Shop.
- [ ] 3 skins exist, are unlockable/selectable, and the equipped skin renders in actual gameplay.
- [ ] Power-ups are visually more prominent during gameplay and explained in How-to-Play.
- [ ] All touched screens are fully responsive and tested on mobile breakpoints first, then verified on web/desktop.
- [ ] Leaderboard and Daily Challenges remain untouched/stubbed only.
