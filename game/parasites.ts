import * as THREE from "three";

/* ================= parasite type table ================= */
export const TYPES = {
  worm: { points: 10, interval: 1.15, goo: 0x77c04a, name: "worm" },
  bug: { points: 25, interval: 0.62, goo: 0xc46a3a, name: "bug" },
  spider: { points: 40, interval: 0.85, goo: 0x8a5aa8, name: "spider" },
} as const;

export type ParasiteType = keyof typeof TYPES;
export type ParasiteDef = (typeof TYPES)[ParasiteType];

/* ================= parasite meshes (cartoony critters) ================= */
function makeEyes(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  spread: number,
  size = 0.028,
) {
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
  });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), eyeMat);
    e.position.set(x, y, z + s * spread);
    parent.add(e);
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.5, 6, 5),
      pupilMat,
    );
    p.position.set(x + size * 0.6, y, z + s * spread);
    parent.add(p);
  }
}

export function makeWormMesh(): THREE.Group {
  const g = new THREE.Group();
  const matA = new THREE.MeshStandardMaterial({
    color: 0x77c04a,
    roughness: 0.45,
  });
  const matB = new THREE.MeshStandardMaterial({
    color: 0x5da838,
    roughness: 0.45,
  });
  const segs: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const r = 0.1 - i * 0.012;
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      i % 2 ? matB : matA,
    );
    seg.position.set(-i * 0.13, r, 0);
    seg.castShadow = true;
    g.add(seg);
    segs.push(seg);
  }
  makeEyes(g, 0.07, 0.14, 0, 0.05);
  g.userData.segs = segs;
  g.userData.animate = (t: number) => {
    segs.forEach((s, i) => {
      const r = 0.1 - i * 0.012;
      s.position.y = r + Math.max(0, Math.sin(t * 7 - i * 0.9)) * 0.05;
      s.position.x = -i * 0.13 + Math.sin(t * 7 - i * 0.9) * 0.015;
    });
  };
  return g;
}

export function makeBugMesh(): THREE.Group {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xb03a28,
    roughness: 0.35,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x241812,
    roughness: 0.5,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), shellMat);
  shell.scale.set(1.25, 0.75, 1);
  shell.position.y = 0.11;
  shell.castShadow = true;
  g.add(shell);
  // shell split line
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.02, 0.012),
    darkMat,
  );
  line.position.y = 0.215;
  g.add(line);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), darkMat);
  head.position.set(0.19, 0.09, 0);
  g.add(head);
  makeEyes(g, 0.24, 0.11, 0, 0.04, 0.022);
  // antennae
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.12),
      darkMat,
    );
    a.position.set(0.24, 0.17, s * 0.03);
    a.rotation.z = -0.7;
    a.rotation.x = s * 0.4;
    g.add(a);
  }
  const legs: { m: THREE.Mesh; ph: number; s: number }[] = [];
  for (let i = -1; i <= 1; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.008, 0.14),
        darkMat,
      );
      leg.position.set(i * 0.09, 0.055, s * 0.14);
      leg.rotation.x = s * 0.75;
      g.add(leg);
      legs.push({ m: leg, ph: i + (s > 0 ? 0.5 : 0), s });
    }
  }
  g.userData.legs = legs;
  g.userData.animate = (t: number) => {
    for (const l of legs)
      l.m.rotation.x = l.s * 0.75 + Math.sin(t * 18 + l.ph * 2.1) * 0.3;
  };
  return g;
}

export function makeSpiderMesh(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3c2a4e,
    roughness: 0.5,
  });
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x241a30,
    roughness: 0.6,
  });
  const abdomen = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 10),
    bodyMat,
  );
  abdomen.position.set(-0.1, 0.17, 0);
  abdomen.scale.set(1.15, 1, 1);
  abdomen.castShadow = true;
  g.add(abdomen);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), bodyMat);
  head.position.set(0.09, 0.13, 0);
  g.add(head);
  // red eyes
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xd83a3a,
    emissive: 0x661111,
  });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), eyeMat);
    e.position.set(0.16, 0.15, s * 0.035);
    g.add(e);
  }
  const legs: { m: THREE.Mesh; ph: number; s: number; bz: number }[] = [];
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.007, 0.32),
        legMat,
      );
      leg.position.set(i * 0.075 - 0.12, 0.14, s * 0.16);
      leg.rotation.x = s * 1.05;
      leg.rotation.z = (i - 1.5) * 0.2;
      g.add(leg);
      legs.push({ m: leg, ph: i + (s > 0 ? 0.5 : 0), s, bz: (i - 1.5) * 0.2 });
    }
  }
  g.userData.legs = legs;
  g.userData.animate = (t: number) => {
    for (const l of legs)
      l.m.rotation.x = l.s * 1.05 + Math.sin(t * 14 + l.ph * 1.9) * 0.25;
  };
  return g;
}

export function makeParasiteMesh(type: ParasiteType): THREE.Group {
  return type === "worm"
    ? makeWormMesh()
    : type === "bug"
      ? makeBugMesh()
      : makeSpiderMesh();
}
