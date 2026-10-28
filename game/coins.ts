import * as THREE from "three";
import { bakeModel, disposeModel } from "./model";
import { coinAt, createCoinLedger, visibleCoinBudget } from "./coin-rules";

/** Bevelled rim, inset face and raised cube stamp, all merged into one draw call. */
export function makeCoinMesh(): THREE.Mesh {
  const group = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, color: number, z = 0) => {
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
    mesh.position.z = z; group.add(mesh); return mesh;
  };
  const body = new THREE.CylinderGeometry(.21, .21, .055, 24);
  body.rotateX(Math.PI / 2); add(body, 0xc88a20);
  for (const side of [-1, 1]) {
    add(new THREE.TorusGeometry(.185, .017, 6, 24), 0xffd56a, side * .034);
    add(new THREE.CircleGeometry(.166, 24), 0xe9ad35, side * .029).rotation.y = side < 0 ? Math.PI : 0;
    const stamp = add(new THREE.BoxGeometry(.12, .12, .016), 0xffde77, side * .038);
    stamp.rotation.z = Math.PI / 4;
  }
  const mesh = bakeModel(group), material = mesh.material as THREE.MeshStandardMaterial;
  material.metalness = .65; material.roughness = .28;
  material.emissive.setHex(0x765015); material.emissiveIntensity = .16;
  return mesh;
}

/** One instanced draw for map coins and their pickup arcs; no meshes allocated per frame. */
export function createCoinField(scene: THREE.Scene, blocked: (x: number, z: number) => boolean, bugCount:()=>number) {
  const capacity = 128, radius = 12, ledger = createCoinLedger();
  const model = makeCoinMesh(), mesh = new THREE.InstancedMesh(model.geometry, model.material, capacity + 16);
  mesh.count = 0; mesh.frustumCulled = false; scene.add(mesh);
  const active: { x: number; z: number; phase: number }[] = [];
  const flights = Array.from({ length: 16 }, () => ({ x: 0, z: 0, age: 1 }));
  const dummy = new THREE.Object3D(); let time = 0, flightIndex = 0, limit = -1, centerX=0,centerZ=0;
  function sync(cx: number, cz: number) {
    centerX=cx;centerZ=cz;limit=visibleCoinBudget(bugCount());
    active.length = 0;
    for (let x = cx - radius; x <= cx + radius; x++) for (let z = cz - radius; z <= cz + radius; z++) {
      if (active.length < capacity && coinAt(x, z) && !ledger.has(x, z) && !blocked(x, z)) {
        active.push({ x, z, phase: x * .7 + z * 1.3 });
      }
    }
    active.sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz));
    active.length=Math.min(active.length,limit);
  }
  return {
    get count(){return active.length;},
    sync,
    setRegion(region: string) { ledger.setRegion(region); active.length=0; flights.forEach(f=>f.age=1); mesh.count=0; },
    collect(x: number, z: number, reach = 0) {
      let amount = 0;
      for (let i = active.length - 1; i >= 0; i--) {
        const coin = active[i];
        if (Math.abs(coin.x - x) > reach || Math.abs(coin.z - z) > reach || blocked(coin.x, coin.z)) continue;
        if (ledger.collect(coin.x, coin.z)) {
          const flight = flights[flightIndex++ % flights.length];
          flight.x = coin.x; flight.z = coin.z; flight.age = 0; amount++;
        }
        active.splice(i, 1);
      }
      return amount;
    },
    update(dt: number, cube: THREE.Vector3) {
      if(limit!==visibleCoinBudget(bugCount()))sync(centerX,centerZ);
      time += dt; let count = 0;
      for (const coin of active) {
        dummy.position.set(coin.x, .38 + Math.sin(time * 2.8 + coin.phase) * .055, coin.z);
        dummy.rotation.set(.08, time * 1.8 + coin.phase, .05); dummy.scale.setScalar(1);
        dummy.updateMatrix(); mesh.setMatrixAt(count++, dummy.matrix);
      }
      for (const coin of flights) {
        coin.age += dt; if (coin.age >= .45) continue;
        const t = coin.age / .45, ease = t * t;
        dummy.position.set(coin.x + (cube.x - coin.x) * ease, .38 + Math.sin(t * Math.PI) * .65, coin.z + (cube.z - coin.z) * ease);
        dummy.rotation.set(0, time * 9, t * 3); dummy.scale.setScalar(1 - t * .8);
        dummy.updateMatrix(); mesh.setMatrixAt(count++, dummy.matrix);
      }
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true;
    },
    reset() { ledger.reset(); active.length = 0; flights.forEach(f => f.age = 1); mesh.count = 0; time = 0; },
    dispose() { scene.remove(mesh); mesh.dispose(); disposeModel(model); },
  };
}
