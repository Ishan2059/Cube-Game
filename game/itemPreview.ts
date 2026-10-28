/* ================= shared shop-item 3D preview =================
 * One renderer/scene/camera/resize/RAF setup used by every item-modal
 * preview (Skins, Trails). Each category only supplies the frame its
 * content actually occupies (a sphere that comfortably contains the cube
 * plus whatever effect it's showing) and a `build()` callback that adds its
 * own objects to the scene. The camera is derived from that frame with
 * fixed padding, so every category sits at the same comfortable, centered
 * size inside the modal instead of each hand-picking its own
 * distance/FOV and risking clipping.
 */

import * as THREE from "three";
import { getStudioEnvironment } from "./lighting";

const FOV_DEG = 34;
/** How much of the frustum height the bounding sphere fills — 1 / PADDING,
 *  so PADDING 1.3 leaves ~23% breathing room around the item on every side. */
const PADDING = 1.3;
/** Default 3/4 view: high enough to show the cube's top face, shallow enough
 *  that it still reads as a cube and not a plan view. */
const DEFAULT_CAMERA_DIR = new THREE.Vector3(0.72, 0.72, 1);

export interface PreviewFrame {
  /** Radius of a sphere around `center` that contains everything drawn. */
  radius: number;
  /** Where that sphere sits. Defaults to the origin; categories that rest
   *  their cube on a ground plane (Trails) need to lift it. */
  center?: THREE.Vector3;
  /** Direction the camera sits in, relative to `center` (length ignored —
   *  distance comes from `radius`). Steeper angles read ground-level effects
   *  better; defaults to DEFAULT_CAMERA_DIR. */
  cameraDir?: THREE.Vector3;
}

export interface PreviewBuild {
  /** Elapsed seconds, capped at 50 ms to avoid jumps after a stall. */
  tick: (dt: number) => void;
  /** Optional point for the camera to track, updated by `tick`. Categories
   *  whose content travels (Trails) keep it framed by following it, the same
   *  way the gameplay camera follows the cube; leaving it undefined pins the
   *  camera to `frame.center`. */
  focus?: THREE.Vector3;
  /** Frees geometries/materials/effect state. Renderer/DOM teardown is
   *  handled by mountItemPreview itself. */
  dispose: () => void;
}

/** Mounts a shared preview scene into `container`, framed so `frame` is fully
 *  visible with padding. Returns a dispose function — call it when the
 *  preview closes. */
export function mountItemPreview(
  container: HTMLElement,
  frame: PreviewFrame,
  build: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => PreviewBuild,
): () => void {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";

  const scene = new THREE.Scene();
  scene.environment = getStudioEnvironment();
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x2c2418, 1.2));
  const sun = new THREE.DirectionalLight(0xffe6c0, 1.8);
  sun.position.set(2, 3, 2);
  scene.add(sun);

  const center = frame.center ?? new THREE.Vector3(0, 0, 0);
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 40);
  const fitHeight = frame.radius * PADDING;
  const dist = fitHeight / Math.tan((FOV_DEG * Math.PI) / 360);
  // Offset from whatever the camera is looking at — reused every frame when a
  // build tracks a moving focus.
  const camOffset = (frame.cameraDir ?? DEFAULT_CAMERA_DIR)
    .clone()
    .normalize()
    .multiplyScalar(dist);
  camera.position.copy(camOffset).add(center);
  camera.lookAt(center);

  const { tick, focus, dispose: disposeContent } = build(scene, camera);

  const resize = () => {
    const s = Math.max(1, Math.min(container.clientWidth, container.clientHeight));
    renderer.setSize(s, s, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let raf = 0;
  let previous=performance.now();
  const loop = (now:number) => {
    const dt=Math.min(.05,(now-previous)/1000);previous=now;
    tick(document.hidden?0:dt);
    if (focus) {
      camera.position.copy(focus).add(camOffset);
      camera.lookAt(focus);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    disposeContent();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
