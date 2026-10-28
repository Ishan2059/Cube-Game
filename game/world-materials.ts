import * as THREE from "three";
import { worldHash } from "./world-rules";

/** The same small, quiet marks and tile scale as the original grass canvas. */
export function makeWorldMaterials() {
  const result = new Map<string, THREE.Texture>();
  const palettes: Record<string, [number, number, number]> = {
    mud: [62, 55, 34], stone: [80, 85, 64], wood: [110, 77, 43], ash: [48, 39, 38],
  };
  for (const [id, base] of Object.entries(palettes)) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const c = canvas.getContext("2d")!;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      const light = (worldHash(x + 15, y - 6) - .5) * 12;
      c.fillStyle = `rgb(${base.map(v => Math.round(v + light)).join(",")})`;
      c.fillRect(x * 64, y * 64, 64, 64);
      c.strokeStyle = id === "wood" ? "rgba(32,25,14,.32)" : "rgba(162,167,115,.12)";
      c.lineWidth = 2;
      c.strokeRect(x * 64 + 1, y * 64 + 1, 62, 62);
      if (id === "wood") {
        for (let plank = 1; plank < 4; plank++) {
          c.fillStyle = "rgba(28,20,12,.24)";
          c.fillRect(x * 64 + plank * 16, y * 64, 1, 64);
          c.fillStyle = "rgba(206,163,91,.13)";
          c.fillRect(x * 64 + plank * 16 + 1, y * 64 + 2, 1, 60);
        }
      }
      for (let i = 0; i < 18; i++) {
        const a = worldHash(x * 17 + i, y * 23), b = worldHash(x + i * 7, y * 19 + 4);
        c.fillStyle = i % 2 ? "rgba(191,180,127,.12)" : "rgba(15,24,12,.13)";
        c.fillRect(x * 64 + a * 59 + 2, y * 64 + b * 57 + 3, id === "wood" ? 1 : 2 + a * 3, id === "wood" ? 5 + b * 12 : 2 + b * 3);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    result.set(id, texture);
  }
  return result;
}
