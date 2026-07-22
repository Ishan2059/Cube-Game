import * as THREE from "three";
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
playCoin,
playSpit,
} from "./audio";
import { LEVELS, type Level } from "./levels";
import {
  submitScore,
  fetchBoard,
  renderBoard,
  getInitials,
  setInitials,
  fetchMe,
  trackRef,
} from "./leaderboard";
import {
addCoins,
getEquippedSkin,
getEquippedTrail,
getEquippedAura,
getSettings,
} from "./storage";
import { skinById, getSkinTexture } from "./skins";
import { trailById } from "./trails";
import { auraById } from "./auras";
import { createCubeMesh } from "./cubeMesh";
import { createTrail, createAura } from "./effects";
import { initMenus, showStart, toast } from "./menus";

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
// power-ups (rare, short-lived, high value)
const POWERUP_MIN_SCORE = 300; // available almost from the start
const POWERUP_LIFE = 18;
const POWERUP_BLINK = 3;
const SPEED_TIME = 10; // ⚡ bolt: seconds of fast rolling
const SPEED_FACTOR = 0.55; // roll-time multiplier while ⚡ active
const GIANT_TIME = 8; // ★ star: seconds of giant mode
const GIANT_SCALE = 1.3; // giant cube visual scale (crushes 3×3)
// ground hazards (spider web / slug slime / termite pit)
const WEB_LIFE = 14; // seconds a web stays on the ground
const WEB_MAX = 8; // most webs alive at once
const WEB_DROP_CHANCE = 0.18; // per spider step
const WEB_SLOW_TIME = 2.4; // seconds of slow after rolling into one
const WEB_SLOW_FACTOR = 1.9; // roll-time multiplier while slowed
const SLIME_LIFE = 11; // seconds slug slime lingers
const SLIME_DROP_CHANCE = 0.5; // per slug step (slugs trail heavily)
const SLIME_STALL = 0.55; // seconds the cube is stuck on slime
const PIT_LIFE = 5.5; // seconds a termite pit blocks the tile
const PIT_MAX = 5; // hard cap so the cube can never be boxed in
const PIT_DROP_CHANCE = 0.4; // per termite step
const PIT_MIN_DIST = 2; // never dig within this many tiles of the cube
const HAZARD_MAX = 16; // total ground hazards (all kinds) alive at once
// scorpion poison
const POISON_TIME = 4;
const POISON_DPS = 0.5 / POISON_TIME; // drains half a heart icon total
// hornet daze (controls invert) & mosquito drain
const DAZE_TIME = 2.5;
const MOSQUITO_DRAIN = 2; // bite damage multiplier for mosquitoes
// locust dash
const LOCUST_DASH_CD_MIN = 3,
LOCUST_DASH_CD_MAX = 5.5;
const LOCUST_DASH_SLIDE = 2.4; // slide-speed multiplier during a lunge
// egg sac
const EGGSAC_HATCH = 6; // seconds until it hatches if left alone
const EGGSAC_BROOD = 3; // bugs it hatches into
// spitter: ranged acid lobber — punishes camping in one spot
const SPIT_RANGE_MIN = 3; // holds ground inside this ring (tiles, chebyshev)
const SPIT_RANGE_MAX = 6; // spits (and lands hits) from up to 6 tiles out
const SPIT_CD_MIN = 2.4,
SPIT_CD_MAX = 4.0; // seconds between shots
const SPIT_DAMAGE = 0.75; // × BITE_DAMAGE — softer than a bite, but ranged
const GROUND_SIZE = 60;
const CAM_OFFSET = new THREE.Vector3(0, 11, 8.5);
const SUN_OFFSET = new THREE.Vector3(6, 14, 4);
const UP = new THREE.Vector3(0, 1, 0);

/* ---------- coin economy ----------
 * No telemetry exists yet (Vercel Analytics here only tracks pageviews), so
 * this is tuned from the level table: a casual run dying somewhere between
 * GRUB (500) and HARDENED (1200) — the difficulty ramp (stick 0.15→0.34,
 * speed 1.0→1.3 across L1-L3) makes that an early-death zone for the
 * average player — lands in the 15-25 coin target at SCORE_PER_COIN=40.
 * At that rate Dragon (320) takes ~16 average runs, Rubix (500) ~25 —
 * matches the "keep coming back" goal. Retune by changing these, not the
 * formula in coinsForScore(). */
const SCORE_PER_COIN = 40; // primary rate: this many score points = 1 coin
const SOFT_CAP_SCORE = 3000; // score above this earns coins at a reduced rate
const OVERFLOW_SCORE_PER_COIN = 160; // reduced rate applied past SOFT_CAP_SCORE
const RUN_COIN_CAP = 90; // hard ceiling — no single run can shortcut the grind

/* ================= pure helpers ================= */
/** Score-to-coins with diminishing returns past SOFT_CAP_SCORE and a hard
 *  ceiling, so one marathon run can't out-earn many average ones. */
function coinsForScore(score: number): number {
  const base = Math.min(score, SOFT_CAP_SCORE) / SCORE_PER_COIN;
  const overflow = Math.max(0, score - SOFT_CAP_SCORE) / OVERFLOW_SCORE_PER_COIN;
  return Math.min(RUN_COIN_CAP, Math.floor(base + overflow));
}
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

function makeBoltMesh(): THREE.Group {
const g = new THREE.Group();
const mat = new THREE.MeshStandardMaterial({
color: 0xffe14e,
emissive: 0x8a6a10,
emissiveIntensity: 0.9,
roughness: 0.3,
});
// two slanted slabs form a zig-zag lightning bolt
const top = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.05), mat);
top.position.set(0.05, 0.12, 0);
top.rotation.z = 0.45;
g.add(top);
const bot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.05), mat);
bot.position.set(-0.05, -0.12, 0);
bot.rotation.z = 0.45;
g.add(bot);
return g;
}

function makeStarMesh(): THREE.Group {
const g = new THREE.Group();
const mat = new THREE.MeshStandardMaterial({
color: 0xe05ae0,
emissive: 0x6a106a,
emissiveIntensity: 0.9,
roughness: 0.25,
});
const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), mat);
gem.scale.y = 1.3;
g.add(gem);
return g;
}

// pickup beacon: pulsing ground ring + soft light pillar so power-ups read
// from across the arena (players were rolling straight past them)
function addBeacon(g: THREE.Group, color: number, strong: boolean) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.58, 24),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: strong ? 0.85 : 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.46; // pickup floats at y≈0.5 — ring sits on the soil
  g.add(ring);
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.3, 2.4, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: strong ? 0.22 : 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  pillar.position.y = 0.75;
  g.add(pillar);
  g.userData.beaconRing = ring;
}

function makeWebTexture() {
const cv = document.createElement("canvas");
cv.width = cv.height = 128;
const ctx = cv.getContext("2d")!;
ctx.strokeStyle = "rgba(255,255,255,0.9)";
ctx.lineWidth = 2;
const c = 64;
// radial spokes
for (let i = 0; i < 8; i++) {
const a = (i / 8) * Math.PI * 2;
ctx.beginPath();
ctx.moveTo(c, c);
ctx.lineTo(c + Math.cos(a) * 60, c + Math.sin(a) * 60);
ctx.stroke();
}
// concentric rings (slightly wobbly polygons read as silk)
for (let r = 14; r <= 56; r += 14) {
ctx.beginPath();
for (let i = 0; i <= 8; i++) {
const a = (i / 8) * Math.PI * 2;
const rr = r * (0.92 + hash2(r, i) * 0.16);
const x = c + Math.cos(a) * rr,
y = c + Math.sin(a) * rr;
i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
}
ctx.stroke();
}
return new THREE.CanvasTexture(cv);
}

function makeSlimeTexture() {
const cv = document.createElement("canvas");
cv.width = cv.height = 128;
const ctx = cv.getContext("2d")!;
const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
grad.addColorStop(0, "rgba(200,230,120,0.95)");
grad.addColorStop(0.6, "rgba(150,190,70,0.8)");
grad.addColorStop(1, "rgba(120,150,50,0)");
// irregular blob outline
ctx.fillStyle = grad;
ctx.beginPath();
for (let i = 0; i <= 16; i++) {
const a = (i / 16) * Math.PI * 2;
const r = 46 + hash2(i * 3, i * 7) * 16;
const x = 64 + Math.cos(a) * r,
y = 64 + Math.sin(a) * r;
i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
}
ctx.closePath();
ctx.fill();
// glossy highlights
ctx.fillStyle = "rgba(240,255,200,0.7)";
for (let i = 0; i < 5; i++) {
const x = 40 + hash2(i, 1) * 48,
y = 40 + hash2(i, 2) * 48;
ctx.beginPath();
ctx.arc(x, y, 3 + hash2(i, 3) * 4, 0, Math.PI * 2);
ctx.fill();
}
return new THREE.CanvasTexture(cv);
}

function makePitTexture() {
const cv = document.createElement("canvas");
cv.width = cv.height = 128;
const ctx = cv.getContext("2d")!;
// crumbly lighter rim
ctx.fillStyle = "rgba(70,60,48,0.9)";
ctx.beginPath();
ctx.arc(64, 64, 60, 0, Math.PI * 2);
ctx.fill();
// dark hole
const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 52);
grad.addColorStop(0, "rgba(2,2,4,1)");
grad.addColorStop(0.75, "rgba(6,8,6,1)");
grad.addColorStop(1, "rgba(30,26,20,0)");
ctx.fillStyle = grad;
ctx.beginPath();
ctx.arc(64, 64, 52, 0, Math.PI * 2);
ctx.fill();
return new THREE.CanvasTexture(cv);
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
hp: number; // armored beetles take 2 crushes (crack, then kill)
stunT: number; // seconds frozen after a shell crack
hatchT: number; // egg sac: seconds until it hatches (0 = n/a)
dashT: number; // locust: seconds until its next dash lunge
slideMul: number; // per-step slide-speed scale (locust dash uses >1)
spitT: number; // spitter: seconds until its next acid lob
}

interface RollState {
t: number;
dur: number; // seconds for this roll (speed/slow effects bake in here)
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

interface Pickup {
kind: "bolt" | "star";
mesh: THREE.Group;
ix: number;
iz: number;
t: number;
}

// spitter's acid glob mid-flight; lands on the tile the cube occupied at launch
interface Glob {
mesh: THREE.Mesh;
from: THREE.Vector3;
to: THREE.Vector3;
t: number; // 0→1 flight progress
dur: number;
ix: number;
iz: number;
}

type HazardKind = "web" | "slime" | "pit";
interface Hazard {
kind: HazardKind;
mesh: THREE.Mesh;
ix: number;
iz: number;
t: number;
life: number;
}

interface GameState {
running: boolean;
paused: boolean;
time: number;
score: number;
best: number;
lastHitBy: string; // parasite type that last bit us (game-over cause line)
level: number;
lives: number;
combo: number;
maxCombo: number;
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
powerup: Pickup | null;
powerupCooldown: number; // seconds until the next power-up may spawn
hazards: Hazard[];
globs: Glob[]; // spitter acid shots in flight
speedT: number; // ⚡ time left
giantT: number; // ★ time left
slowT: number; // webbed-slow time left
poisonT: number; // scorpion poison time left
stallT: number; // slime-stall time left (cube can't roll)
dazeT: number; // hornet daze time left (controls inverted)
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
lastHitBy: "",
level: 0,
lives: 3,
combo: 0,
maxCombo: 0,
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
powerup: null,
powerupCooldown: 10,
hazards: [],
globs: [],
speedT: 0,
giantT: 0,
slowT: 0,
poisonT: 0,
stallT: 0,
dazeT: 0,
};

// reusable scratch vectors — avoid per-frame allocation in the hot loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

// per-run settings snapshot — difficulty is only changeable from the menu,
// so resetGame() re-reads it at the start of each run
let casual = getSettings().difficulty === "casual";
// haptic tap on damage/pickups; harmless no-op on devices/browsers without
// the Vibration API (e.g. iOS Safari)
const buzz = (ms: number) => {
  if ("vibrate" in navigator) navigator.vibrate(ms);
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

// cap DPR lower on phones — huge fill-rate/thermal saving, imperceptible
const DPR_CAP = matchMedia("(pointer: coarse)").matches ? 1.5 : 2;
const dpr = Math.min(devicePixelRatio, DPR_CAP);
// MSAA is redundant at high DPR (pixel density already hides jaggies) and
// costs serious fill-rate — only enable it on low-DPI screens
const renderer = new THREE.WebGLRenderer({
antialias: dpr < 1.5,
powerPreference: "high-performance",
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(dpr);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xb8c8d8, 0x2c2418, 0.65));
const sun = new THREE.DirectionalLight(0xffe6c0, 1.35);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
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
g.add(pb);
} else {
return null;
}
}
// props never move — freeze matrices so the renderer skips recomposing
// them every frame
g.traverse((o) => {
o.updateMatrix();
o.matrixAutoUpdate = false;
});
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
// geometry/material/face built by createCubeMesh() — shared with the skin
// preview modal so it always matches the real gameplay cube exactly.
const cubeMesh = createCubeMesh(TILE);
scene.add(cubeMesh);

// trail: motion-triggered afterimage, spawns in world space as the cube
// rolls. aura: always-on pulsing halo, parented to the cube (tracks it for
// free). Both cosmetic and independent of the equipped skin.
const trailFx = createTrail(scene, trailById(getEquippedTrail()).color);
trailFx.setActive(getEquippedTrail() !== "none");
const auraFx = createAura(cubeMesh, auraById(getEquippedAura()).color);
auraFx.setActive(getEquippedAura() !== "none");
const onTrailChange = () => {
  const t = trailById(getEquippedTrail());
  trailFx.setColor(t.color);
  trailFx.setActive(t.id !== "none");
};
const onAuraChange = () => {
  const a = auraById(getEquippedAura());
  auraFx.setColor(a.color);
  auraFx.setActive(a.id !== "none");
};
window.addEventListener("crush:trail", onTrailChange);
window.addEventListener("crush:aura", onAuraChange);

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
slug: [],
termite: [],
hornet: [],
mosquito: [],
pillbug: [],
flea: [],
locust: [],
eggsac: [],
spitter: [],
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
const swarm = LEVELS[S.level].swarm ?? 1;
if (S.parasites.length >= Math.round(MAX_PARASITES * swarm)) return;
const type = pickType();

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

addParasite(type, ix, iz);
}

// build a parasite on a specific tile (used by spawnParasite and egg-sac hatch)
function addParasite(type: ParasiteType, ix: number, iz: number) {
const def = TYPES[type];
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
hp: type === "beetle" ? 1 + (LEVELS[S.level].armor ?? 0) : 1,
stunT: 0,
hatchT: type === "eggsac" ? EGGSAC_HATCH : 0,
dashT:
type === "locust"
? LOCUST_DASH_CD_MIN +
Math.random() * (LOCUST_DASH_CD_MAX - LOCUST_DASH_CD_MIN)
: 0,
slideMul: 1,
spitT: type === "spitter" ? 1.2 + Math.random() * 1.4 : 0,
});
}

// bugs treat rocks AND active termite pits as impassable
function freeTile(ix: number, iz: number) {
return !isObstacle(ix, iz) && !pitAt(ix, iz);
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

    // spitter: ranged — never latches. Keeps a firing ring around the cube:
    // backs off when crowded, closes in when out of range, holds otherwise
    // (the spit-cooldown in the main loop handles the actual shot).
    if (pz.type === "spitter") {
      const cheb = Math.max(Math.abs(dx), Math.abs(dz));
      const faceCube = () =>
        pz.mesh.rotation.set(0, Math.atan2(dx, dz) - Math.PI / 2, 0);
      if (cheb >= SPIT_RANGE_MIN && cheb <= SPIT_RANGE_MAX) {
        faceCube();
        return; // in range: stand and shoot
      }
      const dir = cheb > SPIT_RANGE_MAX ? 1 : -1; // approach vs back off
      let sx = 0,
        sz = 0;
      if (
        Math.abs(dx) > Math.abs(dz) ||
        (Math.abs(dx) === Math.abs(dz) && Math.random() < 0.5)
      )
        sx = (Math.sign(dx) || 1) * dir;
      else sz = (Math.sign(dz) || 1) * dir;
      const onCube = (x: number, z: number) =>
        x === S.cube.ix && z === S.cube.iz;
      let nx = pz.ix + sx,
        nz = pz.iz + sz;
      if (!freeTile(nx, nz) || onCube(nx, nz)) {
        if (sx !== 0) {
          sx = 0;
          sz = (Math.sign(dz) || (Math.random() < 0.5 ? 1 : -1)) * dir;
        } else {
          sz = 0;
          sx = (Math.sign(dx) || (Math.random() < 0.5 ? 1 : -1)) * dir;
        }
        nx = pz.ix + sx;
        nz = pz.iz + sz;
        if (!freeTile(nx, nz) || onCube(nx, nz)) {
          faceCube();
          return; // cornered: hold — chasing it down is the counterplay
        }
      }
      pz.prevIx = pz.ix;
      pz.prevIz = pz.iz;
      pz.ix = nx;
      pz.iz = nz;
      pz.fromPos.copy(pz.mesh.position);
      pz.fromPos.y = 0;
      pz.toPos.copy(tileToWorld(nx, nz));
      pz.moveT = 0;
      faceCube();
      return;
    }

    // locust lunge: every few seconds it dashes 2 tiles straight at the cube.
    // A fast slide (slideMul) sells the pounce. Only when a clear 2-tile beeline
    // exists and it isn't already adjacent (adjacency is the normal latch path).
    if (
      pz.type === "locust" &&
      pz.dashT <= 0 &&
      Math.abs(dx) + Math.abs(dz) > 1 &&
      !S.rolling
    ) {
      const ax = Math.abs(dx) >= Math.abs(dz);
      const ssx = ax ? Math.sign(dx) : 0;
      const ssz = ax ? 0 : Math.sign(dz);
      const midx = pz.ix + ssx,
        midz = pz.iz + ssz;
      const farx = pz.ix + ssx * 2,
        farz = pz.iz + ssz * 2;
      const onCube = (x: number, z: number) => x === S.cube.ix && z === S.cube.iz;
      if (
        freeTile(midx, midz) &&
        !onCube(midx, midz) &&
        freeTile(farx, farz) &&
        !onCube(farx, farz)
      ) {
        pz.dashT =
          LOCUST_DASH_CD_MIN +
          Math.random() * (LOCUST_DASH_CD_MAX - LOCUST_DASH_CD_MIN);
        pz.prevIx = pz.ix;
        pz.prevIz = pz.iz;
        pz.ix = farx;
        pz.iz = farz;
        pz.fromPos.copy(pz.mesh.position);
        pz.fromPos.y = 0;
        pz.toPos.copy(tileToWorld(farx, farz));
        pz.moveT = 0;
        pz.slideMul = LOCUST_DASH_SLIDE;
        pz.mesh.rotation.set(0, Math.atan2(ssx, ssz) - Math.PI / 2, 0);
        return;
      }
    }

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
    // fleas jitter far more than they path — that erratic hop is what makes
    // them hard to land on
    const wander = pz.type === "flea" ? 0.55 : sidestep;
    if (
      (pz.type === "spider" ||
        pz.type === "scorpion" ||
        pz.type === "flea") &&
      Math.random() < wander
    ) {
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

// trail-leavers drop a hazard on the tile they just vacated
maybeDropHazard(pz);
}

function removeParasite(pz: Parasite) {
releaseParasiteMesh(pz.type, pz.mesh);
S.parasites.splice(S.parasites.indexOf(pz), 1);
}

// egg sac timed out: burst into a small brood on the free tiles around it,
// then remove the sac. Ignoring a sac now costs you a cluster of bugs.
function hatchEggSac(pz: Parasite) {
const ix = pz.ix,
iz = pz.iz;
popup(pz.mesh.position.clone(), "HATCHED!", "rampage");
splat(pz.mesh.position.clone().setY(0), pz.def.goo, false);
playRampage();
const dirs = [
[1, 0],
[-1, 0],
[0, 1],
[0, -1],
[1, 1],
[-1, -1],
[1, -1],
[-1, 1],
] as const;
let spawned = 0;
for (const [ax, az] of dirs) {
if (spawned >= EGGSAC_BROOD) break;
const nx = ix + ax,
nz = iz + az;
if (freeTile(nx, nz) && !(nx === S.cube.ix && nz === S.cube.iz)) {
addParasite("bug", nx, nz);
spawned++;
}
}
removeParasite(pz);
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

/* ---------- ground hazards: spider web / slug slime / termite pit ---------- */
const hazardGeo = new THREE.PlaneGeometry(0.95, 0.95);
hazardGeo.rotateX(-Math.PI / 2);
const hazardTex: Record<HazardKind, THREE.CanvasTexture> = {
web: makeWebTexture(),
slime: makeSlimeTexture(),
pit: makePitTexture(),
};
const HAZARD_STYLE: Record<
HazardKind,
{ life: number; opacity: number; color: number; y: number }
> = {
web: { life: WEB_LIFE, opacity: 0.55, color: 0xffffff, y: 0.02 },
slime: { life: SLIME_LIFE, opacity: 0.78, color: 0xffffff, y: 0.02 },
pit: { life: PIT_LIFE, opacity: 0.96, color: 0xffffff, y: 0.012 },
};

function hazardAt(ix: number, iz: number) {
return S.hazards.find((h) => h.ix === ix && h.iz === iz);
}
function pitAt(ix: number, iz: number) {
return S.hazards.some((h) => h.kind === "pit" && h.ix === ix && h.iz === iz);
}
function countKind(kind: HazardKind) {
let n = 0;
for (const h of S.hazards) if (h.kind === kind) n++;
return n;
}

function removeHazard(h: Hazard) {
scene.remove(h.mesh);
(h.mesh.material as THREE.Material).dispose(); // geo/tex shared, kept
const i = S.hazards.indexOf(h);
if (i !== -1) S.hazards.splice(i, 1);
}

function dropHazard(kind: HazardKind, ix: number, iz: number) {
if (hazardAt(ix, iz)) return; // one hazard per tile
// oldest web recycles first if webs alone hit their cap; otherwise the global
// cap keeps total hazard draw-count bounded
if (kind === "web" && countKind("web") >= WEB_MAX) {
const w = S.hazards.find((h) => h.kind === "web");
if (w) removeHazard(w);
}
if (S.hazards.length >= HAZARD_MAX) removeHazard(S.hazards[0]);
const st = HAZARD_STYLE[kind];
const m = new THREE.Mesh(
hazardGeo,
new THREE.MeshBasicMaterial({
map: hazardTex[kind],
color: st.color,
transparent: true,
opacity: st.opacity,
depthWrite: false,
polygonOffset: true,
polygonOffsetFactor: -2,
}),
);
m.renderOrder = 1;
const p = tileToWorld(ix, iz);
m.position.set(p.x, st.y, p.z);
scene.add(m);
S.hazards.push({ kind, mesh: m, ix, iz, t: 0, life: st.life });
}

// spiders trail silk, slugs trail slime, termites dig pits — each on the tile
// they just left. Pits are throttled and kept clear of the cube so it can never
// be walled in.
function maybeDropHazard(pz: Parasite) {
const px = pz.prevIx,
pz2 = pz.prevIz;
if (hazardAt(px, pz2)) return;
if (pz.type === "spider") {
if (Math.random() < WEB_DROP_CHANCE) dropHazard("web", px, pz2);
} else if (pz.type === "slug") {
if (Math.random() < SLIME_DROP_CHANCE) dropHazard("slime", px, pz2);
} else if (pz.type === "termite") {
const dist = Math.max(
Math.abs(px - S.cube.ix),
Math.abs(pz2 - S.cube.iz),
);
if (
Math.random() < PIT_DROP_CHANCE &&
dist >= PIT_MIN_DIST &&
countKind("pit") < PIT_MAX
) {
dropHazard("pit", px, pz2);
}
}
}

/* ---------- spitter acid globs ---------- */
const globGeo = new THREE.SphereGeometry(0.07, 8, 6);

function launchSpit(pz: Parasite) {
  const to = tileToWorld(S.cube.ix, S.cube.iz);
  const from = pz.mesh.position.clone();
  from.y = 0.24;
  const dist = from.distanceTo(to);
  const mesh = new THREE.Mesh(
    globGeo,
    new THREE.MeshStandardMaterial({
      color: 0x9fe32a,
      emissive: 0x3a6a08,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    }),
  );
  mesh.castShadow = true;
  mesh.position.copy(from);
  scene.add(mesh);
  S.globs.push({
    mesh,
    from,
    to,
    t: 0,
    dur: 0.55 + dist * 0.07, // farther lob = longer hang time = fairer dodge
    ix: S.cube.ix,
    iz: S.cube.iz,
  });
  playSpit();
}

function removeGlob(i: number) {
  const g = S.globs[i];
  scene.remove(g.mesh);
  (g.mesh.material as THREE.Material).dispose(); // geometry shared, kept
  S.globs.splice(i, 1);
}

// acid connects: softer than a bite, but it still breaks combo/streak —
// that loss is the real anti-camping tax
function applySpitHit() {
  const soften = casual ? 0.75 : 1;
  S.lives = Math.max(
    0,
    S.lives - BITE_DAMAGE * SPIT_DAMAGE * LEVELS[S.level].bite * soften,
  );
  S.lastHitBy = "spitter";
  S.streak = 0;
  endCombo();
  playBite();
  buzz(35);
  popup(cubeMesh.position.clone(), "ACID!", "rampage");
  S.shake = Math.max(S.shake, 0.22);
  const missing = (3 - S.lives) / 3;
  S.glow = Math.max(S.glow, 0.28 + missing * 0.4);
  S.glowHold = 0.1 + missing * 1.0;
  updateHUD();
  if (S.lives <= 0) gameOver();
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
biteGlow = $("bite-glow"),
poisonGlow = $("poison-glow"),
buffsEl = $("buffs");
void flash; // kept for markup compatibility; bites use the glow overlay now

// Cube look = equipped skin texture × current level colour. Textures are
// grayscale, so the level tint multiplies through and the pattern (cracks /
// scales / sticker grid) stays contrasty at every level.
function applyCubeStyle() {
  const mat = cubeMesh.material as THREE.MeshStandardMaterial;
  const sk = skinById(getEquippedSkin());
  const L = LEVELS[S.level];
  mat.color.set(L.skin);
  mat.emissive.set(L.emissive ?? 0x000000);
  mat.emissiveIntensity = 1;
  mat.roughness = sk.roughness;
  mat.map = getSkinTexture(sk.id);
  mat.needsUpdate = true;
}
// shop equips a skin → restyle the live cube immediately
const onSkinChange = () => applyCubeStyle();
window.addEventListener("crush:skin", onSkinChange);

function applyLevel(idx: number) {
S.level = idx;
applyCubeStyle();
levelEl.textContent = `LVL ${idx + 1} · ${LEVELS[idx].name}`;
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
if (S.combo > S.maxCombo) S.maxCombo = S.combo;
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
  // drain more per bite (LEVELS[].bite multiplier). Scorpions also poison:
  // half an icon drains over the next few seconds.
function applyBite(pz: Parasite) {
    // mosquitoes drain extra on the bite itself; casual difficulty softens all
    const drain = pz.type === "mosquito" ? MOSQUITO_DRAIN : 1;
    const soften = casual ? 0.75 : 1;
    S.lives = Math.max(
      0,
      S.lives - BITE_DAMAGE * LEVELS[S.level].bite * drain * soften,
    );
    S.lastHitBy = pz.type;
    buzz(45);
if (pz.type === "scorpion") {
S.poisonT = POISON_TIME;
popup(cubeMesh.position.clone(), "POISONED!", "rampage");
}
if (pz.type === "hornet") {
S.dazeT = DAZE_TIME; // controls invert for a moment
popup(cubeMesh.position.clone(), "DAZED!", "rampage");
}
if (pz.type === "mosquito") {
popup(cubeMesh.position.clone(), "DRAINED!", "rampage");
}
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
const icon = makeHeartMesh();
const mesh = new THREE.Group();
mesh.add(icon);
addBeacon(mesh, 0xff4d6a, false);
mesh.userData.icon = icon;
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
S.heartCooldown = 17 + Math.random() * 13; // ~17–30s until next (was 20–35s)
}

function collectHeart() {
S.lives = Math.min(3, S.lives + 1); // heal one full icon
playHeal();
buzz(25);
popup(cubeMesh.position.clone(), "+1 ♥", "big");
removeHeart();
updateHUD();
}

/* ---------- power-ups (⚡ speed / ★ giant) ---------- */
function spawnPowerup() {
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
S.powerupCooldown = 3; // no spot, retry soon
return;
}
const kind: Pickup["kind"] = Math.random() < 0.5 ? "bolt" : "star";
const icon = kind === "bolt" ? makeBoltMesh() : makeStarMesh();
icon.scale.setScalar(1.35); // bigger than before — players kept missing them
const mesh = new THREE.Group();
mesh.add(icon);
addBeacon(mesh, kind === "bolt" ? 0xffe14e : 0xe05ae0, true);
mesh.userData.icon = icon;
const p = tileToWorld(ix, iz);
mesh.position.set(p.x, 0.5, p.z);
scene.add(mesh);
S.powerup = { kind, mesh, ix, iz, t: 0 };
// on-spawn callout so the player knows something worth grabbing appeared
popup(
  p.clone().setY(1),
  kind === "bolt" ? "⚡ SPEED SPAWNED!" : "★ GIANT SPAWNED!",
  "big",
);
}

function removePowerup() {
if (!S.powerup) return;
scene.remove(S.powerup.mesh);
disposeObject(S.powerup.mesh);
S.powerup = null;
S.powerupCooldown = 14 + Math.random() * 12; // ~14–26s until next (was 20–35s)
}

function collectPowerup() {
const kind = S.powerup!.kind;
buzz(35);
if (kind === "bolt") {
S.speedT = SPEED_TIME;
popup(cubeMesh.position.clone(), "⚡ SPEED!", "big");
playHeal();
} else {
S.giantT = GIANT_TIME;
cubeMesh.scale.setScalar(GIANT_SCALE);
popup(cubeMesh.position.clone(), "★ GIANT!", "big");
playRampage();
}
removePowerup();
}

/* ---------- squash ---------- */
// pierce=true ignores beetle armor (grinding a latched bug always kills)
function crushList(victims: Parasite[], strongThud: boolean, pierce = false) {
if (!victims.length) return;
let killed = 0;
for (const pz of victims) {
if (!pierce && pz.hp > 1) {
// armored beetle: first roll cracks the shell and stuns it
pz.hp--;
pz.stunT = 0.7;
pz.mesh.scale.set(1.15, 0.45, 1.15);
popup(pz.mesh.position.clone(), "CRACK!", "");
playKnock();
continue;
}
splat(pz.mesh.position.clone().setY(0), pz.def.goo, pz.type === "spider");
addKill(pz, pz.mesh.position.clone());
removeParasite(pz);
killed++;
}
if (killed) {
playThud(strongThud || killed > 1);
playSplat();
}
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
if (p.type === "pillbug") {
// curls into an armored ball while moving — only killable sitting still
return p.moveT >= 1 && p.ix === ix && p.iz === iz;
}
if (p.ix === ix && p.iz === iz) return true;
if (p.moveT < 1 && p.prevIx === ix && p.prevIz === iz) return true;
const dx = p.mesh.position.x - c.x;
const dz = p.mesh.position.z - c.z;
return dx * dx + dz * dz < 0.6 * 0.6;
});
// landed on a rolling pillbug? it shrugs it off — give the whiff some feedback
if (!victims.length) {
const curled = S.parasites.some(
(p) =>
p.state === "crawl" &&
p.type === "pillbug" &&
p.moveT < 1 &&
((p.ix === ix && p.iz === iz) ||
(p.prevIx === ix && p.prevIz === iz)),
);
if (curled) {
playKnock();
popup(tileToWorld(ix, iz), "CURLED!", "");
}
}
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
crushList(crushed, true, true);
}

/* ---------- rolling ---------- */
function tryRoll(dx: number, dz: number) {
if (!S.running || S.paused) return;
if (S.stallT > 0) return; // stuck in slime — can't roll yet
if (S.rolling) {
S.queuedDir = [dx, dz];
return;
}
const nx = S.cube.ix + dx,
nz = S.cube.iz + dz;
// rocks and termite pits both block the roll
if (isObstacle(nx, nz) || pitAt(nx, nz)) {
playKnock();
S.shake = Math.max(S.shake, 0.08);
return;
}
const anchor = cubeMesh.position
.clone()
.add(new THREE.Vector3(dx * 0.5, -0.5, dz * 0.5));
S.rolling = {
t: 0,
// ⚡ rolls fast, webbed rolls slow (both can overlap and mostly cancel)
dur:
ROLL_TIME *
(S.speedT > 0 ? SPEED_FACTOR : 1) *
(S.slowT > 0 ? WEB_SLOW_FACTOR : 1),
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
r.t += dt / r.dur;
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
if (S.giantT > 0) {
// giant mode: the landing flattens the whole 3×3 around the cube
for (let dx = -1; dx <= 1; dx++)
for (let dz = -1; dz <= 1; dz++) squashAt(r.nx + dx, r.nz + dz);
} else {
squashAt(r.nx, r.nz);
}
grindLatchedAfterRoll();
const hz = hazardAt(r.nx, r.nz);
if (hz && hz.kind !== "pit") {
removeHazard(hz); // consumed on contact; giant tears through unharmed
if (S.giantT <= 0) {
if (hz.kind === "web") {
S.slowT = WEB_SLOW_TIME;
popup(cubeMesh.position.clone(), "WEBBED!", "");
playLatch();
} else {
S.stallT = SLIME_STALL;
popup(cubeMesh.position.clone(), "STUCK!", "");
playLatch();
}
}
}
if (S.heart && S.heart.ix === r.nx && S.heart.iz === r.nz) collectHeart();
if (S.powerup && S.powerup.ix === r.nx && S.powerup.iz === r.nz)
collectPowerup();
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
casual = getSettings().difficulty === "casual";
for (const pz of [...S.parasites]) removeParasite(pz);
for (const pt of S.particles) releaseParticle(pt.mesh);
for (const d of S.decals) {
scene.remove(d.mesh);
(d.mesh.material as THREE.Material).dispose();
}
removeHeart();
removePowerup();
for (const h of [...S.hazards]) removeHazard(h);
while (S.globs.length) removeGlob(S.globs.length - 1);
cubeMesh.scale.setScalar(1);
trailFx.clear(); // no stale streak lingering from the previous run
S.particles = [];
S.decals = [];
pauseScreen.classList.add("hidden");
pauseBtn.textContent = "❚❚";
Object.assign(S, {
running: true,
paused: false,
time: 0,
score: 0,
lastHitBy: "",
level: 0,
lives: 3,
combo: 0,
maxCombo: 0,
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
powerup: null,
powerupCooldown: 10,
hazards: [],
speedT: 0,
giantT: 0,
slowT: 0,
poisonT: 0,
stallT: 0,
dazeT: 0,
});
biteGlow.style.opacity = "0";
poisonGlow.style.opacity = "0";
buffsEl.textContent = "";
endCombo();
applyLevel(0);
placeCube();
updateWorld();
updateHUD();
}

function gameOver() {
S.running = false;
const prevBest = S.best;
S.best = Math.max(S.best, S.score);
localStorage.setItem("crush-best", String(S.best));
// coin payout: score converted at SCORE_PER_COIN, capped — see coinsForScore()
const earned = coinsForScore(S.score);
addCoins(earned);
$("newbest-chip").classList.toggle("hidden", S.score <= prevBest);
$("final-score").textContent = S.score.toLocaleString();
$("final-best").textContent = S.best.toLocaleString();
$("go-level").textContent = `${S.level + 1} · ${LEVELS[S.level].name}`;
$("go-bugs").textContent = String(S.totalKills);
$("final-coins").textContent = `+${earned}`;
$("final-stats").textContent = S.lastHitBy
  ? `Overrun by ${S.lastHitBy}s at LVL ${S.level + 1}.`
  : `The horde got you at LVL ${S.level + 1}.`;
if (earned > 0) playCoin();
buzz(120);
// Username is set once. After that every run auto-saves (server keeps the
// highest). First-time players get prompted for a username in the board modal.
// scoreSaved only flips true once the server actually confirms the write —
// never optimistically — so a rate-limited/failed submit doesn't lie to the
// player about their run being saved.
scoreSaved = false;
if (getInitials()) {
  void submitScore(S.score).then((result) => {
    if (result) markSaved();
  });
}
$("gameover-screen").classList.remove("hidden");
endCombo();
}

// Fetch + render today's board into the modal. Best-effort — failures leave
// the game fully playable offline.
async function renderBoardInto() {
  const board = $("leaderboard");
  board.innerHTML = '<p class="lb-empty">Loading…</p>';
  renderBoard(board, await fetchBoard());
}

/* ---------- input & buttons ---------- */
const pauseBtn = $("pause-btn");
const pauseScreen = $("pause-screen");

function setPause(p: boolean) {
if (!S.running) return;
S.paused = p;
if (p) {
  // live run snapshot on the pause card
  $("pause-score").textContent = S.score.toLocaleString();
  $("pause-bugs").textContent = String(S.totalKills);
  $("pause-combo").textContent = `×${Math.min(S.combo, 8)}`;
}
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

// ---- Leaderboard modal ----
// Opened from the game-over "LEADERBOARD" button (offers to save this run) and
// from the start-menu "LEADERBOARD" tile (view-only). Nothing is submitted
// until the player types a username and hits SAVE.
const initialsInput = $("initials-input") as HTMLInputElement;
let scoreSaved = false;
let boardCanSave = false; // last canSave passed to openBoard; lets async saves update the badge live

// Marks the current run as confirmed-saved. Only ever called after the
// server has actually accepted the write. If the board modal is already
// open, flips the badge and refreshes the board so the new score shows up
// immediately instead of only on the next open.
function markSaved() {
  scoreSaved = true;
  if (!$("board-modal").classList.contains("hidden")) {
    $("board-saved").classList.toggle("hidden", !boardCanSave);
    void renderBoardInto();
  }
}

// canSave: game-over path. Prompt for a username only the first time (no name
// stored yet); once set it's locked and every run auto-saves. View-only when
// opened from the start menu.
function openBoard(canSave: boolean) {
  boardCanSave = canSave;
  const needsName = canSave && S.score > 0 && !getInitials();
  $("board-save").classList.toggle("hidden", !needsName);
  $("board-saved").classList.toggle("hidden", !(canSave && scoreSaved));
  $("board-modal").classList.remove("hidden");
  void renderBoardInto();
}
const closeBoard = () => $("board-modal").classList.add("hidden");

// First-time save: set the username (write-once) and submit this run.
const onSaveScore = async () => {
  const name = setInitials(initialsInput.value); // sanitizes + persists
  if (!name) {
    toast("Type a username first");
    initialsInput.focus();
    return;
  }
  initialsInput.value = name;
  const result = await submitScore(S.score);
  if (!result) {
    toast("Couldn't save — try again");
    return;
  }
  $("board-save").classList.add("hidden");
  markSaved();
};

const ranksBtn = $("gameover-ranks");
const boardBtn = $("board-btn");
const boardCloseBtn = $("board-close");
const boardSaveBtn = $("board-save-btn");
const onOpenSavable = () => openBoard(true);
const onOpenView = () => openBoard(false);
const onBoardBackdrop = (e: Event) => {
  if (e.target === $("board-modal")) closeBoard();
};
ranksBtn.addEventListener("click", onOpenSavable);
boardBtn.addEventListener("click", onOpenView);
boardCloseBtn.addEventListener("click", closeBoard);
boardSaveBtn.addEventListener("click", onSaveScore);
$("board-modal").addEventListener("click", onBoardBackdrop);

const onResume = () => setPause(false);
pauseBtn.addEventListener("click", togglePause);
resumeBtn.addEventListener("click", onResume);

// Count share -> play conversion if arrived via a challenge link.
trackRef();

// Home screen: nudge returning players whose streak breaks if they skip today.
void (async () => {
  const me = await fetchMe();
  const nudge = $("streak-nudge");
  if (nudge && me && me.atRisk && me.streak > 0) {
    nudge.textContent = `🔥 ${me.streak} day streak — play today to keep it`;
  }
})();

// pause-menu extras + game-over exit back to the Start screen
const onPauseRestart = () => resetGame();
const onQuitToMenu = () => {
  S.running = false;
  S.paused = false;
  pauseScreen.classList.add("hidden");
  pauseBtn.textContent = "❚❚";
  showStart();
};
const onGameoverMenu = () => {
  $("gameover-screen").classList.add("hidden");
  showStart();
};
const pauseRestartBtn = $("pause-restart");
const pauseMenuBtn = $("pause-menu");
const gameoverMenuBtn = $("gameover-menu");
pauseRestartBtn.addEventListener("click", onPauseRestart);
pauseMenuBtn.addEventListener("click", onQuitToMenu);
gameoverMenuBtn.addEventListener("click", onGameoverMenu);

// menu screens (start/how-to/shop/settings) wire themselves
const disposeMenus = initMenus();

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
const typingInField =
document.activeElement instanceof HTMLInputElement ||
document.activeElement instanceof HTMLTextAreaElement;
if (KEYMAP[e.code] && !typingInField) {
e.preventDefault();
audio();
if (!heldMoveCodes.includes(e.code)) heldMoveCodes.push(e.code);
}
if (
e.code === "KeyR" &&
!S.running &&
!typingInField &&
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
applyCubeStyle(); // equipped skin shows on the menu-background cube too
updateWorld();
updateHUD();
camera.position.copy(cubeMesh.position).add(CAM_OFFSET);
const clock = new THREE.Clock();
let rafId = 0;
let hudAcc = 0; // throttles heart re-renders during poison drain

function tick() {
rafId = requestAnimationFrame(tick);
const dt = Math.min(clock.getDelta(), 0.05);

let anyAttached = false;

if (S.running && !S.paused) {
S.time += dt;

S.spawnTimer -= dt;
if (S.spawnTimer <= 0) {
spawnParasite();
// swarm (late levels) packs spawns tighter on top of the time ramp
const swarm = LEVELS[S.level].swarm ?? 1;
const interval =
  Math.max(0.45, (2.2 - S.time * 0.022) / swarm) * (casual ? 1.18 : 1);
S.spawnTimer = interval * (0.7 + Math.random() * 0.6);
}

// effect timers
if (S.speedT > 0) S.speedT -= dt;
if (S.slowT > 0) S.slowT -= dt;
if (S.stallT > 0) S.stallT -= dt;
if (S.dazeT > 0) S.dazeT -= dt;
if (S.giantT > 0) {
S.giantT -= dt;
if (S.giantT <= 0) cubeMesh.scale.setScalar(1); // shrink back
}
if (S.poisonT > 0) {
S.poisonT -= dt;
S.lives = Math.max(0, S.lives - POISON_DPS * dt * (casual ? 0.75 : 1));
hudAcc += dt;
if (hudAcc > 0.15) {
hudAcc = 0;
updateHUD(); // hearts drain visibly while poisoned
}
if (S.lives <= 0) {
updateHUD();
gameOver();
}
}

// active-effect readout under the level label
{
let b = "";
if (S.speedT > 0) b += `⚡ ${Math.ceil(S.speedT)}s  `;
if (S.giantT > 0) b += `★ ${Math.ceil(S.giantT)}s  `;
if (S.slowT > 0) b += "🕸 SLOWED  ";
if (S.stallT > 0) b += "🐌 STUCK  ";
if (S.dazeT > 0) b += "🌀 DAZED  ";
if (S.poisonT > 0) b += "☠ POISONED";
buffsEl.textContent = b;
}

if (S.combo > 0) {
S.comboTimer -= dt;
comboLabel.textContent = `x${Math.min(S.combo, 8)}${S.rampage ? " RAMPAGE" : " COMBO"}`;
comboLabel.classList.toggle("rampage", S.rampage);
comboBar.style.width = (S.comboTimer / COMBO_WINDOW) * 100 + "%";
if (S.comboTimer <= 0) endCombo();
}

// held input: newest key wins, else touch drag — keep rolling while idle.
// hornet daze inverts the direction for a couple seconds.
const lastKey = heldMoveCodes[heldMoveCodes.length - 1];
const heldDir = lastKey ? KEYMAP[lastKey] : touchDir;
if (heldDir && !S.rolling) {
const inv = S.dazeT > 0 ? -1 : 1;
tryRoll(heldDir[0] * inv, heldDir[1] * inv);
}

updateRoll(dt);
trailFx.update(dt, cubeMesh.position, !!S.rolling);
auraFx.update(dt);

const spd = LEVELS[S.level].speed; // parasite speed ramps with level
for (let i = S.parasites.length - 1; i >= 0; i--) {
const pz = S.parasites[i];
pz.animT += dt;
if (pz.state === "crawl") {
// shell just cracked: frozen flat for a beat, then pops back up
if (pz.stunT > 0) {
pz.stunT -= dt;
if (pz.stunT <= 0) pz.mesh.scale.setScalar(1);
continue;
}
// egg sac never moves; it hatches a brood if not crushed in time
if (pz.type === "eggsac") {
pz.hatchT -= dt;
pz.mesh.userData.animate(pz.animT);
if (pz.hatchT <= 0) {
hatchEggSac(pz);
} else if (
Math.max(Math.abs(pz.ix - S.cube.ix), Math.abs(pz.iz - S.cube.iz)) >
DESPAWN_R
) {
removeParasite(pz);
}
continue;
}
if (pz.type === "locust" && pz.dashT > 0) pz.dashT -= dt;
// spitter fires only while planted (not mid-slide) and in range —
// the standing-still charge-up is the player's dodge telegraph
if (pz.type === "spitter" && pz.moveT >= 1) {
  pz.spitT -= dt;
  if (pz.spitT <= 0) {
    const cdx = S.cube.ix - pz.ix,
      cdz = S.cube.iz - pz.iz;
    const cheb = Math.max(Math.abs(cdx), Math.abs(cdz));
    if (cheb >= 2 && cheb <= SPIT_RANGE_MAX) {
      pz.mesh.rotation.set(0, Math.atan2(cdx, cdz) - Math.PI / 2, 0);
      launchSpit(pz);
      pz.spitT = SPIT_CD_MIN + Math.random() * (SPIT_CD_MAX - SPIT_CD_MIN);
    } else {
      pz.spitT = 0.4; // out of range: recheck soon
    }
  }
}
if (pz.moveT < 1) {
pz.moveT = Math.min(
1,
pz.moveT + (dt * spd * pz.slideMul) / (pz.def.interval * 0.55),
);
pz.mesh.position.lerpVectors(pz.fromPos, pz.toPos, pz.moveT);
if (pz.moveT >= 1) pz.slideMul = 1; // lunge over, resume normal pace
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
applyBite(pz);
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
// bob/spin the icon only — the beacon ring must stay flat on the soil
const hIcon = h.mesh.userData.icon as THREE.Group;
hIcon.rotation.y += dt * 1.6;
hIcon.position.y = Math.sin(h.t * 3) * 0.09;
(h.mesh.userData.beaconRing as THREE.Mesh).scale.setScalar(
  1 + Math.sin(h.t * 4) * 0.15,
);
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

// power-up lifecycle (same rhythm as hearts, rarer)
if (S.powerup) {
const pu = S.powerup;
pu.t += dt;
const puIcon = pu.mesh.userData.icon as THREE.Group;
puIcon.rotation.y += dt * 2.2;
puIcon.position.y = Math.sin(pu.t * 3) * 0.09;
// breathe: the icon and its ground ring pulse so it reads from far away
puIcon.scale.setScalar(1.35 * (1 + Math.sin(pu.t * 5) * 0.1));
(pu.mesh.userData.beaconRing as THREE.Mesh).scale.setScalar(
  1 + Math.sin(pu.t * 4.5) * 0.18,
);
const dist = Math.max(
Math.abs(pu.ix - S.cube.ix),
Math.abs(pu.iz - S.cube.iz),
);
if (pu.t > POWERUP_LIFE)
pu.mesh.visible = Math.floor(pu.t * 6) % 2 === 0;
if (pu.t > POWERUP_LIFE + POWERUP_BLINK || dist > HEART_DESPAWN_R) {
removePowerup();
}
} else if (S.score >= POWERUP_MIN_SCORE) {
S.powerupCooldown -= dt;
if (S.powerupCooldown <= 0) spawnPowerup();
}

// acid globs in flight: arc to their target tile, then hit or splat
for (let i = S.globs.length - 1; i >= 0; i--) {
  const g = S.globs[i];
  g.t += dt / g.dur;
  const t = Math.min(g.t, 1);
  g.mesh.position.lerpVectors(g.from, g.to, t);
  g.mesh.position.y += Math.sin(t * Math.PI) * 0.9; // lob arc
  if (g.t < 1) continue;
  const impact = g.to.clone();
  removeGlob(i);
  splat(impact.setY(0), 0x9fe32a, false);
  // rolling when it lands = dodged (S.cube only commits at roll end)
  if (S.cube.ix === g.ix && S.cube.iz === g.iz && !S.rolling) {
    if (S.giantT > 0) {
      popup(cubeMesh.position.clone(), "BLOCKED!", "");
      playKnock();
    } else {
      applySpitHit();
    }
  } else {
    dropHazard("slime", g.ix, g.iz); // near-miss still poisons the tile
  }
}

// ground hazards age out (fade over their last 2s)
for (let i = S.hazards.length - 1; i >= 0; i--) {
const h = S.hazards[i];
h.t += dt;
if (h.t > h.life - 2) {
const base = HAZARD_STYLE[h.kind].opacity;
(h.mesh.material as THREE.MeshBasicMaterial).opacity =
base * Math.max(0, (h.life - h.t) / 2);
}
if (h.t >= h.life) removeHazard(h);
}
}

biteGlow.style.opacity = String(S.glow);
poisonGlow.style.opacity =
S.poisonT > 0 ? String(0.25 + 0.35 * (S.poisonT / POISON_TIME)) : "0";

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
ranksBtn.removeEventListener("click", onOpenSavable);
boardBtn.removeEventListener("click", onOpenView);
boardCloseBtn.removeEventListener("click", closeBoard);
boardSaveBtn.removeEventListener("click", onSaveScore);
$("board-modal").removeEventListener("click", onBoardBackdrop);
pauseBtn.removeEventListener("click", togglePause);
resumeBtn.removeEventListener("click", onResume);
pauseRestartBtn.removeEventListener("click", onPauseRestart);
pauseMenuBtn.removeEventListener("click", onQuitToMenu);
gameoverMenuBtn.removeEventListener("click", onGameoverMenu);
window.removeEventListener("crush:skin", onSkinChange);
window.removeEventListener("crush:trail", onTrailChange);
window.removeEventListener("crush:aura", onAuraChange);
trailFx.dispose();
auraFx.dispose();
disposeMenus();
renderer.domElement.remove();
renderer.dispose();
};
}