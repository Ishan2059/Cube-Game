require('./register.cjs');
const assert=require('node:assert/strict');
const {worldTile,roadAt,roadCurve,roadsNear,canTraverse,isDestructible,landmarksNear,housesNear,houseLoot,RARE_GATE,hellLockRemaining,HELL_LOCK_MS}=require('../game/world-rules.ts');
const {bushAt,createCover,bushPatchesNear}=require('../game/cover.ts');
const {coinAt,createCoinLedger,visibleCoinBudget,coinsForKills}=require('../game/coin-rules.ts');
const {jumpProfile,canJump}=require('../game/jump-rules.ts');
const {scoreRun}=require('../lib/run-validation.ts');
let water=0,bridgeEdges=0,destructibles=0,chests=new Set();
for(let x=-100;x<=100;x++)for(let z=-100;z<=100;z++){
  const t=worldTile(x,z,'meadow');
  if(t.surface==='water'){
    water++;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      assert.equal(canTraverse(x+dx,z+dz,x,z,'meadow',true),false,'insects cannot enter water');
      if(worldTile(x+dx,z+dz,'meadow').bridge){bridgeEdges++;assert(!canTraverse(x,z,x+dx,z+dz,'meadow'));assert(!canTraverse(x+dx,z+dz,x,z,'meadow'));}
    }
  }
  if(isDestructible(x,z,'meadow'))destructibles++;
}
assert(water>0&&bridgeEdges>0&&destructibles>0);
for(let x=-100;x<=100;x+=16)for(let z=-100;z<=100;z+=16){
  for(const p of landmarksNear(x,z,'meadow')){
    if(p.kind==='portal')assert.deepEqual([p.x,p.z],[RARE_GATE.x,RARE_GATE.z]);
    if(p.kind==='treasure'){const t=worldTile(p.x,p.z,'meadow');assert(!t.blocked&&!t.bridge&&t.surface!=='water');chests.add(p.id);}
  }
}
assert(chests.size>0&&chests.size<20,'outdoor treasure is rare, static and reachable');
assert(!landmarksNear(0,0,'meadow').some(p=>p.kind==='portal'));
for(const patch of bushPatchesNear(0,0,'meadow'))for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)assert(bushAt(patch.x+dx,patch.z+dz,'meadow'),'whole 3x3 is cover');
const cover=createCover();cover.update(0,false,0,0);cover.update(0,true,-4,3);assert(cover.hidden);cover.update(60,true,-4,3);assert(cover.hidden,'cover remains invisible for the whole stay');assert.deepEqual(cover.target,{x:0,z:0});cover.update(0,false,-2,3);assert(!cover.hidden);
assert.equal(hellLockRemaining(100+HELL_LOCK_MS,100),HELL_LOCK_MS);assert.equal(hellLockRemaining(NaN,100),0);assert.equal(hellLockRemaining(50,100),0);
const loots=Array.from({length:20},(_,i)=>houseLoot('house:'+i,123));assert(new Set(loots.map(l=>JSON.stringify(l))).size>15);assert.deepEqual(houseLoot('house:1',123),houseLoot('house:1',123));
for(let bugs=0;bugs<=100;bugs++){const budget=visibleCoinBudget(bugs);assert(budget<=4);assert(bugs===0?budget===0:budget<bugs);}
let coins=0;for(let x=-100;x<100;x++)for(let z=-100;z<100;z++)if(coinAt(x,z))coins++;assert(coins<250,'loose coins are scarce');
const ledger=createCoinLedger();assert(ledger.collect(-3,7));assert(!ledger.collect(-3,7));ledger.setRegion('cinder');assert(ledger.collect(-3,7));ledger.setRegion('meadow');assert(ledger.has(-3,7));ledger.reset();assert(!ledger.has(-3,7));assert.equal(coinsForKills(310),61);
assert(jumpProfile(12).tiles>jumpProfile(7).tiles);assert(jumpProfile(7).tiles>jumpProfile(0).tiles);assert(jumpProfile(12).height>jumpProfile(7).height);
let jumpCase=false;
for(let x=-25;x<25&&!jumpCase;x++)for(let z=-25;z<25&&!jumpCase;z++){
  if(isDestructible(x+1,z,'meadow')&&!worldTile(x,z,'meadow').blocked&&!worldTile(x+2,z,'meadow').blocked&&canJump(x,z,1,0,2,'meadow',()=>false)){
    assert(!canTraverse(x,z,x+1,z,'meadow'));assert(canTraverse(x,z,x+1,z,'meadow',false,true));jumpCase=true;
  }
}
assert(jumpCase,'jump clears an obstacle and lands on a free tile');
const house=[-192,-128,-64,0,64,128,192].flatMap(x=>[-192,-128,-64,0,64,128,192].flatMap(z=>housesNear(x,z))).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];assert(house);
assert(!canJump(house.x,house.z,0,-1,2,'meadow',()=>false),'cannot jump through house walls');
assert.equal(isDestructible(house.x,house.z-1,'meadow'),false);
assert(scoreRun([[95000,'beetle']],96000,97000,'normal')>0,'timed exploration unlock can save');
console.log('ok - water/bridges, rare reachable loot, 3x3 cover, coin limits, momentum jumps and timed scoring');

for(const base of roadsNear(0,0).vertical){
  const centers=Array.from({length:201},(_,i)=>Math.round(roadCurve(base,i-100)));
  assert(new Set(centers).size>6,'roads bend instead of repeating straight strips');
  for(let i=1;i<centers.length;i++){
    const z=i-100,prev=centers[i-1],next=centers[i];
    assert(roadAt(next,z));
    assert(prev===next||roadAt(prev,z)||roadAt(next,z-1),'bends remain connected on the roll grid');
  }
}
