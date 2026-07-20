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

const TRAIL_MAX = 16; // hard cap on concurrent particles — bounds draw calls
const TRAIL_LIFE = 0.42; // seconds a particle takes to fully fade
const TRAIL_SPAWN_INTERVAL = 0.032; // seconds between spawns while moving

export function createTrail(scene: THREE.Scene, color: number): TrailHandle {
  const geo = new THREE.PlaneGeometry(0.42, 0.42);
  const pool: THREE.Mesh[] = [];
  const alive: { mesh: THREE.Mesh; t: number }[] = [];
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
            worldPos.x + (Math.random() - 0.5) * 0.1,
            0.1 + Math.random() * 0.08,
            worldPos.z + (Math.random() - 0.5) * 0.1,
          );
          m.rotation.x = -Math.PI / 2;
          m.rotation.z = Math.random() * Math.PI;
          m.scale.setScalar(0.6 + Math.random() * 0.3);
          (m.material as THREE.MeshBasicMaterial).opacity = 0.8;
          scene.add(m);
          alive.push({ mesh: m, t: 0 });
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
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
        p.mesh.scale.multiplyScalar(1 + dt * 0.5);
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

const AURA_SPARKLE_COUNT = 6;

/** Attaches a pulsing glow (+ a handful of slowly-orbiting sparkle points)
 *  as children of `anchor` (typically the cube mesh), so it tracks position
 *  for free. Cheap: one glow sprite + AURA_SPARKLE_COUNT tiny spheres, no
 *  per-frame spawning — just transform/opacity animation. */
export function createAura(anchor: THREE.Object3D, color: number): AuraHandle {
  const group = new THREE.Group();
  anchor.add(group);

  const glowMat = new THREE.SpriteMaterial({
    map: getDotTexture(),
    color,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(1.9);
  group.add(glow);

  const sparkGeo = new THREE.SphereGeometry(0.045, 6, 5);
  const sparkles: THREE.Mesh[] = [];
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
  }

  let t = 0;
  let active = true;

  return {
    update(dt) {
      if (!active) return;
      t += dt;
      const pulse = 0.5 + Math.sin(t * 1.8) * 0.5; // 0..1
      glow.scale.setScalar(1.7 + pulse * 0.35);
      glowMat.opacity = 0.38 + pulse * 0.22;
      for (let i = 0; i < sparkles.length; i++) {
        const a = t * 0.9 + (i / sparkles.length) * Math.PI * 2;
        const r = 0.62;
        sparkles[i].position.set(
          Math.cos(a) * r,
          0.15 + Math.sin(t * 1.4 + i) * 0.08,
          Math.sin(a) * r,
        );
        const mat = sparkles[i].material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 + Math.sin(t * 2.2 + i * 1.7) * 0.35;
      }
    },
    setColor(c) {
      glowMat.color.setHex(c);
      for (const s of sparkles) (s.material as THREE.MeshBasicMaterial).color.setHex(c);
    },
    setActive(a) {
      active = a;
      group.visible = a;
    },
    dispose() {
      anchor.remove(group);
      glowMat.dispose();
      sparkGeo.dispose();
      for (const s of sparkles) (s.material as THREE.Material).dispose();
    },
  };
}
