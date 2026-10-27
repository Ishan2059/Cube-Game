require('./register.cjs');
const assert=require('node:assert/strict');
const THREE=require('three');
const {makeParasiteMesh,TYPES}=require('../game/parasites.ts');
const {createObstacleLibrary}=require('../game/obstacles.ts');
const {disposeModel}=require('../game/model.ts');

for(const type of Object.keys(TYPES)) {
  const group=makeParasiteMesh(type),mesh=group.children[0];
  assert.equal(group.children.length,1,`${type}: one draw call`);
  assert(mesh.isSkinnedMesh);
  assert(mesh.geometry.attributes.position.count/3<=8000,`${type}: triangle ceiling`);
  const before=mesh.skeleton.bones.map(b=>b.matrixWorld.clone());
  group.userData.animate(.4);group.updateMatrixWorld(true);
  assert(mesh.skeleton.bones.some((b,i)=>!b.matrixWorld.equals(before[i])),`${type}: animation survives batching`);
  for(const value of mesh.geometry.attributes.position.array) assert(Number.isFinite(value));
  disposeModel(group);
}
const obstacles=createObstacleLibrary();
for(let i=0;i<5;i++) {
  const a=obstacles.create(i),b=obstacles.create(i);
  assert.equal(a.geometry,b.geometry,'obstacle copies share geometry');
  const bounds=new THREE.Box3().setFromObject(a),size=bounds.getSize(new THREE.Vector3());
  assert(size.x<=1 && size.z<=1,'obstacle remains inside the existing tile');
}
obstacles.dispose();

const data=new Map();
global.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const storage=require('../game/storage.ts');
data.set('crush-skins-owned',JSON.stringify(['classic','venom','magma']));
data.set('crush-skin',JSON.stringify('venom'));
data.set('crush-trails-owned',JSON.stringify(['ember','frost','toxin']));
data.set('crush-trail',JSON.stringify('ember'));
data.set('crush-coins','1200');
assert.equal(storage.getOwnedSkins().length,3,'only purchased skins are owned');
assert.equal(data.get('crush-skins-owned'),JSON.stringify(['classic','venom','magma']),'preview does not rewrite purchases');
assert.equal(storage.getEquippedSkin(),'mossling');
assert.equal(storage.getOwnedTrails().length,4,'only purchased trails and None are owned');
assert.equal(storage.getEquippedTrail(),'afterburn');
assert.equal(storage.getCoins(),1200,'migration preserves wallet');
const access=require('../game/cosmetic-access.ts');assert.equal(access.PREVIEW_UNLOCK_ALL,false);
data.set('crush-skin',JSON.stringify('boba'));data.set('crush-trail',JSON.stringify('starfall'));
assert.equal(storage.getEquippedSkin(),'classic','ending preview restores ownership checks');assert.equal(storage.getEquippedTrail(),'none');
access.PREVIEW_UNLOCK_ALL=true;
assert.equal(storage.getEquippedSkin(),'boba','preview preserves the stored selection');
access.PREVIEW_UNLOCK_ALL=false;
assert(!storage.spendCoins(1600),'unaffordable purchase cannot spend coins');
assert.equal(storage.getCoins(),1200);
assert(storage.spendCoins(600));storage.ownSkin('boba');storage.setEquippedSkin('boba');
assert.equal(storage.getEquippedSkin(),'boba');assert.equal(storage.getCoins(),600);

let now=0,peak=0;
Object.defineProperty(global,'performance',{value:{now:()=>now},configurable:true});
global.document={hidden:false};
const active=new Set(),requests=[],history=[];let deferDecode=false,finishDecode;const deferredDecodes=[];
const parameter=()=>({value:0,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}});
class Context {
  state='running';currentTime=0;destination={};
  createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
  createDynamicsCompressor(){return {threshold:parameter(),knee:parameter(),ratio:parameter(),connect(){}};}
  createBufferSource(){
    const source={connect(){},disconnect(){},start(at=0){source.startedAt=at;active.add(source);history.push(source);peak=Math.max(peak,active.size);},stop(at=0){source.stoppedAt=at;active.delete(source);source.onended?.();},onended:null};return source;
  }
  resume(){return Promise.resolve();}
  decodeAudioData(bytes){const buffer={duration:.2,label:bytes.label};if(deferDecode&&bytes.label.includes("roll_ash"))return new Promise(resolve=>{deferredDecodes.push(()=>resolve(buffer));finishDecode=()=>deferredDecodes.splice(0).forEach(done=>done());});return Promise.resolve(buffer);}
}
global.AudioContext=Context;
global.fetch=async url=>{requests.push(url);return {ok:!/acid_land.*\.ogg$/.test(url),arrayBuffer:async()=>Object.assign(new ArrayBuffer(4),{label:url})};};
const sound=require('../game/audio.ts');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  sound.audio();await flush();
  sound.playCue('exploration.roll_grass');sound.playCue('exploration.roll_grass');
  assert.equal(active.size,1,'same event is rate limited');
  sound.stopAudio();now+=1000;sound.playSurfaceRoll('grass');await flush();
  assert([...active].some(v=>v.buffer.label.includes('roll_grass')));
  const grassVoice=[...active].find(v=>v.buffer.label.includes('roll_grass'));
  sound.setMovementSurface('water');
  assert.equal(active.size,0,'water takeoff cancels grass before landing');
  now+=1000;sound.playSurfaceRoll('water','grass');await flush();
  const waterVoice=[...active].find(v=>v.buffer.label.includes('splash'));
  assert(waterVoice.startedAt>=grassVoice.stoppedAt,'water starts after the dry fade, never across it');
  assert([...active].every(v=>!v.buffer.label.includes('roll_grass')&&!v.buffer.label.includes('roll_wood')),'water stops dry movement tails');
  assert([...active].some(v=>v.buffer.label.includes('splash')),'shore entry is water only');
  now+=1000;sound.playSurfaceRoll('water','water');await flush();
  assert([...active].some(v=>v.buffer.label.includes('roll_water')));
  assert.equal([...active].filter(v=>/roll_|splash/.test(v.buffer.label)).length,1,'one movement voice, including repeated water steps');
  now+=1000;sound.playSurfaceRoll('grass','water');await flush();
  assert.equal(active.size,1);assert([...active][0].buffer.label.includes('water_exit'),'shore exit does not layer grass over water');
  // First ash sample is warm; hold the next one to simulate a late network/decode.
  now+=1000;deferDecode=true;sound.playSurfaceRoll('ash');await flush();
  now+=1000;sound.playSurfaceRoll('ash');await flush();assert(finishDecode);
  sound.setMovementSurface('water');finishDecode();deferDecode=false;await flush();
  assert([...active].every(v=>!v.buffer.label.includes('roll_ash')),'pending dry movement cannot start after entering water');
  sound.setMuted(true);assert.equal(active.size,0,'mute stops active voices');
  sound.playCue('ui.press');await flush();assert.equal(active.size,0,'mute blocks new voices');
  sound.setMuted(false);now+=1000;
  sound.playCue('hazards.acid_land');sound.stopAudio();await flush();
  assert.equal(active.size,0,'a sound loaded after stop is not replayed');
  assert(requests.some(url=>/acid_land.*\.wav$/.test(url)),'unsupported format falls back to WAV');
  for(const cue of Object.keys(require('../game/audio-bank.json'))) {now+=1000;sound.playCue(cue);await flush();}
  assert(peak<=12,'simultaneous voices are bounded');
  sound.stopAudio();global.document.hidden=true;now+=1000;sound.playCue('ui.press');await flush();
  assert.equal(active.size,0,'hidden page stays silent');
  console.log('ok — model batching, animation, collision footprint, legacy cosmetics and audio limits');
})().catch(e=>{console.error(e);process.exitCode=1;});
