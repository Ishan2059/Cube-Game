import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  TYPES,
  makeParasiteMesh,
  type ParasiteType,
  type ParasiteDef,
} from "./parasites";
import {
  audio,
  playThud,
  playSplat,
  playKnock,
  playLatch,
  playBite,
  playHeal,
  playRampage,
} from "./audio";
import { LEVELS, type Level } from "./levels";

/* ================= constants ================= */
const TILE = 1;
const ROLL_TIME = 0.14; // seconds per roll
const BITE_DAMAGE = 0.25; // fraction of one health icon lost per bite
const COMBO_WINDOW = 2.5; // seconds to keep a combo alive
const RAMPAGE_AT = 4; // combo count that triggers rampage
const MAX_PARASITES = 24;
const VIEW_R = 14; // world generation radius (tiles)
const SPAWN_R_MIN = 9,
  SPAWN_R_MAX = 12;
const DESPAWN_R = 18;
// health pickups (hearts)
const HEART_SPAWN_MIN = 6,
  HEART_SPAWN_MAX = 11;
const HEART_DESPAWN_R = 16; // roll past this and it's gone
const HEART_LIFE = 30; // seconds solid on the map
const HEART_BLINK = 3; // then blinks this long before vanishing
const GROUND_SIZE = 60;
const CAM_OFFSET = new THREE.Vector3(0, 11, 8.5);
const SUN_OFFSET = new THREE.Vector3(6, 14, 4);
const UP = new THREE.Vector3(0, 1, 0);

/* ================= pure helpers ================= */
const tileToWorld = (ix: number, iz: number) =>
  new THREE.Vector3(ix * TILE, 0, iz * TILE);
const key2 = (x: number, z: number) => x + "," + z;

// deterministic per-tile hash (same world layout every run)
function hash2(x: number, z: number) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

const obstacleCache = new Map<string, boolean>();
function isObstacle(ix: number, iz: number) {
  const k = key2(ix, iz);
  const cached = obstacleCache.get(k);
  if (cached !== undefined) return cached;
  let v = hash2(ix, iz) < 0.065;
  if (Math.abs(ix) <= 1 && Math.abs(iz) <= 1) v = false; // safe start zone
  obstacleCache.set(k, v);
  return v;
}

function makeGroundTexture() {
  const T = 64,
    N = 8; // 8x8 tiles of 64px
  const cv = document.createElement("canvas");
  cv.width = cv.height = T * N;
  const ctx = cv.getContext("2d")!;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const v = hash2(i * 13 + 5, j * 17 + 3);
      const g = 26 + v * 10;
      ctx.fillStyle = `rgb(${(g * 0.85) | 0}, ${(g + 6) | 0}, ${(g * 0.62) | 0})`;
      ctx.fillRect(i * T, j * T, T, T);
      // speckle
      for (let s = 0; s < 22; s++) {
        const sx = i * T + hash2(i * 31 + s, j * 7) * T;
        const sy = j * T + hash2(i * 3, j * 41 + s) * T;
        const sv = hash2(s * 11 + i, s * 5 + j);
        const sg = 20 + sv * 24;
        ctx.fillStyle = `rgba(${(sg * 0.9) | 0}, ${(sg + 8) | 0}, ${(sg * 0.6) | 0}, 0.7)`;
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

function makeSplatTexture(seed: number) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
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
  return new THREE.CanvasTexture(cv);
}

function makeHeartMesh(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff4d6a,
    emissive: 0x7a1526,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });
  const lobeGeo = new THREE.SphereGeometry(0.13, 14, 12);
  for (const sx of [-0.09, 0.09]) {
    const lobe = new THREE.Mesh(lobeGeo, mat);
    lobe.position.set(sx, 0.09, 0);
    g.add(lobe);
  }
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.3, 16), mat);
  point.position.set(0, -0.15, 0);
  point.rotation.x = Math.PI; // apex down
  g.add(point);
  g.scale.set(0.85, 0.85, 0.85);
  return g;
}

// free GPU resources of an object we're done with for good (not pooled ones)
function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/* ================= types ================= */
interface Heart {
  mesh: THREE.Group;
  ix: number;
  iz: number;
  t: number;
}

interface Parasite {
  type: ParasiteType;
  def: ParasiteDef;
  mesh: THREE.Group;
  ix: number;
  iz: number;
  prevIx: number; // tile it's sliding out of (occupied until moveT reaches 1)
  prevIz: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  moveT: number;
  moveTimer: number;
  state: "crawl" | "attached";
  biteTimer: number; // seconds until this latched parasite bites
  localN: THREE.Vector3;
  animT: number;
}

interface RollState {
  t: number;
  anchor: THREE.Vector3;
  axis: THREE.Vector3;
  startOffset: THREE.Vector3;
  startQuat: THREE.Quaternion;
  nx: number;
  nz: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  t: number;
}
interface Decal {
  mesh: THREE.Mesh;
  t: number;
  life: number;
}

interface GameState {
  running: boolean;
  paused: boolean;
  time: number;
  score: number;
  best: number;
  level: number;
  lives: number;
  combo: number;
  comboTimer: number;
  rampage: boolean;
  streak: number;
  totalKills: number;
  spawnTimer: number;
  cube: { ix: number; iz: number };
  rolling: RollState | null;
  queuedDir: [number, number] | null;
  parasites: Parasite[];
  particles: Particle[];
  decals: Decal[];
  shake: number;
  glow: number; // current red bite-glow opacity
  glowHold: number; // seconds to hold the glow before it decays
  heart: Heart | null;
  heartCooldown: number; // seconds until the next heart may spawn
}

/* ================= entry point ================= */
// Boots a fresh game inside `container`, returns a disposer that tears the
// whole thing down (RAF loop, listeners, GL context) for React unmount.
export function startGame(container: HTMLElement): () => void {
  /* ---------- state ---------- */
  const S: GameState = {
    running: false,
    paused: false,
    time: 0,
    score: 0,
    best: Number(localStorage.getItem("crush-best") || 0),
    level: 0,
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
    glow: 0,
    glowHold: 0,
    heart: null,
    heartCooldown: 25,
  };

  // reusable scratch vectors — avoid per-frame allocation in the hot loop
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();

  /* ---------- scene ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d0a);
  scene.fog = new THREE.Fog(0x0b0d0a, 15, 30);

  const camera = new THREE.PerspectiveCamera(
    50,
    innerWidth / innerHeight,
    0.1,
    100,
  );

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  // cap DPR lower on phones — huge fill-rate/thermal saving, imperceptible
  const DPR_CAP = matchMedia("(pointer: coarse)").matches ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio, DPR_CAP));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

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
  const groundTex = makeGroundTexture();
  groundTex.repeat.set(GROUND_SIZE / 8, GROUND_SIZE / 8);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }),
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
  const worldMeshes = new Map<string, THREE.Group | null>();
  const rockGeo = new THREE.IcosahedronGeometry(0.45, 0);
  const rockMats = [0x6b6257, 0x5d564c, 0x756a5a].map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        flatShading: true,
        roughness: 0.9,
      }),
  );
  const tuftGeo = new THREE.ConeGeometry(0.045, 0.22, 5);
  const tuftMat = new THREE.MeshStandardMaterial({
    color: 0x4a6b30,
    roughness: 0.9,
  });
  const pebbleGeo = new THREE.SphereGeometry(0.06, 6, 5);
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: 0x555048,
    roughness: 0.95,
  });

  function buildTileProp(ix: number, iz: number): THREE.Group | null {
    const g = new THREE.Group();
    const p = tileToWorld(ix, iz);
    if (isObstacle(ix, iz)) {
      const rock = new THREE.Mesh(
        rockGeo,
        rockMats[(hash2(ix + 7, iz + 3) * 3) | 0],
      );
      rock.scale.set(
        0.8 + hash2(ix, iz + 50) * 0.45,
        0.6 + hash2(ix + 50, iz) * 0.5,
        0.8 + hash2(ix - 50, iz) * 0.45,
      );
      rock.rotation.set(
        hash2(ix, iz + 9) * 0.5,
        hash2(ix + 9, iz) * Math.PI * 2,
        hash2(ix, iz - 9) * 0.5,
      );
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
            p.z + (hash2(ix, iz + i) - 0.5) * 0.5,
          );
          t.rotation.z = (hash2(ix + i, iz + i) - 0.5) * 0.5;
          g.add(t);
        }
      } else if (d < 0.085) {
        const pb = new THREE.Mesh(pebbleGeo, pebbleMat);
        pb.position.set(
          p.x + (hash2(ix + 99, iz) - 0.5) * 0.6,
          0.03,
          p.z + (hash2(ix, iz + 99) - 0.5) * 0.6,
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
    const cx = S.cube.ix,
      cz = S.cube.iz;
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

  /* ---------- the cube ---------- */
  const cubeMesh = new THREE.Mesh(
    new RoundedBoxGeometry(TILE, TILE, TILE, 4, 0.09),
    new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.55 }),
  );
  cubeMesh.castShadow = true;
  cubeMesh.receiveShadow = true;
  scene.add(cubeMesh);

  // a simple face so it has personality (it tumbles along, that's the charm)
  {
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.4,
    });
    for (const sx of [-0.16, 0.16]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 12, 10),
        eyeMat,
      );
      eye.position.set(sx, 0.1, 0.48);
      eye.scale.z = 0.55;
      cubeMesh.add(eye);
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 6),
        pupilMat,
      );
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

  /* ---------- parasites: spawn & movement ---------- */
  // parasite mesh pool by type — bugs spawn/despawn constantly; reuse the
  // Groups instead of rebuilding (and leaking) their meshes+materials each time
  const parasitePools: Record<ParasiteType, THREE.Group[]> = {
    worm: [],
    bug: [],
    spider: [],
    scorpion: [],
    beetle: [],
  };
  function acquireParasiteMesh(type: ParasiteType): THREE.Group {
    const m = parasitePools[type].pop() ?? makeParasiteMesh(type);
    m.visible = true;
    m.rotation.set(0, 0, 0);
    m.scale.setScalar(1);
    return m;
  }
  function releaseParasiteMesh(type: ParasiteType, mesh: THREE.Group) {
    scene.remove(mesh);
    parasitePools[type].push(mesh);
  }

  // weighted pick from the current level's spawn mix
  function pickType(): ParasiteType {
    const w = LEVELS[S.level].weights;
    let total = 0;
    for (const k in w) total += w[k as ParasiteType]!;
    let r = Math.random() * total;
    for (const k in w) {
      r -= w[k as ParasiteType]!;
      if (r < 0) return k as ParasiteType;
    }
    return "worm";
  }

  function spawnParasite() {
    if (S.parasites.length >= MAX_PARASITES) return;
    const type = pickType();
    const def = TYPES[type];

    // spawn in a ring around the cube, outside the fog-lit area's centre
    let ix = 0,
      iz = 0,
      tries = 0;
    do {
      const a = Math.random() * Math.PI * 2;
      const r = SPAWN_R_MIN + Math.random() * (SPAWN_R_MAX - SPAWN_R_MIN);
      ix = S.cube.ix + Math.round(Math.cos(a) * r);
      iz = S.cube.iz + Math.round(Math.sin(a) * r);
      tries++;
    } while (isObstacle(ix, iz) && tries < 8);
    if (isObstacle(ix, iz)) return;

    const mesh = acquireParasiteMesh(type);
    const p = tileToWorld(ix, iz);
    mesh.position.copy(p);
    scene.add(mesh);

    S.parasites.push({
      type,
      def,
      mesh,
      ix,
      iz,
      prevIx: ix,
      prevIz: iz,
      fromPos: p.clone(),
      toPos: p.clone(),
      moveT: 1,
      moveTimer: Math.random() * 0.5,
      state: "crawl", // crawl | attached
      biteTimer: 0,
      localN: new THREE.Vector3(), // cube-local normal of the face it clings to
      animT: Math.random() * 10,
    });
  }

  function freeTile(ix: number, iz: number) {
    return !isObstacle(ix, iz);
  }

  // seconds until a freshly-latched parasite bites; a level's `bite` rating
  // makes bites land sooner as well as harder (rate grows with the multiplier)
  function biteDelay() {
    const bite = LEVELS[S.level].bite;
    const rate = 1 + (bite - 1) * 0.5;
    return (1 + Math.random()) / rate;
  }

  function stepParasite(pz: Parasite) {
    const dx = S.cube.ix - pz.ix;
    const dz = S.cube.iz - pz.iz;
    const stick = LEVELS[S.level].stick;

    // sticky grab: when orthogonally adjacent to an idle cube, the parasite can
    // reach out and latch onto the facing face instead of stepping in. Scales
    // with the level's stick rating so high levels feel clingy. Never latches
    // while the cube is mid-roll — that's the crush window, and latching there
    // would let the insect evade being squashed and corrupt its cube-local
    // normal (the original "crushed bug survives" bug).
    if (
      !S.rolling &&
      Math.abs(dx) + Math.abs(dz) === 1 &&
      Math.random() < stick * 0.5
    ) {
      pz.state = "attached";
      pz.biteTimer = biteDelay();
      const worldN = new THREE.Vector3(-dx, 0, -dz).normalize();
      pz.localN.copy(worldN).applyQuaternion(cubeMesh.quaternion.clone().invert());
      playLatch();
      return;
    }

    let sx = 0,
      sz = 0;
    const preferX =
      Math.abs(dx) > Math.abs(dz) ||
      (Math.abs(dx) === Math.abs(dz) && Math.random() < 0.5);
    // beeline: spiders/scorpions wander sideways less as stick rises, so they
    // path straight for the cube at high levels
    const sidestep = 0.35 * (1 - stick) + 0.05 * stick;
    if ((pz.type === "spider" || pz.type === "scorpion") && Math.random() < sidestep) {
      if (preferX) sz = Math.sign(dz) || (Math.random() < 0.5 ? 1 : -1);
      else sx = Math.sign(dx) || (Math.random() < 0.5 ? 1 : -1);
    } else {
      if (preferX) sx = Math.sign(dx);
      else sz = Math.sign(dz);
    }
    if (sx === 0 && sz === 0) return;

    let nx = pz.ix + sx,
      nz = pz.iz + sz;

    // blocked by a rock? try the other axis, else wait
    if (isObstacle(nx, nz) && !(nx === S.cube.ix && nz === S.cube.iz)) {
      if (
        sx !== 0 &&
        Math.sign(dz) !== 0 &&
        freeTile(pz.ix, pz.iz + Math.sign(dz))
      ) {
        sx = 0;
        sz = Math.sign(dz);
      } else if (
        sz !== 0 &&
        Math.sign(dx) !== 0 &&
        freeTile(pz.ix + Math.sign(dx), pz.iz)
      ) {
        sz = 0;
        sx = Math.sign(dx);
      } else {
        const opts = (
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const
        ).filter(([a, b]) => freeTile(pz.ix + a, pz.iz + b));
        if (!opts.length) return;
        [sx, sz] = opts[(Math.random() * opts.length) | 0];
      }
      nx = pz.ix + sx;
      nz = pz.iz + sz;
    }

    // stepping into the cube's tile => latch onto that face and start climbing
    if (nx === S.cube.ix && nz === S.cube.iz) {
      if (S.rolling) return; // cube is mid-roll: don't latch, stay put and get crushed
      pz.state = "attached";
      pz.biteTimer = biteDelay(); // bites 1–2s after latching (sooner at high bite)
      // world-side normal it grabbed, stored in cube-local space so it rides the face
      const worldN = new THREE.Vector3(-sx, 0, -sz).normalize();
      pz.localN.copy(worldN).applyQuaternion(cubeMesh.quaternion.clone().invert());
      playLatch();
      return;
    }

    pz.prevIx = pz.ix;
    pz.prevIz = pz.iz;
    pz.ix = nx;
    pz.iz = nz;
    pz.fromPos.copy(pz.mesh.position);
    pz.fromPos.y = 0;
    pz.toPos.copy(tileToWorld(nx, nz));
    pz.moveT = 0;
    pz.mesh.rotation.set(0, Math.atan2(sx, sz) - Math.PI / 2, 0);
  }

  function removeParasite(pz: Parasite) {
    releaseParasiteMesh(pz.type, pz.mesh);
    S.parasites.splice(S.parasites.indexOf(pz), 1);
  }

  /* ---------- splat effects (blob texture, no perfect circles) ---------- */
  const splatTextures = [
    makeSplatTexture(1),
    makeSplatTexture(2),
    makeSplatTexture(3),
  ];
  const splatGeo = new THREE.PlaneGeometry(1, 1);
  splatGeo.rotateX(-Math.PI / 2);

  // particle pool: one shared unit-sphere geometry, meshes reused across kills
  const particleGeo = new THREE.SphereGeometry(1, 6, 5);
  const particlePool: THREE.Mesh[] = [];
  function acquireParticle(): THREE.Mesh {
    return (
      particlePool.pop() ??
      new THREE.Mesh(
        particleGeo,
        new THREE.MeshBasicMaterial({ transparent: true }),
      )
    );
  }
  function releaseParticle(m: THREE.Mesh) {
    scene.remove(m);
    particlePool.push(m);
  }

  function splat(worldPos: THREE.Vector3, color: number, big = false) {
    const n = big ? 20 : 13;
    for (let i = 0; i < n; i++) {
      const m = acquireParticle();
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.setHex(color);
      mat.opacity = 1;
      m.scale.setScalar(0.03 + Math.random() * 0.05);
      m.position.copy(worldPos);
      m.position.y = 0.15;
      scene.add(m);
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 2.5;
      S.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          Math.cos(a) * sp,
          2 + Math.random() * 3,
          Math.sin(a) * sp,
        ),
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
      }),
    );
    d.renderOrder = 1;
    d.position.set(worldPos.x, 0.015, worldPos.z);
    d.rotation.y = Math.random() * Math.PI * 2;
    const s = (big ? 1.3 : 0.95) + Math.random() * 0.3;
    d.scale.set(s, 1, s);
    scene.add(d);
    S.decals.push({ mesh: d, t: 0, life: 8 });
    if (S.decals.length > 36) {
      const old = S.decals.shift()!;
      scene.remove(old.mesh);
      (old.mesh.material as THREE.Material).dispose(); // shared geo/tex kept
    }
  }

  /* ---------- scoring / HUD ---------- */
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const scoreEl = $("score"),
    bestEl = $("best"),
    comboLabel = $("combo-label"),
    comboBar = $("combo-bar"),
    banner = $("rampage-banner"),
    streakEl = $("streak"),
    livesEl = $("lives"),
    flash = $("damage-flash"),
    popups = $("popups"),
    warning = $("warning"),
    levelEl = $("level"),
    levelupEl = $("levelup"),
    biteGlow = $("bite-glow");
  void flash; // kept for markup compatibility; bites use the glow overlay now

  function applyLevel(idx: number) {
    S.level = idx;
    const L = LEVELS[idx];
    const mat = cubeMesh.material as THREE.MeshStandardMaterial;
    mat.color.set(L.skin);
    mat.emissive.set(L.emissive ?? 0x000000);
    levelEl.textContent = `LVL ${idx + 1} · ${L.name}`;
  }

  function announceLevel(L: Level) {
    levelupEl.textContent = `LEVEL ${S.level + 1} — ${L.name}`;
    levelupEl.classList.remove("show");
    void levelupEl.offsetWidth;
    levelupEl.classList.add("show");
    playRampage();
  }

  function updateHUD() {
    scoreEl.textContent = String(S.score);
    bestEl.textContent = "BEST " + Math.max(S.best, S.score);
    // fractional hearts: each icon fills 0–100% (bites cost 25% of an icon)
    livesEl.innerHTML = [0, 1, 2]
      .map((i) => {
        const fill = Math.max(0, Math.min(1, S.lives - i));
        return `<span class="heart"><span class="heart-bg">&#10084;</span><span class="heart-fill" style="width:${fill * 100}%">&#10084;</span></span>`;
      })
      .join("");
    streakEl.textContent = S.streak >= 3 ? `${S.streak} STREAK` : "";
  }

  function popup(worldPos: THREE.Vector3, text: string, cls = "") {
    const v = worldPos.clone().project(camera);
    const el = document.createElement("div");
    el.className = "popup " + cls;
    el.textContent = text;
    el.style.left = ((v.x + 1) / 2) * innerWidth + "px";
    el.style.top = ((1 - v.y) / 2) * innerHeight + "px";
    popups.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }

  function addKill(pz: Parasite, atPos: THREE.Vector3) {
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
    // level up (a big combo can cross several thresholds at once)
    let leveled = false;
    while (LEVELS[S.level + 1] && S.score >= LEVELS[S.level + 1].at) {
      applyLevel(S.level + 1);
      leveled = true;
    }
    if (leveled) announceLevel(LEVELS[S.level]);
    updateHUD();
  }

  function endCombo() {
    S.combo = 0;
    S.rampage = false;
    banner.classList.remove("on");
    comboLabel.textContent = "";
    comboBar.style.width = "0%";
  }

  // a latched parasite bites: chip health + escalating red glow. Higher levels
  // drain more per bite (LEVELS[].bite multiplier).
  function applyBite() {
    S.lives = Math.max(0, S.lives - BITE_DAMAGE * LEVELS[S.level].bite);
    S.streak = 0;
    endCombo();
    playBite();
    S.shake = Math.max(S.shake, 0.28);
    // the lower your health, the stronger and longer the glow lingers
    const missing = (3 - S.lives) / 3; // 0 (full) → 1 (near dead)
    S.glow = Math.max(S.glow, 0.32 + missing * 0.5);
    S.glowHold = 0.12 + missing * 1.4;
    updateHUD();
    if (S.lives <= 0) gameOver();
  }

  /* ---------- health pickups (hearts) ---------- */
  function spawnHeart() {
    // place on a free tile in a reachable ring around the cube
    let ix = 0,
      iz = 0,
      ok = false;
    for (let tries = 0; tries < 12 && !ok; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = HEART_SPAWN_MIN + Math.random() * (HEART_SPAWN_MAX - HEART_SPAWN_MIN);
      ix = S.cube.ix + Math.round(Math.cos(a) * r);
      iz = S.cube.iz + Math.round(Math.sin(a) * r);
      ok = !isObstacle(ix, iz) && !(ix === S.cube.ix && iz === S.cube.iz);
    }
    if (!ok) {
      S.heartCooldown = 3; // no spot, retry soon
      return;
    }
    const mesh = makeHeartMesh();
    const p = tileToWorld(ix, iz);
    mesh.position.set(p.x, 0.5, p.z);
    scene.add(mesh);
    S.heart = { mesh, ix, iz, t: 0 };
  }

  function removeHeart() {
    if (!S.heart) return;
    scene.remove(S.heart.mesh);
    disposeObject(S.heart.mesh);
    S.heart = null;
    S.heartCooldown = 20 + Math.random() * 15; // rare: ~20–35s until next
  }

  function collectHeart() {
    S.lives = Math.min(3, S.lives + 1); // heal one full icon
    playHeal();
    popup(cubeMesh.position.clone(), "+1 ♥", "big");
    removeHeart();
    updateHUD();
  }

  /* ---------- squash ---------- */
  function crushList(victims: Parasite[], strongThud: boolean) {
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

  function squashAt(ix: number, iz: number) {
    // A crawling bug occupies BOTH tiles it's sliding between: it sets ix/iz to
    // the destination the instant it starts a step, then slides over ~interval
    // seconds while still leaving `prev`. At high levels the slide is fast, so a
    // single snapshot can miss it — instead crush if the landing tile is its
    // destination, the tile it's sliding out of, or it's visually on top.
    const c = tileToWorld(ix, iz);
    const victims = S.parasites.filter((p) => {
      if (p.state !== "crawl") return false;
      if (p.ix === ix && p.iz === iz) return true;
      if (p.moveT < 1 && p.prevIx === ix && p.prevIz === iz) return true;
      const dx = p.mesh.position.x - c.x;
      const dz = p.mesh.position.z - c.z;
      return dx * dx + dz * dz < 0.6 * 0.6;
    });
    crushList(victims, victims.some((v) => v.type === "spider"));
  }

  // Roll toward the side a bug latched on → that face rotates to the ground and
  // grinds it. Rolling other ways just lets it keep riding (and biting).
  function grindLatchedAfterRoll() {
    const crushed = S.parasites.filter((p) => {
      if (p.state !== "attached") return false;
      const worldN = _v1.copy(p.localN).applyQuaternion(cubeMesh.quaternion);
      return worldN.y < -0.5; // its face is now against the ground
    });
    crushList(crushed, true);
  }

  /* ---------- rolling ---------- */
  function tryRoll(dx: number, dz: number) {
    if (!S.running || S.paused) return;
    if (S.rolling) {
      S.queuedDir = [dx, dz];
      return;
    }
    const nx = S.cube.ix + dx,
      nz = S.cube.iz + dz;
    if (isObstacle(nx, nz)) {
      playKnock();
      S.shake = Math.max(S.shake, 0.08);
      return;
    }
    const anchor = cubeMesh.position
      .clone()
      .add(new THREE.Vector3(dx * 0.5, -0.5, dz * 0.5));
    S.rolling = {
      t: 0,
      anchor,
      axis: new THREE.Vector3(dz, 0, -dx),
      startOffset: cubeMesh.position.clone().sub(anchor),
      startQuat: cubeMesh.quaternion.clone(),
      nx,
      nz,
    };
  }

  function updateRoll(dt: number) {
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
      grindLatchedAfterRoll();
      if (S.heart && S.heart.ix === r.nx && S.heart.iz === r.nz) collectHeart();
      updateWorld();
      if (S.queuedDir) {
        const [dx, dz] = S.queuedDir;
        S.queuedDir = null;
        tryRoll(dx, dz);
      }
    }
  }

  /* ---------- game flow ---------- */
  function resetGame() {
    for (const pz of [...S.parasites]) removeParasite(pz);
    for (const pt of S.particles) releaseParticle(pt.mesh);
    for (const d of S.decals) {
      scene.remove(d.mesh);
      (d.mesh.material as THREE.Material).dispose();
    }
    removeHeart();
    S.particles = [];
    S.decals = [];
    pauseScreen.classList.add("hidden");
    pauseBtn.textContent = "❚❚";
    Object.assign(S, {
      running: true,
      paused: false,
      time: 0,
      score: 0,
      level: 0,
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
      shake: 0,
      glow: 0,
      glowHold: 0,
      heart: null,
      heartCooldown: 25,
    });
    biteGlow.style.opacity = "0";
    endCombo();
    applyLevel(0);
    placeCube();
    updateWorld();
    updateHUD();
  }

  function gameOver() {
    S.running = false;
    S.best = Math.max(S.best, S.score);
    localStorage.setItem("crush-best", String(S.best));
    $("final-score").textContent = S.score + " POINTS";
    $("final-best").textContent = "BEST " + S.best;
    $("final-stats").textContent = `${S.totalKills} parasites crushed · reached LVL ${S.level + 1} ${LEVELS[S.level].name}`;
    $("gameover-screen").classList.remove("hidden");
    endCombo();
  }

  /* ---------- input & buttons ---------- */
  const pauseBtn = $("pause-btn");
  const pauseScreen = $("pause-screen");

  function setPause(p: boolean) {
    if (!S.running) return;
    S.paused = p;
    pauseScreen.classList.toggle("hidden", !p);
    pauseBtn.textContent = p ? "▶" : "❚❚";
  }
  const togglePause = () => setPause(!S.paused);

  const onStart = () => {
    audio();
    $("start-screen").classList.add("hidden");
    resetGame();
  };
  const onRestart = () => {
    $("gameover-screen").classList.add("hidden");
    resetGame();
  };
  const startBtn = $("start-btn");
  const restartBtn = $("restart-btn");
  const resumeBtn = $("resume-btn");
  startBtn.addEventListener("click", onStart);
  restartBtn.addEventListener("click", onRestart);
  const onResume = () => setPause(false);
  pauseBtn.addEventListener("click", togglePause);
  resumeBtn.addEventListener("click", onResume);

  const KEYMAP: Record<string, [number, number]> = {
    ArrowUp: [0, -1],
    KeyW: [0, -1],
    ArrowDown: [0, 1],
    KeyS: [0, 1],
    ArrowLeft: [-1, 0],
    KeyA: [-1, 0],
    ArrowRight: [1, 0],
    KeyD: [1, 0],
  };
  // held movement keys, newest last — the loop rolls toward the last one held.
  // (Don't drive movement off keydown auto-repeat: the OS typematic delay when
  // switching keys causes a ~1s stall. Tracking held keys makes it instant.)
  const heldMoveCodes: string[] = [];
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.code === "KeyP" || e.code === "Escape") && S.running) {
      togglePause();
      return;
    }
    if (KEYMAP[e.code]) {
      e.preventDefault();
      audio();
      if (!heldMoveCodes.includes(e.code)) heldMoveCodes.push(e.code);
    }
    if (
      e.code === "KeyR" &&
      !S.running &&
      !$("gameover-screen").classList.contains("hidden")
    ) {
      $("gameover-screen").classList.add("hidden");
      resetGame();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const i = heldMoveCodes.indexOf(e.code);
    if (i !== -1) heldMoveCodes.splice(i, 1);
  };
  // lost focus mid-hold: drop keys so the cube doesn't roll on forever
  const onBlur = () => {
    heldMoveCodes.length = 0;
    touchDir = null;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  // touch: hold & drag from the first-touch point like a virtual d-pad.
  // Keeps rolling in the held direction until the finger lifts (no tapping).
  let touchX = 0,
    touchY = 0,
    touchId: number | null = null;
  let touchDir: [number, number] | null = null; // held roll direction, or null
  const TOUCH_DEADZONE = 18; // px from origin before a direction registers
  const updateTouchDir = (t: Touch) => {
    const dx = t.clientX - touchX,
      dy = t.clientY - touchY;
    const adx = Math.abs(dx),
      ady = Math.abs(dy);
    if (Math.max(adx, ady) < TOUCH_DEADZONE) {
      touchDir = null; // finger near origin = neutral, stand still
      return;
    }
    touchDir = adx > ady ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1];
  };
  const onTouchStart = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    touchX = t.clientX;
    touchY = t.clientY;
    touchId = t.identifier;
    touchDir = null;
    audio();
  };
  const onTouchMove = (e: TouchEvent) => {
    if (touchId === null) return;
    const t = Array.from(e.changedTouches).find(
      (c) => c.identifier === touchId,
    );
    if (t) updateTouchDir(t);
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (
      touchId !== null &&
      Array.from(e.changedTouches).some((c) => c.identifier === touchId)
    ) {
      touchId = null;
      touchDir = null; // released: stop
    }
  };
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });

  /* ---------- main loop ---------- */
  placeCube();
  updateWorld();
  updateHUD();
  camera.position.copy(cubeMesh.position).add(CAM_OFFSET);
  const clock = new THREE.Clock();
  let rafId = 0;

  function tick() {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);

    let anyAttached = false;

    if (S.running && !S.paused) {
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

      // held input: newest key wins, else touch drag — keep rolling while idle
      const lastKey = heldMoveCodes[heldMoveCodes.length - 1];
      const heldDir = lastKey ? KEYMAP[lastKey] : touchDir;
      if (heldDir && !S.rolling) tryRoll(heldDir[0], heldDir[1]);

      updateRoll(dt);

      const spd = LEVELS[S.level].speed; // parasite speed ramps with level
      for (let i = S.parasites.length - 1; i >= 0; i--) {
        const pz = S.parasites[i];
        pz.animT += dt;
        if (pz.state === "crawl") {
          if (pz.moveT < 1) {
            pz.moveT = Math.min(
              1,
              pz.moveT + (dt * spd) / (pz.def.interval * 0.55),
            );
            pz.mesh.position.lerpVectors(pz.fromPos, pz.toPos, pz.moveT);
          }
          pz.moveTimer += dt;
          if (pz.moveTimer >= pz.def.interval / spd) {
            pz.moveTimer = 0;
            stepParasite(pz);
          }
          pz.mesh.userData.animate(pz.animT);
          // wandered too far behind? recycle it
          if (
            Math.max(
              Math.abs(pz.ix - S.cube.ix),
              Math.abs(pz.iz - S.cube.iz),
            ) > DESPAWN_R
          ) {
            removeParasite(pz);
          }
        } else {
          anyAttached = true;
          pz.biteTimer -= dt;
          const worldN = _v1.copy(pz.localN).applyQuaternion(cubeMesh.quaternion);
          pz.mesh.position.copy(cubeMesh.position).addScaledVector(worldN, 0.56);
          pz.mesh.quaternion.setFromUnitVectors(UP, worldN);
          pz.mesh.userData.animate(pz.animT * 1.6);
          // gnashing pulse in the final moment before the bite lands
          if (pz.biteTimer < 0.4) {
            const p = 1 + Math.sin(pz.animT * 18) * 0.14;
            pz.mesh.scale.set(p, p, p);
          }
          if (pz.biteTimer <= 0) {
            splat(cubeMesh.position.clone().setY(0), pz.def.goo, false);
            removeParasite(pz); // it feeds and drops off
            applyBite();
          }
        }
      }

      warning.classList.toggle("on", anyAttached);

      // bite glow: hold at peak while hurt, then decay
      if (S.glowHold > 0) S.glowHold -= dt;
      else if (S.glow > 0) S.glow = Math.max(0, S.glow - dt * 1.4);

      // heart pickup lifecycle
      if (S.heart) {
        const h = S.heart;
        h.t += dt;
        h.mesh.rotation.y += dt * 1.6;
        h.mesh.position.y = 0.5 + Math.sin(h.t * 3) * 0.09;
        const dist = Math.max(
          Math.abs(h.ix - S.cube.ix),
          Math.abs(h.iz - S.cube.iz),
        );
        if (h.t > HEART_LIFE) h.mesh.visible = Math.floor(h.t * 6) % 2 === 0;
        if (h.t > HEART_LIFE + HEART_BLINK || dist > HEART_DESPAWN_R) {
          removeHeart();
        }
      } else {
        S.heartCooldown -= dt;
        if (S.heartCooldown <= 0) spawnHeart();
      }
    }

    biteGlow.style.opacity = String(S.glow);

    // particles (reverse loop = safe in-place removal, no array copy)
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const pt = S.particles[i];
      pt.t += dt;
      pt.vel.y -= 12 * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      if (pt.mesh.position.y < 0.03) {
        pt.mesh.position.y = 0.03;
        pt.vel.set(0, 0, 0);
      }
      (pt.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - pt.t / pt.life;
      if (pt.t >= pt.life) {
        releaseParticle(pt.mesh);
        S.particles.splice(i, 1);
      }
    }

    // decals fade
    for (let i = S.decals.length - 1; i >= 0; i--) {
      const d = S.decals[i];
      d.t += dt;
      if (d.t > d.life * 0.5) {
        (d.mesh.material as THREE.MeshBasicMaterial).opacity =
          0.7 * (1 - (d.t - d.life * 0.5) / (d.life * 0.5));
      }
      if (d.t >= d.life) {
        scene.remove(d.mesh);
        (d.mesh.material as THREE.Material).dispose();
        S.decals.splice(i, 1);
      }
    }

    // ground + light follow the cube
    snapGround();
    sun.position.copy(cubeMesh.position).add(SUN_OFFSET);
    sun.target.position.copy(cubeMesh.position);

    // camera follow + shake
    _v2.copy(cubeMesh.position).add(CAM_OFFSET);
    camera.position.lerp(_v2, 0.08);
    if (S.shake > 0) {
      S.shake = Math.max(0, S.shake - dt * 1.8);
      camera.position.x += (Math.random() - 0.5) * S.shake * 0.4;
      camera.position.y += (Math.random() - 0.5) * S.shake * 0.4;
    }
    camera.lookAt(cubeMesh.position.x, 0, cubeMesh.position.z);

    renderer.render(scene, camera);
  }
  tick();

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  window.addEventListener("resize", onResize);

  /* ---------- disposer ---------- */
  return function dispose() {
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
    startBtn.removeEventListener("click", onStart);
    restartBtn.removeEventListener("click", onRestart);
    pauseBtn.removeEventListener("click", togglePause);
    resumeBtn.removeEventListener("click", onResume);
    renderer.domElement.remove();
    renderer.dispose();
  };
}
