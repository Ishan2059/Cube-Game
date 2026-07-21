/* ================= trail & aura effects =================
 * Shared, self-contained Three.js primitives for the two cosmetic effect
 * types. Both the live game (engine.ts) and the shop's preview modal
 * (trails.ts / auras.ts mount functions) create their own instance against
 * whatever scene/cube they own — same pooled-particle pattern already used
 * for kill-splat effects in engine.ts, just kept separate so trail/aura
 * particles never interact with combat particles or their gravity.
 */

import * as THREE from "three";

/* ---------- shared soft-dot sprite (cached, built once) ---------- */
let dotTex: THREE.CanvasTexture | null = null;
function getDotTexture(): THREE.CanvasTexture {
  if (dotTex) return dotTex;
  const s = 32;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  dotTex = new THREE.CanvasTexture(cv);
  return dotTex;
}

/* ================= trail: motion-triggered afterimage ================= */
export interface TrailHandle {
  /** Call every frame. `moving` gates spawning — no motion, no new particles. */
  update(dt: number, worldPos: THREE.Vector3, moving: boolean): void;
  setColor(color: number): void;
  /** "none" trail = inactive: stops spawning and clears anything alive. */
  setActive(active: boolean): void;
  /** Instantly releases everything alive without deactivating — for a run
   *  restart, so no stale streak lingers from the previous run's death spot. */
  clear(): void;
  dispose(): void;
}

const TRAIL_MAX = 34; // hard cap on concurrent particles — bounds draw calls
export const TRAIL_LIFE = 0.55; // seconds a particle takes to fully fade
// Tight enough that consecutive particles overlap into a continuous ribbon
// rather than reading as a dotted line.
const TRAIL_SPAWN_INTERVAL = 0.02;
const TRAIL_QUAD = 0.42; // world size of one particle at scale 1
const TRAIL_JITTER = 0.035; // per-particle scatter around the cube's path
const TRAIL_SCALE_MIN = 0.9;
const TRAIL_SCALE_MAX = 1.2;
/** How far the streak can reach sideways from the cube's centre line —
 *  widest particle's half-extent plus its scatter. Preview framing uses this
 *  so the streak never clips at the container edge. */
export const TRAIL_SPREAD = (TRAIL_QUAD * TRAIL_SCALE_MAX) / 2 + TRAIL_JITTER;

export function createTrail(scene: THREE.Scene, color: number): TrailHandle {
  const geo = new THREE.PlaneGeometry(TRAIL_QUAD, TRAIL_QUAD);
  const pool: THREE.Mesh[] = [];
  // s0/peak are per-particle so each one tapers from its own starting
  // width/brightness — set absolutely every frame (never accumulated), so a
  // pooled mesh can't come back carrying a previous life's scale.
  const alive: { mesh: THREE.Mesh; t: number; s0: number; peak: number }[] = [];
  let active = true;
  let spawnAcc = 0;
  let col = color;

  function acquire(): THREE.Mesh {
    const m =
      pool.pop() ??
      new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          map: getDotTexture(),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
    (m.material as THREE.MeshBasicMaterial).color.setHex(col);
    return m;
  }
  function release(m: THREE.Mesh) {
    scene.remove(m);
    pool.push(m);
  }
  function clear() {
    for (const p of alive) release(p.mesh);
    alive.length = 0;
    spawnAcc = 0;
  }

  return {
    update(dt, worldPos, moving) {
      if (active && moving) {
        spawnAcc += dt;
        while (spawnAcc >= TRAIL_SPAWN_INTERVAL && alive.length < TRAIL_MAX) {
          spawnAcc -= TRAIL_SPAWN_INTERVAL;
          const m = acquire();
          m.position.set(
            worldPos.x + (Math.random() - 0.5) * TRAIL_JITTER * 2,
            0.1 + Math.random() * 0.08,
            worldPos.z + (Math.random() - 0.5) * TRAIL_JITTER * 2,
          );
          m.rotation.x = -Math.PI / 2;
          m.rotation.z = Math.random() * Math.PI;
          const s0 = TRAIL_SCALE_MIN + Math.random() * (TRAIL_SCALE_MAX - TRAIL_SCALE_MIN);
          const peak = 0.72 + Math.random() * 0.22;
          m.scale.setScalar(s0);
          (m.material as THREE.MeshBasicMaterial).opacity = peak;
          scene.add(m);
          alive.push({ mesh: m, t: 0, s0, peak });
        }
      } else {
        spawnAcc = 0;
      }
      for (let i = alive.length - 1; i >= 0; i--) {
        const p = alive[i];
        p.t += dt;
        const k = p.t / TRAIL_LIFE;
        if (k >= 1) {
          release(p.mesh);
          alive.splice(i, 1);
          continue;
        }
        // Width narrows and brightness eases out as a particle ages, so the
        // streak is widest/brightest at the cube and tapers to nothing behind
        // it. Quadratic fade reads smoother than a linear one — no visible
        // "pop" as the tail end disappears.
        const life = 1 - k;
        p.mesh.scale.setScalar(p.s0 * (0.18 + 0.82 * life));
        // Eased rather than squared: a straight life*life fade dimmed the
        // middle of the streak so hard that only a stub read as a trail.
        (p.mesh.material as THREE.MeshBasicMaterial).opacity =
          p.peak * life * (0.35 + 0.65 * life);
      }
    },
    setColor(c) {
      col = c;
    },
    setActive(a) {
      active = a;
      if (!a) clear();
    },
    clear,
    dispose() {
      clear();
      for (const m of pool) (m.material as THREE.Material).dispose();
      pool.length = 0;
      geo.dispose();
    },
  };
}

/* ================= aura: always-on pulsing halo ================= */
export interface AuraHandle {
  /** Call every frame (movement-independent — it's always pulsing). */
  update(dt: number): void;
  setColor(color: number): void;
  setActive(active: boolean): void;
  dispose(): void;
}

const AURA_SPARKLE_COUNT = 10;
// Two stacked glow sprites: a tight bright core and a wide soft bloom. Their
// breathing runs slightly out of phase, which keeps the halo's falloff moving
// instead of scaling as one flat disc.
const AURA_CORE_BASE = 1.5;
const AURA_CORE_SWING = 0.3;
const AURA_BLOOM_BASE = 2.15;
const AURA_BLOOM_SWING = 0.35;
/** Visible half-extent of the halo at full pulse. The dot sprite's gradient
 *  is already fully transparent well before its geometric edge, so framing to
 *  the whole quad would waste most of the preview container — 0.86 is where
 *  the bloom has actually faded out. */
export const AURA_RADIUS = ((AURA_BLOOM_BASE + AURA_BLOOM_SWING) / 2) * 0.86;

/** Attaches a pulsing glow (+ a handful of slowly-orbiting sparkle points)
 *  as children of `anchor` (typically the cube mesh), so it tracks position
 *  for free. Cheap: two glow sprites + AURA_SPARKLE_COUNT tiny spheres on a
 *  shared geometry, no per-frame spawning — just transform/opacity animation. */
export function createAura(anchor: THREE.Object3D, color: number): AuraHandle {
  const group = new THREE.Group();
  anchor.add(group);

  const mkGlow = (scale: number, opacity: number) => {
    const mat = new THREE.SpriteMaterial({
      map: getDotTexture(),
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(scale);
    group.add(sprite);
    return { sprite, mat };
  };
  const core = mkGlow(AURA_CORE_BASE, 0.45);
  const bloom = mkGlow(AURA_BLOOM_BASE, 0.26);

  const sparkGeo = new THREE.SphereGeometry(0.045, 6, 5);
  const sparkles: THREE.Mesh[] = [];
  // Each sparkle rides its own tilted great circle (u/v are an orthonormal
  // basis for that orbit plane), so together they read as a halo with volume
  // rather than a single flat ring of dots.
  const orbits: { u: THREE.Vector3; v: THREE.Vector3; r: number; spd: number; ph: number }[] = [];
  for (let i = 0; i < AURA_SPARKLE_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(sparkGeo, mat);
    group.add(m);
    sparkles.push(m);

    // deterministic spread of inclinations/nodes — no RNG, so every aura
    // instance (preview and live game) animates identically
    const node = (i / AURA_SPARKLE_COUNT) * Math.PI * 2;
    const inc = 0.35 + ((i * 0.37) % 1) * 0.9;
    const ci = Math.cos(inc);
    orbits.push({
      u: new THREE.Vector3(Math.cos(node), 0, Math.sin(node)),
      v: new THREE.Vector3(-Math.sin(node) * ci, Math.sin(inc), Math.cos(node) * ci),
      r: 0.58 + ((i * 0.53) % 1) * 0.16,
      spd: 0.7 + ((i * 0.29) % 1) * 0.5,
      ph: (i * 2.399) % (Math.PI * 2),
    });
  }

  let t = 0;
  let active = true;

  return {
    update(dt) {
      if (!active) return;
      t += dt;

      // The halo is parented to the cube for free position tracking, but the
      // cube tumbles as it rolls — undo its rotation so the glow stays
      // world-stable and the orbits read as their own motion.
      group.quaternion.copy(anchor.quaternion).invert();

      const breathe = 0.5 + Math.sin(t * 1.6) * 0.5; // 0..1
      const breathe2 = 0.5 + Math.sin(t * 1.6 + 1.1) * 0.5; // offset partner
      core.sprite.scale.setScalar(AURA_CORE_BASE + breathe * AURA_CORE_SWING);
      core.mat.opacity = 0.34 + breathe * 0.2;
      bloom.sprite.scale.setScalar(AURA_BLOOM_BASE + breathe2 * AURA_BLOOM_SWING);
      bloom.mat.opacity = 0.16 + breathe2 * 0.14;

      for (let i = 0; i < sparkles.length; i++) {
        const o = orbits[i];
        const a = t * o.spd + o.ph;
        const ca = Math.cos(a) * o.r;
        const sa = Math.sin(a) * o.r;
        sparkles[i].position.set(
          o.u.x * ca + o.v.x * sa,
          o.u.y * ca + o.v.y * sa,
          o.u.z * ca + o.v.z * sa,
        );
        // twinkle: brightness and size pulse together on their own phase
        const tw = 0.5 + Math.sin(t * 2.4 + o.ph * 1.7) * 0.5;
        sparkles[i].scale.setScalar(0.7 + tw * 0.75);
        (sparkles[i].material as THREE.MeshBasicMaterial).opacity = 0.28 + tw * 0.62;
      }
    },
    setColor(c) {
      core.mat.color.setHex(c);
      bloom.mat.color.setHex(c);
      for (const s of sparkles) (s.material as THREE.MeshBasicMaterial).color.setHex(c);
    },
    setActive(a) {
      active = a;
      group.visible = a;
    },
    dispose() {
      anchor.remove(group);
      core.mat.dispose();
      bloom.mat.dispose();
      sparkGeo.dispose();
      for (const s of sparkles) (s.material as THREE.Material).dispose();
    },
  };
}
