import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/* ================= constants ================= */
const TILE = 1;
const ROLL_TIME = 0.14;      // seconds per roll
const BITE_TIME = 5.0;       // seconds a latched parasite takes to bite
const COMBO_WINDOW = 2.5;    // seconds to keep a combo alive
const RAMPAGE_AT = 4;        // combo count that triggers rampage
const MAX_PARASITES = 24;
const VIEW_R = 14;           // world generation radius (tiles)
const SPAWN_R_MIN = 9, SPAWN_R_MAX = 12;
const DESPAWN_R = 18;

const TYPES = {
  worm:   { points: 10, interval: 1.15, goo: 0x77c04a, name: "worm" },
  bug:    { points: 25, interval: 0.62, goo: 0xc46a3a, name: "bug" },
  spider: { points: 40, interval: 0.85, goo: 0x8a5aa8, name: "spider" },
};

/* ================= state ================= */
const S = {
  running: false,
  time: 0,
  score: 0,
  best: Number(localStorage.getItem("crush-best") || 0),
  lives: 3,
  combo: 0,
  comboTimer: 0,
  rampage: false,
  streak: 0,
  totalKills: 0,
  spawnTimer: 0,
  cube: { ix: 0, iz: 0 },
  rolling: null,
  queuedDir: null,
  parasites: [],
  particles: [],
  decals: [],
  shake: 0,
};

const tileToWorld = (ix, iz) => new THREE.Vector3(ix * TILE, 0, iz * TILE);
const key2 = (x, z) => x + "," + z;

// deterministic per-tile hash (same world layout every run)
function hash2(x, z) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

const obstacleCache = new Map();
function isObstacle(ix, iz) {
  const k = key2(ix, iz);
  if (obstacleCache.has(k)) return obstacleCache.get(k);
  let v = hash2(ix, iz) < 0.065;
  if (Math.abs(ix) <= 1 && Math.abs(iz) <= 1) v = false; // safe start zone
  obstacleCache.set(k, v);
  return v;
}

/* ================= scene ================= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d0a);
scene.fog = new THREE.Fog(0x0b0d0a, 15, 30);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
const CAM_OFFSET = new THREE.Vector3(0, 11, 8.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xb8c8d8, 0x2c2418, 0.65));
const sun = new THREE.DirectionalLight(0xffe6c0, 1.35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;
sun.shadow.camera.bottom = -14;
scene.add(sun);
scene.add(sun.target);

/* ---------- ground: soil texture, follows the cube (infinite illusion) ---------- */
function makeGroundTexture() {
  const T = 64, N = 8; // 8x8 tiles of 64px
  const cv = document.createElement("canvas");
  cv.width = cv.height = T * N;
  const ctx = cv.getContext("2d");
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const v = hash2(i * 13 + 5, j * 17 + 3);
      const g = 26 + v * 10;
      ctx.fillStyle = `rgb(${g * 0.85 | 0}, ${g + 6 | 0}, ${g * 0.62 | 0})`;
      ctx.fillRect(i * T, j * T, T, T);
      // speckle
      for (let s = 0; s < 22; s++) {
        const sx = i * T + hash2(i * 31 + s, j * 7) * T;
        const sy = j * T + hash2(i * 3, j * 41 + s) * T;
        const sv = hash2(s * 11 + i, s * 5 + j);
        const sg = 20 + sv * 24;
        ctx.fillStyle = `rgba(${sg * 0.9 | 0}, ${sg + 8 | 0}, ${sg * 0.6 | 0}, 0.7)`;
        ctx.fillRect(sx, sy, 2 + sv * 3, 2 + sv * 3);
      }
      // subtle tile edge
      ctx.strokeStyle = "rgba(70, 88, 52, 0.28)";
      ctx.lineWidth = 2;
      ctx.strokeRect(i * T + 1, j * T + 1, T - 2, T - 2);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const GROUND_SIZE = 60;
const groundTex = makeGroundTexture();
groundTex.repeat.set(GROUND_SIZE / 8, GROUND_SIZE / 8);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
  new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function snapGround() {
  // snap to whole tiles so the texture pattern appears world-fixed
  const gx = Math.round(cubeMesh.position.x / 8) * 8;
  const gz = Math.round(cubeMesh.position.z / 8) * 8;
  ground.position.set(gx + 0.5, 0, gz + 0.5);
}

/* ---------- world props: rocks (obstacles), tufts, pebbles ---------- */
const worldMeshes = new Map(); // key -> Group | null
const rockGeo = new THREE.IcosahedronGeometry(0.45, 0);
const rockMats = [0x6b6257, 0x5d564c, 0x756a5a].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 })
);
const tuftGeo = new THREE.ConeGeometry(0.045, 0.22, 5);
const tuftMat = new THREE.MeshStandardMaterial({ color: 0x4a6b30, roughness: 0.9 });
const pebbleGeo = new THREE.SphereGeometry(0.06, 6, 5);
const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x555048, roughness: 0.95 });

function buildTileProp(ix, iz) {
  const g = new THREE.Group();
  const p = tileToWorld(ix, iz);
  if (isObstacle(ix, iz)) {
    const rock = new THREE.Mesh(rockGeo, rockMats[(hash2(ix + 7, iz + 3) * 3) | 0]);
    rock.scale.set(
      0.8 + hash2(ix, iz + 50) * 0.45,
      0.6 + hash2(ix + 50, iz) * 0.5,
      0.8 + hash2(ix - 50, iz) * 0.45
    );
    rock.rotation.set(hash2(ix, iz + 9) * 0.5, hash2(ix + 9, iz) * Math.PI * 2, hash2(ix, iz - 9) * 0.5);
    rock.position.set(p.x, 0.22, p.z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    g.add(rock);
  } else {
    const d = hash2(ix + 500, iz - 500);
    if (d < 0.045) {
      for (let i = 0; i < 3; i++) {
        const t = new THREE.Mesh(tuftGeo, tuftMat);
        t.position.set(
          p.x + (hash2(ix + i, iz) - 0.5) * 0.5,
          0.1,
          p.z + (hash2(ix, iz + i) - 0.5) * 0.5
        );
        t.rotation.z = (hash2(ix + i, iz + i) - 0.5) * 0.5;
        g.add(t);
      }
    } else if (d < 0.085) {
      const pb = new THREE.Mesh(pebbleGeo, pebbleMat);
      pb.position.set(
        p.x + (hash2(ix + 99, iz) - 0.5) * 0.6,
        0.03,
        p.z + (hash2(ix, iz + 99) - 0.5) * 0.6
      );
      pb.scale.y = 0.6;
      pb.castShadow = true;
      g.add(pb);
    } else {
      return null;
    }
  }
  return g;
}

function updateWorld() {
  const cx = S.cube.ix, cz = S.cube.iz;
  for (let x = cx - VIEW_R; x <= cx + VIEW_R; x++) {
    for (let z = cz - VIEW_R; z <= cz + VIEW_R; z++) {
      const k = key2(x, z);
      if (worldMeshes.has(k)) continue;
      const g = buildTileProp(x, z);
      if (g) scene.add(g);
      worldMeshes.set(k, g);
    }
  }
  for (const [k, g] of worldMeshes) {
    const [x, z] = k.split(",").map(Number);
    if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) > VIEW_R + 2) {
      if (g) scene.remove(g);
      worldMeshes.delete(k);
    }
  }
}

/* ================= the cube ================= */
const cubeMesh = new THREE.Mesh(
  new RoundedBoxGeometry(TILE, TILE, TILE, 4, 0.09),
  new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.55 })
);
cubeMesh.castShadow = true;
cubeMesh.receiveShadow = true;
scene.add(cubeMesh);

// a simple face so it has personality (it tumbles along, that's the charm)
{
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
  for (const sx of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), eyeMat);
    eye.position.set(sx, 0.1, 0.48);
    eye.scale.z = 0.55;
    cubeMesh.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), pupilMat);
    pupil.position.set(sx, 0.1, 0.53);
    pupil.scale.z = 0.5;
    cubeMesh.add(pupil);
  }
}

function placeCube() {
  const p = tileToWorld(S.cube.ix, S.cube.iz);
  cubeMesh.position.set(p.x, TILE / 2, p.z);
  cubeMesh.quaternion.identity();
}

/* ================= parasite meshes (cartoony critters) ================= */
function makeEyes(parent, x, y, z, spread, size = 0.028) {
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), eyeMat);
    e.position.set(x, y, z + s * spread);
    parent.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(size * 0.5, 6, 5), pupilMat);
    p.position.set(x + size * 0.6, y, z + s * spread);
    parent.add(p);
  }
}

function makeWormMesh() {
  const g = new THREE.Group();
  const matA = new THREE.MeshStandardMaterial({ color: 0x77c04a, roughness: 0.45 });
  const matB = new THREE.MeshStandardMaterial({ color: 0x5da838, roughness: 0.45 });
  const segs = [];
  for (let i = 0; i < 5; i++) {
    const r = 0.1 - i * 0.012;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), i % 2 ? matB : matA);
    seg.position.set(-i * 0.13, r, 0);
    seg.castShadow = true;
    g.add(seg);
    segs.push(seg);
  }
  makeEyes(g, 0.07, 0.14, 0, 0.05);
  g.userData.segs = segs;
  g.userData.animate = (t) => {
    segs.forEach((s, i) => {
      const r = 0.1 - i * 0.012;
      s.position.y = r + Math.max(0, Math.sin(t * 7 - i * 0.9)) * 0.05;
      s.position.x = -i * 0.13 + Math.sin(t * 7 - i * 0.9) * 0.015;
    });
  };
  return g;
}

function makeBugMesh() {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xb03a28, roughness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.5 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), shellMat);
  shell.scale.set(1.25, 0.75, 1);
  shell.position.y = 0.11;
  shell.castShadow = true;
  g.add(shell);
  // shell split line
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.012), darkMat);
  line.position.y = 0.215;
  g.add(line);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), darkMat);
  head.position.set(0.19, 0.09, 0);
  g.add(head);
  makeEyes(g, 0.24, 0.11, 0, 0.04, 0.022);
  // antennae
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12), darkMat);
    a.position.set(0.24, 0.17, s * 0.03);
    a.rotation.z = -0.7;
    a.rotation.x = s * 0.4;
    g.add(a);
  }
  const legs = [];
  for (let i = -1; i <= 1; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.14), darkMat);
      leg.position.set(i * 0.09, 0.055, s * 0.14);
      leg.rotation.x = s * 0.75;
      g.add(leg);
      legs.push({ m: leg, ph: i + (s > 0 ? 0.5 : 0), s });
    }
  }
  g.userData.legs = legs;
  g.userData.animate = (t) => {
    for (const l of legs) l.m.rotation.x = l.s * 0.75 + Math.sin(t * 18 + l.ph * 2.1) * 0.3;
  };
  return g;
}

function makeSpiderMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3c2a4e, roughness: 0.5 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x241a30, roughness: 0.6 });
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), bodyMat);
  abdomen.position.set(-0.1, 0.17, 0);
  abdomen.scale.set(1.15, 1, 1);
  abdomen.castShadow = true;
  g.add(abdomen);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), bodyMat);
  head.position.set(0.09, 0.13, 0);
  g.add(head);
  // red eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xd83a3a, emissive: 0x661111 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), eyeMat);
    e.position.set(0.16, 0.15, s * 0.035);
    g.add(e);
  }
  const legs = [];
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.007, 0.32), legMat);
      leg.position.set(i * 0.075 - 0.12, 0.14, s * 0.16);
      leg.rotation.x = s * 1.05;
      leg.rotation.z = (i - 1.5) * 0.2;
      g.add(leg);
      legs.push({ m: leg, ph: i + (s > 0 ? 0.5 : 0), s, bz: (i - 1.5) * 0.2 });
    }
  }
  g.userData.legs = legs;
  g.userData.animate = (t) => {
    for (const l of legs) l.m.rotation.x = l.s * 1.05 + Math.sin(t * 14 + l.ph * 1.9) * 0.25;
  };
  return g;
}

/* ================= parasites: spawn & movement ================= */
function spawnParasite() {
  if (S.parasites.length >= MAX_PARASITES) return;
  const roll = Math.random();
  let type;
  if (roll < Math.max(0.35, 0.8 - S.time * 0.01)) type = "worm";
  else if (roll < 0.85) type = "bug";
  else type = "spider";
  const def = TYPES[type];

  // spawn in a ring around the cube, outside the fog-lit area's centre
  let ix, iz, tries = 0;
  do {
    const a = Math.random() * Math.PI * 2;
    const r = SPAWN_R_MIN + Math.random() * (SPAWN_R_MAX - SPAWN_R_MIN);
    ix = S.cube.ix + Math.round(Math.cos(a) * r);
    iz = S.cube.iz + Math.round(Math.sin(a) * r);
    tries++;
  } while (isObstacle(ix, iz) && tries < 8);
  if (isObstacle(ix, iz)) return;

  const mesh =
    type === "worm" ? makeWormMesh() :
    type === "bug" ? makeBugMesh() :
    makeSpiderMesh();
  const p = tileToWorld(ix, iz);
  mesh.position.copy(p);
  scene.add(mesh);

  S.parasites.push({
    type, def, mesh,
    ix, iz,
    fromPos: p.clone(), toPos: p.clone(),
    moveT: 1,
    moveTimer: Math.random() * 0.5,
    state: "crawl",          // crawl | attached
    climb: 0,
    localN: new THREE.Vector3(),  // cube-local normal of the face it clings to
    animT: Math.random() * 10,
  });
}

function freeTile(ix, iz) {
  return !isObstacle(ix, iz);
}

function stepParasite(pz) {
  const dx = S.cube.ix - pz.ix;
  const dz = S.cube.iz - pz.iz;

  let sx = 0, sz = 0;
  const preferX = Math.abs(dx) > Math.abs(dz) || (Math.abs(dx) === Math.abs(dz) && Math.random() < 0.5);
  if (pz.type === "spider" && Math.random() < 0.35) {
    if (preferX) sz = Math.sign(dz) || (Math.random() < 0.5 ? 1 : -1);
    else sx = Math.sign(dx) || (Math.random() < 0.5 ? 1 : -1);
  } else {
    if (preferX) sx = Math.sign(dx);
    else sz = Math.sign(dz);
  }
  if (sx === 0 && sz === 0) return;

  let nx = pz.ix + sx, nz = pz.iz + sz;

  // blocked by a rock? try the other axis, else wait
  if (isObstacle(nx, nz) && !(nx === S.cube.ix && nz === S.cube.iz)) {
    if (sx !== 0 && Math.sign(dz) !== 0 && freeTile(pz.ix, pz.iz + Math.sign(dz))) {
      sx = 0; sz = Math.sign(dz);
    } else if (sz !== 0 && Math.sign(dx) !== 0 && freeTile(pz.ix + Math.sign(dx), pz.iz)) {
      sz = 0; sx = Math.sign(dx);
    } else {
      const opts = [[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b]) => freeTile(pz.ix+a, pz.iz+b));
      if (!opts.length) return;
      [sx, sz] = opts[(Math.random() * opts.length) | 0];
    }
    nx = pz.ix + sx; nz = pz.iz + sz;
  }

  // stepping into the cube's tile => latch onto that face and start climbing
  if (nx === S.cube.ix && nz === S.cube.iz) {
    pz.state = "attached";
    pz.climb = 0;
    // world-side normal it grabbed, stored in cube-local space so it rides the face
    const worldN = new THREE.Vector3(-sx, 0, -sz).normalize();
    pz.localN.copy(worldN).applyQuaternion(cubeMesh.quaternion.clone().invert());
    playLatch();
    return;
  }

  pz.ix = nx; pz.iz = nz;
  pz.fromPos.copy(pz.mesh.position);
  pz.fromPos.y = 0;
  pz.toPos.copy(tileToWorld(nx, nz));
  pz.moveT = 0;
  pz.mesh.rotation.set(0, Math.atan2(sx, sz) - Math.PI / 2, 0);
}

function removeParasite(pz) {
  scene.remove(pz.mesh);
  S.parasites.splice(S.parasites.indexOf(pz), 1);
}

/* ================= splat effects (blob texture, no perfect circles) ================= */
function makeSplatTexture(seed) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff";
  // main blob
  ctx.beginPath();
  ctx.arc(64, 64, 26, 0, Math.PI * 2);
  ctx.fill();
  // irregular lobes + droplets
  for (let i = 0; i < 14; i++) {
    const a = hash2(seed, i) * Math.PI * 2;
    const r = 18 + hash2(seed + 1, i) * 34;
    const s = 4 + hash2(seed + 2, i) * 12;
    ctx.beginPath();
    ctx.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, s, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}
const splatTextures = [makeSplatTexture(1), makeSplatTexture(2), makeSplatTexture(3)];
const splatGeo = new THREE.PlaneGeometry(1, 1);
splatGeo.rotateX(-Math.PI / 2);

function splat(worldPos, color, big = false) {
  const n = big ? 20 : 13;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.03 + Math.random() * 0.05, 6, 5),
      new THREE.MeshBasicMaterial({ color, transparent: true })
    );
    m.position.copy(worldPos);
    m.position.y = 0.15;
    scene.add(m);
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 2.5;
    S.particles.push({
      mesh: m,
      vel: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp),
      life: 0.7 + Math.random() * 0.3,
      t: 0,
    });
  }
  const d = new THREE.Mesh(
    splatGeo,
    new THREE.MeshBasicMaterial({
      map: splatTextures[(Math.random() * 3) | 0],
      color,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  d.renderOrder = 1;
  d.position.set(worldPos.x, 0.015, worldPos.z);
  d.rotation.y = Math.random() * Math.PI * 2;
  const s = (big ? 1.3 : 0.95) + Math.random() * 0.3;
  d.scale.set(s, 1, s);
  scene.add(d);
  S.decals.push({ mesh: d, t: 0, life: 8 });
  if (S.decals.length > 36) {
    const old = S.decals.shift();
    scene.remove(old.mesh);
  }
}

/* ================= audio (synthesized, no files) ================= */
let AC = null;
function audio() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === "suspended") AC.resume();
  return AC;
}
function env(node, t0, peak, dur) {
  const g = audio().createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  node.connect(g).connect(audio().destination);
  return g;
}
let NOISE = null;
function noiseBuffer() {
  const ac = audio();
  const b = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function playThud(strong = false) {
  const ac = audio(), t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(strong ? 110 : 85, t);
  o.frequency.exponentialRampToValueAtTime(35, t + 0.12);
  env(o, t, strong ? 0.5 : 0.22, 0.14);
  o.start(t); o.stop(t + 0.16);
}
function playSplat() {
  const ac = audio(), t = ac.currentTime;
  if (!NOISE) NOISE = noiseBuffer();
  const src = ac.createBufferSource();
  src.buffer = NOISE;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(250, t + 0.12);
  f.Q.value = 1.2;
  src.connect(f);
  env(f, t, 0.4, 0.16);
  src.start(t); src.stop(t + 0.2);
}
function playKnock() {
  const ac = audio(), t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.06);
  env(o, t, 0.15, 0.08);
  o.start(t); o.stop(t + 0.1);
}
function playLatch() {
  const ac = audio(), t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(300, t);
  o.frequency.linearRampToValueAtTime(520, t + 0.09);
  env(o, t, 0.12, 0.12);
  o.start(t); o.stop(t + 0.14);
}
function playHurt() {
  const ac = audio(), t = ac.currentTime;
  const o = ac.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.3);
  env(o, t, 0.3, 0.32);
  o.start(t); o.stop(t + 0.35);
}
function playRampage() {
  const ac = audio(), t = ac.currentTime;
  [523, 659, 784, 1046].forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    env(o, t + i * 0.06, 0.18, 0.15);
    o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.18);
  });
}

/* ================= scoring / HUD ================= */
const $ = (id) => document.getElementById(id);
const scoreEl = $("score"), bestEl = $("best"), comboLabel = $("combo-label"),
  comboBar = $("combo-bar"), banner = $("rampage-banner"), streakEl = $("streak"),
  livesEl = $("lives"), flash = $("damage-flash"), popups = $("popups"),
  warning = $("warning");

function updateHUD() {
  scoreEl.textContent = S.score;
  bestEl.textContent = "BEST " + Math.max(S.best, S.score);
  livesEl.innerHTML = [0, 1, 2]
    .map((i) => `<span class="${i < S.lives ? "" : "lost"}">&#10084;</span>`)
    .join("");
  streakEl.textContent = S.streak >= 3 ? `${S.streak} STREAK` : "";
}

function popup(worldPos, text, cls = "") {
  const v = worldPos.clone().project(camera);
  const el = document.createElement("div");
  el.className = "popup " + cls;
  el.textContent = text;
  el.style.left = ((v.x + 1) / 2) * innerWidth + "px";
  el.style.top = ((1 - v.y) / 2) * innerHeight + "px";
  popups.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

function addKill(pz, atPos) {
  S.totalKills++;
  S.streak++;
  S.combo++;
  S.comboTimer = COMBO_WINDOW;
  const wasRampage = S.rampage;
  if (S.combo >= RAMPAGE_AT) S.rampage = true;
  if (S.rampage && !wasRampage) {
    playRampage();
    banner.classList.add("on");
  }
  const mult = Math.min(S.combo, 8) * (S.rampage ? 2 : 1);
  const pts = pz.def.points * mult;
  S.score += pts;
  scoreEl.classList.add("pop");
  setTimeout(() => scoreEl.classList.remove("pop"), 90);
  popup(atPos, `+${pts}`, S.rampage ? "rampage big" : mult > 2 ? "big" : "");
  updateHUD();
}

function endCombo() {
  S.combo = 0;
  S.rampage = false;
  banner.classList.remove("on");
  comboLabel.textContent = "";
  comboBar.style.width = "0%";
}

function takeDamage() {
  S.lives--;
  S.streak = 0;
  endCombo();
  playHurt();
  S.shake = 0.5;
  flash.classList.remove("on");
  void flash.offsetWidth;
  flash.classList.add("on");
  updateHUD();
  if (S.lives <= 0) gameOver();
}

/* ================= squash ================= */
function crushList(victims, strongThud) {
  if (!victims.length) return;
  for (const pz of victims) {
    splat(pz.mesh.position.clone().setY(0), pz.def.goo, pz.type === "spider");
    addKill(pz, pz.mesh.position.clone());
    removeParasite(pz);
  }
  playThud(strongThud || victims.length > 1);
  playSplat();
  S.shake = Math.min(0.35, 0.12 + victims.length * 0.08);
}

function squashAt(ix, iz) {
  const victims = S.parasites.filter((p) => p.state === "crawl" && p.ix === ix && p.iz === iz);
  crushList(victims, victims.some((v) => v.type === "spider"));
}

// after a roll: faces that ended up on the ground crush their riders;
// faces that ended up on top mean the parasite made it — you get bitten.
function resolveAttachedAfterRoll() {
  const crushed = [], reachedTop = [];
  for (const pz of S.parasites) {
    if (pz.state !== "attached") continue;
    const worldN = pz.localN.clone().applyQuaternion(cubeMesh.quaternion);
    if (worldN.y < -0.5) crushed.push(pz);
    else if (worldN.y > 0.5) reachedTop.push(pz);
  }
  crushList(crushed, true);
  for (const pz of reachedTop) {
    splat(cubeMesh.position.clone().setY(0), 0xc23a3a, false);
    removeParasite(pz);
    takeDamage();
  }
}

/* ================= rolling ================= */
function tryRoll(dx, dz) {
  if (!S.running) return;
  if (S.rolling) { S.queuedDir = [dx, dz]; return; }
  const nx = S.cube.ix + dx, nz = S.cube.iz + dz;
  if (isObstacle(nx, nz)) {
    playKnock();
    S.shake = Math.max(S.shake, 0.08);
    return;
  }
  const anchor = cubeMesh.position.clone().add(new THREE.Vector3(dx * 0.5, -0.5, dz * 0.5));
  S.rolling = {
    t: 0,
    anchor,
    axis: new THREE.Vector3(dz, 0, -dx),
    startOffset: cubeMesh.position.clone().sub(anchor),
    startQuat: cubeMesh.quaternion.clone(),
    nx, nz,
  };
}

function updateRoll(dt) {
  const r = S.rolling;
  if (!r) return;
  r.t += dt / ROLL_TIME;
  const t = Math.min(r.t, 1);
  const angle = t * (Math.PI / 2);
  const q = new THREE.Quaternion().setFromAxisAngle(r.axis, angle);
  cubeMesh.position.copy(r.startOffset).applyQuaternion(q).add(r.anchor);
  cubeMesh.quaternion.copy(q).multiply(r.startQuat);

  if (t >= 1) {
    S.cube.ix = r.nx;
    S.cube.iz = r.nz;
    const p = tileToWorld(r.nx, r.nz);
    cubeMesh.position.set(p.x, TILE / 2, p.z);
    S.rolling = null;
    playThud(false);
    S.shake = Math.max(S.shake, 0.06);
    squashAt(r.nx, r.nz);
    resolveAttachedAfterRoll();
    updateWorld();
    if (S.queuedDir) {
      const [dx, dz] = S.queuedDir;
      S.queuedDir = null;
      tryRoll(dx, dz);
    }
  }
}

/* ================= game flow ================= */
function resetGame() {
  for (const pz of [...S.parasites]) removeParasite(pz);
  for (const pt of S.particles) scene.remove(pt.mesh);
  for (const d of S.decals) scene.remove(d.mesh);
  S.particles = [];
  S.decals = [];
  Object.assign(S, {
    running: true, time: 0, score: 0, lives: 3,
    combo: 0, comboTimer: 0, rampage: false, streak: 0,
    totalKills: 0, spawnTimer: 0,
    cube: { ix: 0, iz: 0 },
    rolling: null, queuedDir: null, shake: 0,
  });
  endCombo();
  placeCube();
  updateWorld();
  updateHUD();
}

function gameOver() {
  S.running = false;
  S.best = Math.max(S.best, S.score);
  localStorage.setItem("crush-best", S.best);
  $("final-score").textContent = S.score + " POINTS";
  $("final-best").textContent = "BEST " + S.best;
  $("final-stats").textContent = `${S.totalKills} parasites crushed`;
  $("gameover-screen").classList.remove("hidden");
  endCombo();
}

$("start-btn").addEventListener("click", () => {
  audio();
  $("start-screen").classList.add("hidden");
  resetGame();
});
$("restart-btn").addEventListener("click", () => {
  $("gameover-screen").classList.add("hidden");
  resetGame();
});

/* ================= input ================= */
const KEYMAP = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};
addEventListener("keydown", (e) => {
  if (KEYMAP[e.code]) {
    e.preventDefault();
    audio();
    tryRoll(...KEYMAP[e.code]);
  }
  if (e.code === "KeyR" && !S.running && !$("gameover-screen").classList.contains("hidden")) {
    $("gameover-screen").classList.add("hidden");
    resetGame();
  }
});

/* ================= main loop ================= */
placeCube();
updateWorld();
updateHUD();
camera.position.copy(cubeMesh.position).add(CAM_OFFSET);
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  let anyAttached = false;

  if (S.running) {
    S.time += dt;

    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0) {
      spawnParasite();
      const interval = Math.max(0.55, 2.2 - S.time * 0.022);
      S.spawnTimer = interval * (0.7 + Math.random() * 0.6);
    }

    if (S.combo > 0) {
      S.comboTimer -= dt;
      comboLabel.textContent = `x${Math.min(S.combo, 8)}${S.rampage ? " RAMPAGE" : " COMBO"}`;
      comboLabel.classList.toggle("rampage", S.rampage);
      comboBar.style.width = (S.comboTimer / COMBO_WINDOW) * 100 + "%";
      if (S.comboTimer <= 0) endCombo();
    }

    updateRoll(dt);

    for (const pz of [...S.parasites]) {
      pz.animT += dt;
      if (pz.state === "crawl") {
        if (pz.moveT < 1) {
          pz.moveT = Math.min(1, pz.moveT + dt / (pz.def.interval * 0.55));
          pz.mesh.position.lerpVectors(pz.fromPos, pz.toPos, pz.moveT);
        }
        pz.moveTimer += dt;
        if (pz.moveTimer >= pz.def.interval) {
          pz.moveTimer = 0;
          stepParasite(pz);
        }
        pz.mesh.userData.animate(pz.animT);
        // wandered too far behind? recycle it
        if (Math.max(Math.abs(pz.ix - S.cube.ix), Math.abs(pz.iz - S.cube.iz)) > DESPAWN_R) {
          removeParasite(pz);
        }
      } else {
        anyAttached = true;
        pz.climb += dt / BITE_TIME;
        const worldN = pz.localN.clone().applyQuaternion(cubeMesh.quaternion);
        pz.mesh.position.copy(cubeMesh.position).addScaledVector(worldN, 0.56);
        pz.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), worldN);
        pz.mesh.userData.animate(pz.animT * 1.6);
        // panic pulse as it gets close to biting
        if (pz.climb > 0.55) {
          const p = 1 + Math.sin(pz.animT * 16) * 0.12 * pz.climb;
          pz.mesh.scale.set(p, p, p);
        }
        if (pz.climb >= 1) {
          splat(cubeMesh.position.clone().setY(0), 0xc23a3a, false);
          removeParasite(pz);
          takeDamage();
        }
      }
    }

    warning.classList.toggle("on", anyAttached);
  }

  // particles
  for (const pt of [...S.particles]) {
    pt.t += dt;
    pt.vel.y -= 12 * dt;
    pt.mesh.position.addScaledVector(pt.vel, dt);
    if (pt.mesh.position.y < 0.03) {
      pt.mesh.position.y = 0.03;
      pt.vel.set(0, 0, 0);
    }
    pt.mesh.material.opacity = 1 - pt.t / pt.life;
    if (pt.t >= pt.life) {
      scene.remove(pt.mesh);
      S.particles.splice(S.particles.indexOf(pt), 1);
    }
  }

  // decals fade
  for (const d of [...S.decals]) {
    d.t += dt;
    if (d.t > d.life * 0.5) {
      d.mesh.material.opacity = 0.7 * (1 - (d.t - d.life * 0.5) / (d.life * 0.5));
    }
    if (d.t >= d.life) {
      scene.remove(d.mesh);
      S.decals.splice(S.decals.indexOf(d), 1);
    }
  }

  // ground + light follow the cube
  snapGround();
  sun.position.copy(cubeMesh.position).add(new THREE.Vector3(6, 14, 4));
  sun.target.position.copy(cubeMesh.position);

  // camera follow + shake
  const target = cubeMesh.position.clone();
  camera.position.lerp(target.clone().add(CAM_OFFSET), 0.08);
  if (S.shake > 0) {
    S.shake = Math.max(0, S.shake - dt * 1.8);
    camera.position.x += (Math.random() - 0.5) * S.shake * 0.4;
    camera.position.y += (Math.random() - 0.5) * S.shake * 0.4;
  }
  camera.lookAt(target.x, 0, target.z);

  renderer.render(scene, camera);
}
tick();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
