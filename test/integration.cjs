require('./register.cjs');
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { startRedisRest } = require('./redis-rest.cjs');

(async () => {
  if (!process.env.TEST_REDIS_URL) throw new Error('TEST_REDIS_URL is required; use a dedicated test Redis');
  const bridge = await startRedisRest(process.env.TEST_REDIS_URL);
  process.env.KV_REST_API_URL = bridge.url;
  process.env.KV_REST_API_TOKEN = 'integration';
  process.env.REDIS_NAMESPACE = 'test-' + randomUUID();
  const { key, rateLimit } = require('../lib/server-api.ts');
  const routes = Object.fromEntries(['session','run','score','rename','reset','me','leaderboard'].map(name => [name, require(`../app/api/${name}/route.ts`)]));
  const request = (route, data = {}, cookie = '', method = 'POST', origin = 'http://localhost') => new Request('http://localhost/api/' + route, {
    method, headers: {'Content-Type':'application/json', origin, cookie}, ...(method === 'POST' ? {body:JSON.stringify(data)} : {}),
  });
  const call = (route, data, cookie) => routes[route].POST(request(route, data, cookie));
  const session = async () => {
    const res = await call('session'); assert.equal(res.status,200);
    assert.match(res.headers.get('set-cookie'), /HttpOnly/i);
    return { cookie:res.headers.get('set-cookie').split(';')[0], ...(await res.json()) };
  };
  try {
    const alice = await session(); const bob = await session();
    assert.notEqual(alice.pid,bob.pid);
    assert.equal((await call('rename',{pid:alice.pid,initials:'Hacker'})).status,401);
    assert.equal((await routes.rename.POST(request('rename',{initials:'Hacker'},alice.cookie,'POST','https://evil.test'))).status,403);
    await call('rename',{pid:alice.pid,initials:'Bob'},bob.cookie);
    assert.equal(await bridge.redis.hget(key('player:'+alice.pid),'initials'),null,'body pid is never authority');
    assert.equal(await bridge.redis.hget(key('player:'+bob.pid),'initials'),'Bob');
    const makeRun = async (mode='normal') => {
      const response = await call('run',{mode},alice.cookie); assert.equal(response.status,200);
      return response.json();
    };
    const run = await makeRun();
    const events = Array.from({length:2000},(_,i)=>[1000+i*1000,'worm']);
    await bridge.redis.hset(key('run:'+run.runId),'startedAt',Date.now()-2_002_000);
    const payload = {runId:run.runId,events,durationMs:2_001_000,initials:'Alice',score:999999999};
    assert.equal((await call('score',payload,bob.cookie)).status,410,'foreign run');
    const responses = await Promise.all([call('score',payload,alice.cookie),call('score',payload,alice.cookie)]);
    for (const r of responses) assert.equal(r.status,200);
    const [first,duplicate] = await Promise.all(responses.map(r=>r.json()));
    assert.deepEqual(first,duplicate,'idempotent concurrent retries');
    assert.ok(first.score > 200000 && first.score < 999999999,'server derives high score');
    assert.equal(await bridge.redis.ttl(key('board:normal')),-1,'all-time has no TTL');
    assert.ok(await bridge.redis.ttl(key('run:'+run.runId)) > 0);
    assert.equal((await call('score',{...payload,events:[]},alice.cookie)).status,409);
    const casual = await makeRun('casual');
    assert.equal((await call('score',{runId:casual.runId,events:[],durationMs:0,initials:'Alice'},alice.cookie)).status,200);
    assert.equal(Number(await bridge.redis.zscore(key('board:normal'),alice.pid)),first.score);
    assert.equal(Number(await bridge.redis.zscore(key('board:casual'),alice.pid)),0);
    const board = await routes.leaderboard.GET(request('leaderboard',{},alice.cookie,'GET'));
    assert.equal((await board.json()).me.score,first.score);
    const expired = await makeRun();
    await bridge.redis.pexpire(key('run:'+expired.runId),1);
    await new Promise(r=>setTimeout(r,10));
    assert.equal((await call('score',{...payload,runId:expired.runId},alice.cookie)).status,410);
    await rateLimit('ttl-check',1,1);
    await assert.rejects(rateLimit('ttl-check',1,1),e=>e.status===429);
    await new Promise(r=>setTimeout(r,1100));
    await rateLimit('ttl-check',1,1);
    assert.equal((await call('reset',{},alice.cookie)).status,200);
    assert.equal(await bridge.redis.zscore(key('board:normal'),alice.pid),null);
    assert.equal(await bridge.redis.zscore(key('board:casual'),alice.pid),null);
    assert.equal((await call('score',payload,alice.cookie)).status,401,'reset revokes all old run submissions');
    assert.equal((await call('reset',{},alice.cookie)).status,200,'reset retry is idempotent');
    console.log('ok — real Redis auth, atomic scores, retries, difficulty, TTL, rate limits, reset');
  } finally {
    // Only remove this test's explicitly scoped namespace; never flush a DB.
    const keys = await bridge.redis.keys(key('*'));
    if(keys.length) await bridge.redis.del(...keys);
    await bridge.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
