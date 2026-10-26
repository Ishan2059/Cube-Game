require('./register.cjs');
const assert = require('node:assert/strict');
const storage = {};
Object.defineProperties(storage, {
  getItem:{value:key=>storage[key]??null},
  setItem:{value:(key,value)=>{storage[key]=String(value);}},
  removeItem:{value:key=>{delete storage[key];}},
});
global.localStorage = storage;
global.window = new EventTarget();
let reloads=0;
global.location={reload(){reloads++;}};
let online = true;
let responseLost = true;
let resetFails = false;
let sends = 0;
global.fetch = async (path,options) => {
  if (!online) throw new Error('offline');
  if(path==='/api/session') return Response.json({pid:'server-player'});
  if(path==='/api/run') return Response.json({pid:'server-player',runId:'run-1',mode:JSON.parse(options.body).mode,expiresAt:Date.now()+86400000});
  if(path==='/api/reset') return Response.json({}, {status:resetFails?503:200});
  if(path==='/api/score') {
    sends++;
    if(responseLost) throw new Error('response lost after server commit');
    return Response.json({rank:1,total:1,best:60,score:60,streak:1});
  }
  throw new Error('Unexpected URL: '+path);
};
(async()=>{
  let client=require('../game/run-client.ts');
  assert.equal(await client.beginRun('normal'),true);
  client.recordEvent(1,'worm');client.recordEvent(2,'bug');
  const run=client.finishRun(3);
  assert.equal(await client.saveRun(run,'Alice'),null);
  assert.equal(storage.getItem('crush-initials'),null,'name waits for confirmation');
  assert.equal(client.pendingRuns().length,1,'lost response remains durable');
  delete require.cache[require.resolve('../game/run-client.ts')];
  client=require('../game/run-client.ts');
  assert.equal(client.saveCandidate().initials,'Alice','retry form survives reload');
  responseLost=false;
  await Promise.all([client.retryPending(),client.retryPending()]);
  assert.equal(sends,2,'only one retry loop');
  assert.equal(client.pendingRuns().length,0);
  assert.equal(storage.getItem('crush-initials'),'Alice');
  online=false;
  assert.equal(await client.beginRun('normal'),false);
  client.recordEvent(1,'worm');
  assert.equal(client.finishRun(3),null,'offline start cannot acquire a run retroactively');
  online=true; resetFails=true;
  storage.setItem('crush-best','300000');
  assert.equal(await client.resetProgress(),false);
  assert.equal(storage.getItem('crush-best'),'300000','failed reset retains local state');
  resetFails=false;
  assert.equal(await client.resetProgress(),true);
  assert.equal(storage.getItem('crush-best'),null);
  assert.equal(reloads,1,'reset reloads all engine and menu state');
  console.log('ok — durable retries, reload, offline, first name, full reset');
})().catch(error=>{console.error(error);process.exitCode=1;});
