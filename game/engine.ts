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
  playHurt,
  playRampage,
} from "./audio";

/* ================= constants ================= */
const TILE = 1;
const ROLL_TIME = 0.14; // seconds per roll
const BITE_TIME = 5.0; // seconds a latched parasite takes to bite
const COMBO_WINDOW = 2.5; // seconds to keep a combo alive
const RAMPAGE_AT = 4; // combo count that triggers rampage
const MAX_PARASITES = 24;
const VIEW_R = 14; // world generation radius (tiles)
const SPAWN_R_MIN = 9,
  SPAWN_R_MAX = 12;
const DESPAWN_R = 18;
const GROUND_SIZE = 60;
const CAM_OFFSET = new THREE.Vector3(0, 11, 8.5);

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

/* ================= types ================= */
interface Parasite {
  type: ParasiteType;
  def: ParasiteDef;
  mesh: THREE.Group;
  ix: number;
  iz: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  moveT: number;
  moveTimer: number;
  state: "crawl" | "attached";
  climb: number;
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
  time: number;
  score: number;
  best: number;
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
}

/* ================= entry point ================= */
// Boots a fresh game inside `container`, returns a disposer that tears the
// whole thing down (RAF loop, listeners, GL context) for React unmount.
export function startGame(container: HTMLElement): () => void {
  /* ---------- state ---------- */
  const S: GameState = {
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
  function spawnParasite() {
    if (S.parasites.length >= MAX_PARASITES) return;
    const roll = Math.random();
    let type: ParasiteType;
    if (roll < Math.max(0.35, 0.8 - S.time * 0.01)) type = "worm";
    else if (roll < 0.85) type = "bug";
    else type = "spider";
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

    const mesh = makeParasiteMesh(type);
    const p = tileToWorld(ix, iz);
    mesh.position.copy(p);
    scene.add(mesh);

    S.parasites.push({
      type,
      def,
      mesh,
      ix,
      iz,
      fromPos: p.clone(),
      toPos: p.clone(),
      moveT: 1,
      moveTimer: Math.random() * 0.5,
      state: "crawl", // crawl | attached
      climb: 0,
      localN: new THREE.Vector3(), // cube-local normal of the face it clings to
      animT: Math.random() * 10,
    });
  }

  function freeTile(ix: number, iz: number) {
    return !isObstacle(ix, iz);
  }

  function stepParasite(pz: Parasite) {
    const dx = S.cube.ix - pz.ix;
    const dz = S.cube.iz - pz.iz;

    let sx = 0,
      sz = 0;
    const preferX =
      Math.abs(dx) > Math.abs(dz) ||
      (Math.abs(dx) === Math.abs(dz) && Math.random() < 0.5);
    if (pz.type === "spider" && Math.random() < 0.35) {
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
      pz.state = "attached";
      pz.climb = 0;
      // world-side normal it grabbed, stored in cube-local space so it rides the face
      const worldN = new THREE.Vector3(-sx, 0, -sz).normalize();
      pz.localN.copy(worldN).applyQuaternion(cubeMesh.quaternion.clone().invert());
      playLatch();
      return;
    }

    pz.ix = nx;
    pz.iz = nz;
    pz.fromPos.copy(pz.mesh.position);
    pz.fromPos.y = 0;
    pz.toPos.copy(tileToWorld(nx, nz));
    pz.moveT = 0;
    pz.mesh.rotation.set(0, Math.atan2(sx, sz) - Math.PI / 2, 0);
  }

  function removeParasite(pz: Parasite) {
    scene.remove(pz.mesh);
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

  function splat(worldPos: THREE.Vector3, color: number, big = false) {
    const n = big ? 20 : 13;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 + Math.random() * 0.05, 6, 5),
        new THREE.MeshBasicMaterial({ color, transparent: true }),
      );
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
    warning = $("warning");

  function updateHUD() {
    scoreEl.textContent = String(S.score);
    bestEl.textContent = "BEST " + Math.max(S.best, S.score);
    livesEl.innerHTML = [0, 1, 2]
      .map((i) => `<span class="${i < S.lives ? "" : "lost"}">&#10084;</span>`)
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
    const victims = S.parasites.filter(
      (p) => p.state === "crawl" && p.ix === ix && p.iz === iz,
    );
    crushList(victims, victims.some((v) => v.type === "spider"));
  }

  // after a roll: faces that ended up on the ground crush their riders;
  // faces that ended up on top mean the parasite made it — you get bitten.
  function resolveAttachedAfterRoll() {
    const crushed: Parasite[] = [],
      reachedTop: Parasite[] = [];
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

  /* ---------- rolling ---------- */
  function tryRoll(dx: number, dz: number) {
    if (!S.running) return;
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
      resolveAttachedAfterRoll();
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
    for (const pt of S.particles) scene.remove(pt.mesh);
    for (const d of S.decals) scene.remove(d.mesh);
    S.particles = [];
    S.decals = [];
    Object.assign(S, {
      running: true,
      time: 0,
      score: 0,
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
    });
    endCombo();
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
    $("final-stats").textContent = `${S.totalKills} parasites crushed`;
    $("gameover-screen").classList.remove("hidden");
    endCombo();
  }

  /* ---------- input & buttons ---------- */
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
  startBtn.addEventListener("click", onStart);
  restartBtn.addEventListener("click", onRestart);

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
  const onKeyDown = (e: KeyboardEvent) => {
    if (KEYMAP[e.code]) {
      e.preventDefault();
      audio();
      tryRoll(...KEYMAP[e.code]);
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
  window.addEventListener("keydown", onKeyDown);

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
          pz.climb += dt / BITE_TIME;
          const worldN = pz.localN.clone().applyQuaternion(cubeMesh.quaternion);
          pz.mesh.position.copy(cubeMesh.position).addScaledVector(worldN, 0.56);
          pz.mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            worldN,
          );
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
      (pt.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - pt.t / pt.life;
      if (pt.t >= pt.life) {
        scene.remove(pt.mesh);
        S.particles.splice(S.particles.indexOf(pt), 1);
      }
    }

    // decals fade
    for (const d of [...S.decals]) {
      d.t += dt;
      if (d.t > d.life * 0.5) {
        (d.mesh.material as THREE.MeshBasicMaterial).opacity =
          0.7 * (1 - (d.t - d.life * 0.5) / (d.life * 0.5));
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
    window.removeEventListener("resize", onResize);
    startBtn.removeEventListener("click", onStart);
    restartBtn.removeEventListener("click", onRestart);
    renderer.domElement.remove();
    renderer.dispose();
  };
}
