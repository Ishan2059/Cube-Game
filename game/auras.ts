/* ================= auras (always-on ambient halo) =================
 * Cosmetic layer on top of skins: a soft glow that pulses around the cube
 * at all times, movement-independent — the key difference from Trails.
 */

import * as THREE from "three";
import { createCubeMesh, disposeCubeMesh } from "./cubeMesh";
import { createAura } from "./effects";

export interface AuraDef {
  id: string;
  name: string;
  desc: string;
  price: number; // coins; 0 = "none", owned from the start
  color: number;
  previewSwatch: string;
}

const glow = (hex: string) =>
  `radial-gradient(circle at 50% 45%, ${hex} 0%, transparent 68%), #171308`;

export const AURAS: AuraDef[] = [
  {
    id: "none",
    name: "NONE",
    desc: "No aura. Just the cube.",
    price: 0,
    color: 0x000000,
    previewSwatch: "#171308",
  },
  {
    id: "halo",
    name: "HALO",
    desc: "A warm gold halo breathes softly, always on.",
    price: 180,
    color: 0xf5e6a8,
    previewSwatch: glow("rgba(245,230,168,0.6)"),
  },
  {
    id: "void",
    name: "VOID",
    desc: "A dark violet glow pulses like it's swallowing the light.",
    price: 300,
    color: 0x8a4ad4,
    previewSwatch: glow("rgba(138,74,212,0.6)"),
  },
  {
    id: "radiant",
    name: "RADIANT",
    desc: "Venom-green light, pulsing steadily — the premium glow.",
    price: 450,
    color: 0xb7f32b,
    previewSwatch: glow("rgba(183,243,43,0.6)"),
  },
];

export const auraById = (id: string): AuraDef =>
  AURAS.find((a) => a.id === id) ?? AURAS[0];

/** Mounts a live preview: the real cube mesh idly rotating inside
 *  `container`, with the given aura pulsing around it (always-on, exactly
 *  as it behaves in-game). Returns a dispose function for modal close. */
export function mountAuraPreview(
  container: HTMLElement,
  aura: AuraDef,
): () => void {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x2c2418, 1.2));
  const sun = new THREE.DirectionalLight(0xffe6c0, 1.8);
  sun.position.set(2, 3, 2);
  scene.add(sun);

  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 10);
  cam.position.set(1.1, 1.1, 1.5);
  cam.lookAt(0, 0, 0);

  const mesh = createCubeMesh();
  scene.add(mesh);

  const fx = createAura(mesh, aura.color);
  fx.setActive(aura.id !== "none");

  const resize = () => {
    const s = Math.max(1, Math.min(container.clientWidth, container.clientHeight));
    renderer.setSize(s, s, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let raf = 0;
  let t = 0;
  const tick = () => {
    const dt = 1 / 60;
    t += dt;
    mesh.rotation.y = t * 0.6;
    fx.update(dt);
    renderer.render(scene, cam);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    fx.dispose();
    disposeCubeMesh(mesh);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
