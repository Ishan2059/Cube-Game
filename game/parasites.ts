import * as THREE from "three";

/* ================= parasite type table ================= */
export const TYPES = {
  worm: { points: 10, interval: 1.15, goo: 0x77c04a, name: "worm" },
  bug: { points: 25, interval: 0.62, goo: 0xc46a3a, name: "bug" },
  spider: { points: 40, interval: 0.85, goo: 0x8a5aa8, name: "spider" },
  // rare — show up only sometimes (see spawn weights in engine.ts)
  scorpion: { points: 80, interval: 0.5, goo: 0xc4903a, name: "scorpion" },
  beetle: { points: 120, interval: 0.8, goo: 0x4a8a3a, name: "beetle" },
  // —— variety wave: each carries a distinct ability handled in engine.ts ——
  slug: { points: 20, interval: 1.45, goo: 0x9ab04a, name: "slug" }, // slime trail
  termite: { points: 35, interval: 0.72, goo: 0xd8c088, name: "termite" }, // digs pits
  hornet: { points: 60, interval: 0.55, goo: 0xd8a83a, name: "hornet" }, // bite dazes
  mosquito: { points: 45, interval: 0.42, goo: 0xa83a3a, name: "mosquito" }, // bite drains extra
  pillbug: { points: 55, interval: 0.8, goo: 0x8a7a6a, name: "pillbug" }, // only killable idle
  flea: { points: 35, interval: 0.4, goo: 0x5a3a2a, name: "flea" }, // fast erratic hops
  locust: { points: 70, interval: 0.72, goo: 0x8aa84a, name: "locust" }, // periodic dash
  eggsac: { points: 40, interval: 2, goo: 0xd8d0b8, name: "egg sac" }, // hatches into more
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
  // bright enough to read against the dark soil at high levels
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x7a4fa8,
    emissive: 0x1a0a2e,
    roughness: 0.5,
  });
  const legMat = new THREE.MeshStandardMaterial({
    color: 0x4a3468,
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

export function makeScorpionMesh(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x9a4433,
    emissive: 0x2a0c08,
    roughness: 0.45,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x552420,
    roughness: 0.55,
  });
  // segmented body
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 - i * 0.01, 10, 8),
      bodyMat,
    );
    s.position.set(-i * 0.11, 0.1, 0);
    s.castShadow = true;
    g.add(s);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bodyMat);
  head.position.set(0.14, 0.1, 0);
  g.add(head);
  makeEyes(g, 0.19, 0.12, 0, 0.03, 0.02);
  // pincers
  for (const sdir of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.02, 0.16),
      darkMat,
    );
    arm.position.set(0.22, 0.09, sdir * 0.07);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = sdir * 0.4;
    g.add(arm);
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), darkMat);
    claw.scale.set(1.4, 0.7, 0.7);
    claw.position.set(0.31, 0.09, sdir * 0.1);
    g.add(claw);
  }
  // tail curled up and over, gold stinger
  for (let i = 0; i < 5; i++) {
    const a = i * 0.5;
    const t = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 - i * 0.004, 8, 6),
      darkMat,
    );
    t.position.set(-0.33 + Math.sin(a) * 0.16, 0.12 + (1 - Math.cos(a)) * 0.22, 0);
    g.add(t);
  }
  const sting = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.09, 8),
    new THREE.MeshStandardMaterial({ color: 0xe0b64e, emissive: 0x3a2a08 }),
  );
  const la = 5 * 0.5;
  sting.position.set(
    -0.33 + Math.sin(la) * 0.16,
    0.12 + (1 - Math.cos(la)) * 0.22,
    0,
  );
  sting.rotation.z = Math.PI;
  g.add(sting);
  // legs
  const legs: { m: THREE.Mesh; ph: number; s: number }[] = [];
  for (let i = 0; i < 3; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.006, 0.18),
        darkMat,
      );
      leg.position.set(i * 0.08 - 0.08, 0.08, s * 0.11);
      leg.rotation.x = s * 0.9;
      g.add(leg);
      legs.push({ m: leg, ph: i + (s > 0 ? 0.5 : 0), s });
    }
  }
  g.userData.legs = legs;
  g.userData.animate = (t: number) => {
    for (const l of legs)
      l.m.rotation.x = l.s * 0.9 + Math.sin(t * 16 + l.ph * 2) * 0.28;
  };
  return g;
}

export function makeBeetleMesh(): THREE.Group {
  const g = new THREE.Group();
  // beetle dominates late levels — keep it bright emerald so it never
  // vanishes against the dark ground (old 0x243a2a was near-invisible)
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x2fa057,
    emissive: 0x123c1e,
    roughness: 0.25,
    metalness: 0.3,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x141a12,
    roughness: 0.4,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), shellMat);
  shell.scale.set(1.2, 0.85, 1.1);
  shell.position.y = 0.14;
  shell.castShadow = true;
  g.add(shell);
  // shell seam
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.012), darkMat);
  seam.position.y = 0.28;
  g.add(seam);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), darkMat);
  head.position.set(0.2, 0.1, 0);
  g.add(head);
  // rhino horn
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 8), darkMat);
  horn.position.set(0.26, 0.16, 0);
  horn.rotation.z = -0.7;
  g.add(horn);
  makeEyes(g, 0.24, 0.11, 0, 0.045, 0.02);
  const legs: { m: THREE.Mesh; ph: number; s: number }[] = [];
  for (let i = -1; i <= 1; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.01, 0.16),
        darkMat,
      );
      leg.position.set(i * 0.1, 0.06, s * 0.16);
      leg.rotation.x = s * 0.7;
      g.add(leg);
      legs.push({ m: leg, ph: i + (s > 0 ? 0.5 : 0), s });
    }
  }
  g.userData.legs = legs;
  g.userData.animate = (t: number) => {
    for (const l of legs)
      l.m.rotation.x = l.s * 0.7 + Math.sin(t * 12 + l.ph * 2) * 0.25;
  };
  return g;
}

export function makeSlugMesh(): THREE.Group {
  const g = new THREE.Group();
  const matA = new THREE.MeshStandardMaterial({
    color: 0x9ab04a,
    roughness: 0.3,
  });
  const matB = new THREE.MeshStandardMaterial({
    color: 0x82993c,
    roughness: 0.3,
  });
  const segs: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const r = 0.15 - i * 0.02;
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(r, 12, 10),
      i % 2 ? matB : matA,
    );
    seg.scale.set(1.3, 0.85, 1);
    seg.position.set(-i * 0.14, r * 0.85, 0);
    seg.castShadow = true;
    g.add(seg);
    segs.push(seg);
  }
  // eye stalks
  const stalkMat = matA;
  for (const s of [-1, 1]) {
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.11),
      stalkMat,
    );
    stalk.position.set(0.16, 0.19, s * 0.05);
    stalk.rotation.z = -0.3;
    g.add(stalk);
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
    );
    eye.position.set(0.2, 0.24, s * 0.05);
    g.add(eye);
  }
  g.userData.animate = (t: number) => {
    segs.forEach((s, i) => {
      const r = 0.15 - i * 0.02;
      s.scale.y = 0.85 + Math.sin(t * 5 - i * 0.8) * 0.12;
      s.position.y = r * 0.85 + Math.sin(t * 5 - i * 0.8) * 0.015;
    });
  };
  return g;
}

export function makeTermiteMesh(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xd8c088,
    roughness: 0.5,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xb88a4a,
    roughness: 0.5,
  });
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 - i * 0.008, 10, 8),
      bodyMat,
    );
    seg.scale.set(1.1, 0.8, 1);
    seg.position.set(-i * 0.11, 0.1, 0);
    seg.castShadow = true;
    g.add(seg);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), headMat);
  head.position.set(0.14, 0.1, 0);
  g.add(head);
  // big forward mandibles
  const mand: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 6), headMat);
    m.position.set(0.24, 0.1, s * 0.045);
    m.rotation.z = -Math.PI / 2;
    m.rotation.x = s * 0.35;
    g.add(m);
    mand.push(m);
  }
  makeEyes(g, 0.18, 0.13, 0, 0.035, 0.018);
  const legs: { m: THREE.Mesh; ph: number; s: number }[] = [];
  for (let i = -1; i <= 1; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.006, 0.11),
        headMat,
      );
      leg.position.set(i * 0.08, 0.05, s * 0.1);
      leg.rotation.x = s * 0.7;
      g.add(leg);
      legs.push({ m: leg, ph: i + (s > 0 ? 0.5 : 0), s });
    }
  }
  g.userData.animate = (t: number) => {
    for (const l of legs)
      l.m.rotation.x = l.s * 0.7 + Math.sin(t * 16 + l.ph * 2) * 0.28;
    // gnashing mandibles
    mand.forEach((m, i) => (m.rotation.x = (i ? 1 : -1) * (0.35 + Math.sin(t * 12) * 0.2)));
  };
  return g;
}

export function makeHornetMesh(): THREE.Group {
  const g = new THREE.Group();
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xe0b83a,
    roughness: 0.35,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1c1610,
    roughness: 0.5,
  });
  // striped abdomen
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(0.11 - i * 0.012, 12, 10),
      i % 2 ? darkMat : yellowMat,
    );
    seg.scale.set(1, 0.9, 1);
    seg.position.set(-i * 0.11 - 0.05, 0.13, 0);
    seg.castShadow = true;
    g.add(seg);
  }
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), darkMat);
  thorax.position.set(0.08, 0.13, 0);
  g.add(thorax);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), yellowMat);
  head.position.set(0.19, 0.13, 0);
  g.add(head);
  makeEyes(g, 0.23, 0.14, 0, 0.04, 0.02);
  // stinger
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 8), darkMat);
  sting.position.set(-0.32, 0.13, 0);
  sting.rotation.z = Math.PI / 2;
  g.add(sting);
  // wings
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xd8e0e8,
    transparent: true,
    opacity: 0.45,
    roughness: 0.2,
    side: THREE.DoubleSide,
  });
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), wingMat);
    w.position.set(0.02, 0.24, s * 0.06);
    w.rotation.x = -Math.PI / 2;
    w.rotation.z = s * 0.3;
    g.add(w);
    wings.push(w);
  }
  g.userData.animate = (t: number) => {
    wings.forEach((w, i) => (w.rotation.x = -Math.PI / 2 + Math.sin(t * 40 + i) * 0.5));
  };
  return g;
}

export function makeMosquitoMesh(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x7a5a4a,
    roughness: 0.5,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bodyMat);
  body.scale.set(1.6, 0.8, 0.8);
  body.position.set(-0.05, 0.16, 0);
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bodyMat);
  head.position.set(0.09, 0.16, 0);
  g.add(head);
  // long proboscis
  const pro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.003, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xa83a3a }),
  );
  pro.position.set(0.22, 0.16, 0);
  pro.rotation.z = Math.PI / 2;
  g.add(pro);
  // long thin legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22 });
  const legs: { m: THREE.Mesh; ph: number; s: number }[] = [];
  for (let i = -1; i <= 1; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.003, 0.24),
        legMat,
      );
      leg.position.set(i * 0.06 - 0.05, 0.07, s * 0.09);
      leg.rotation.x = s * 1.1;
      leg.rotation.z = (i - 0) * 0.2;
      g.add(leg);
      legs.push({ m: leg, ph: i + (s > 0 ? 0.5 : 0), s });
    }
  }
  // wings
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xd8e0e8,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.07), wingMat);
    w.position.set(-0.03, 0.24, s * 0.05);
    w.rotation.x = -Math.PI / 2;
    w.rotation.z = s * 0.4;
    g.add(w);
    wings.push(w);
  }
  g.userData.animate = (t: number) => {
    wings.forEach((w, i) => (w.rotation.x = -Math.PI / 2 + Math.sin(t * 55 + i) * 0.6));
    for (const l of legs)
      l.m.rotation.x = l.s * 1.1 + Math.sin(t * 10 + l.ph) * 0.12;
  };
  return g;
}

export function makePillbugMesh(): THREE.Group {
  const g = new THREE.Group();
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x8a7a6a,
    roughness: 0.4,
    metalness: 0.15,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x4a4038,
    roughness: 0.5,
  });
  // overlapping armor plates forming a dome
  for (let i = 0; i < 5; i++) {
    const plate = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      plateMat,
    );
    plate.scale.set(1, 0.9, 1 - i * 0.06);
    plate.position.set(i * 0.045 - 0.09, 0.09, 0);
    plate.castShadow = true;
    g.add(plate);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), darkMat);
  head.position.set(0.16, 0.07, 0);
  g.add(head);
  makeEyes(g, 0.2, 0.08, 0, 0.03, 0.016);
  const legs: { m: THREE.Mesh; ph: number; s: number }[] = [];
  for (let i = -1; i <= 1; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.005, 0.09),
        darkMat,
      );
      leg.position.set(i * 0.08, 0.03, s * 0.13);
      leg.rotation.x = s * 0.8;
      g.add(leg);
      legs.push({ m: leg, ph: i + (s > 0 ? 0.5 : 0), s });
    }
  }
  g.userData.animate = (t: number) => {
    for (const l of legs)
      l.m.rotation.x = l.s * 0.8 + Math.sin(t * 15 + l.ph * 2) * 0.25;
  };
  return g;
}

export function makeFleaMesh(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x4a3226,
    roughness: 0.45,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), bodyMat);
  body.scale.set(0.8, 1.1, 0.9);
  body.position.set(0, 0.12, 0);
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bodyMat);
  head.position.set(0.09, 0.16, 0);
  g.add(head);
  makeEyes(g, 0.12, 0.17, 0, 0.025, 0.016);
  // oversized bent hind legs
  const hind: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.01, 0.16),
      bodyMat,
    );
    thigh.position.set(-0.06, 0.11, s * 0.09);
    thigh.rotation.z = 0.9;
    thigh.rotation.x = s * 0.3;
    g.add(thigh);
    hind.push(thigh);
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.006, 0.16),
      bodyMat,
    );
    shin.position.set(-0.12, 0.04, s * 0.1);
    shin.rotation.z = -0.6;
    g.add(shin);
  }
  // small front legs
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.004, 0.08),
      bodyMat,
    );
    leg.position.set(0.06, 0.05, s * 0.06);
    leg.rotation.x = s * 0.6;
    g.add(leg);
  }
  g.userData.animate = (t: number) => {
    for (const h of hind) h.rotation.z = 0.9 + Math.sin(t * 20) * 0.15;
  };
  return g;
}

export function makeLocustMesh(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x8aa84a,
    roughness: 0.4,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x5a7030,
    roughness: 0.5,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), bodyMat);
  body.scale.set(1.7, 0.85, 0.85);
  body.position.set(-0.06, 0.13, 0);
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bodyMat);
  head.position.set(0.14, 0.13, 0);
  g.add(head);
  makeEyes(g, 0.19, 0.15, 0, 0.05, 0.024);
  // antennae
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.14),
      darkMat,
    );
    a.position.set(0.2, 0.2, s * 0.03);
    a.rotation.z = -0.6;
    g.add(a);
  }
  // big folded hind legs
  const hind: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.012, 0.2),
      darkMat,
    );
    thigh.position.set(-0.1, 0.14, s * 0.11);
    thigh.rotation.z = 1.0;
    g.add(thigh);
    hind.push(thigh);
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.006, 0.22),
      darkMat,
    );
    shin.position.set(-0.16, 0.04, s * 0.12);
    shin.rotation.z = -0.5;
    g.add(shin);
  }
  // small front legs
  const legs: { m: THREE.Mesh; ph: number; s: number }[] = [];
  for (let i = 0; i < 2; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.005, 0.12),
        darkMat,
      );
      leg.position.set(i * 0.08 + 0.02, 0.05, s * 0.09);
      leg.rotation.x = s * 0.7;
      g.add(leg);
      legs.push({ m: leg, ph: i + (s > 0 ? 0.5 : 0), s });
    }
  }
  g.userData.animate = (t: number) => {
    for (const l of legs)
      l.m.rotation.x = l.s * 0.7 + Math.sin(t * 16 + l.ph * 2) * 0.25;
    for (const h of hind) h.rotation.z = 1.0 + Math.sin(t * 6) * 0.08;
  };
  return g;
}

export function makeEggSacMesh(): THREE.Group {
  const g = new THREE.Group();
  const eggMat = new THREE.MeshStandardMaterial({
    color: 0xe4dcc4,
    roughness: 0.35,
    emissive: 0x2a2618,
    emissiveIntensity: 0.4,
  });
  const eggs: THREE.Mesh[] = [];
  const spots = [
    [0, 0.09, 0, 0.11],
    [0.09, 0.08, 0.05, 0.08],
    [-0.08, 0.08, 0.06, 0.08],
    [0.05, 0.1, -0.08, 0.075],
    [-0.06, 0.11, -0.05, 0.07],
    [0.02, 0.18, 0, 0.07],
  ] as const;
  for (const [x, y, z, r] of spots) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), eggMat);
    e.scale.y = 1.3;
    e.position.set(x, y, z);
    e.castShadow = true;
    g.add(e);
    eggs.push(e);
  }
  g.userData.animate = (t: number) => {
    const p = 1 + Math.sin(t * 4) * 0.05;
    eggs.forEach((e, i) => e.scale.setScalar(p + Math.sin(t * 3 + i) * 0.02));
    // (scale.y baseline lost to pulse — acceptable, reads as a breathing clutch)
  };
  return g;
}

const BUILDERS: Record<ParasiteType, () => THREE.Group> = {
  worm: makeWormMesh,
  bug: makeBugMesh,
  spider: makeSpiderMesh,
  scorpion: makeScorpionMesh,
  beetle: makeBeetleMesh,
  slug: makeSlugMesh,
  termite: makeTermiteMesh,
  hornet: makeHornetMesh,
  mosquito: makeMosquitoMesh,
  pillbug: makePillbugMesh,
  flea: makeFleaMesh,
  locust: makeLocustMesh,
  eggsac: makeEggSacMesh,
};

export function makeParasiteMesh(type: ParasiteType): THREE.Group {
  return BUILDERS[type]();
}
