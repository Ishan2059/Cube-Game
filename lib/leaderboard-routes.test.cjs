// Run with: node lib/leaderboard-routes.test.cjs
// Exercise the real routes and migration against an in-memory Redis substitute.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
};

const values = new Map();
const players = new Map([
  ['player:old-user', { initials: 'old', best: 900, lastPlayed: '2026-01-01', streak: 2 }],
  ['player:zero-user', { initials: 'zero', best: 0 }],
  ['player:name-only', { initials: 'name' }],
]);
const boards = new Map();
let scans = 0;
let failWrite = false;
const redis = {
  async get(key) { return values.get(key) ?? null; },
  async set(key, value) { values.set(key, value); return 'OK'; },
  async scan(cursor) {
    scans++;
    const keys = [...players.keys()];
    return cursor === '0' ? ['1', keys.slice(0, 1)] : ['0', keys.slice(1)];
  },
  async hget(key, field) { return players.get(key)?.[field] ?? null; },
  async hgetall(key) { return players.get(key) ?? null; },
  async hset(key, fields) { players.set(key, { ...players.get(key), ...fields }); },
  async zadd(key, options, { score, member }) {
    if (failWrite) { failWrite = false; throw new Error('temporary failure'); }
    assert.equal(options.gt, true);
    if (!boards.has(key)) boards.set(key, new Map());
    const board = boards.get(key);
    board.set(member, Math.max(board.get(member) ?? -Infinity, score));
  },
  async zscore(key, member) { return boards.get(key)?.get(member) ?? null; },
  async zcard(key) { return boards.get(key)?.size ?? 0; },
  async zrevrank(key, member) {
    const index = sorted(key).findIndex(([pid]) => pid === member);
    return index < 0 ? null : index;
  },
  async zrange(key, start, end) { return sorted(key).slice(start, end + 1).flat(); },
  pipeline() {
    const queue = [];
    return {
      hget(...args) { queue.push(() => redis.hget(...args)); },
      zadd(...args) { queue.push(() => redis.zadd(...args)); },
      async exec() { return Promise.all(queue.map((run) => run())); },
    };
  },
};
function sorted(key) { return [...(boards.get(key) ?? [])].sort((a, b) => b[1] - a[1]); }
const originalLoad = Module._load;
Module._load = function (id, parent, isMain) {
  if (id === '@/lib/redis') return { redis };
  if (id.startsWith('@/')) id = path.join(__dirname, '..', id.slice(2)) + '.ts';
  return originalLoad.call(this, id, parent, isMain);
};

const { GET } = require('../app/api/leaderboard/route.ts');
const { POST } = require('../app/api/score/route.ts');
const { ALL_TIME_BOARD_KEY } = require('./leaderboard-store.ts');
const RealDate = Date;
let today = '2026-09-16';
global.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [today + 'T12:00:00Z'])); }
};
const read = async (pid) => (await GET(new Request(`http://localhost/api/leaderboard?pid=${pid}`))).json();
const submit = async (pid, score) => (await POST(new Request('http://localhost/api/score', {
  method: 'POST', body: JSON.stringify({ pid, score, initials: 'player' }),
}))).json();

(async () => {
  failWrite = true;
  await assert.rejects(read('old-user'), /temporary failure/);
  assert.equal(values.size, 0, 'failed migration is not marked complete');
  const initial = await read('old-user');
  assert.equal(initial.total, 2, 'backfills absent players and zero scores, skips name-only hashes');
  assert.equal(initial.top10[0].score, 900);
  assert.equal(initial.myRank, 1);
  const scansAfterMigration = scans;

  assert.equal((await submit('new-user', 1000)).rank, 1);
  today = '2026-09-17';
  const lower = await submit('new-user', 100);
  assert.equal(lower.best, 1000, 'lower score next day retains personal best');
  assert.equal(lower.rank, 1);
  assert.equal(lower.streak, 2, 'daily streak still advances');
  const returning = await submit('old-user', 10);
  assert.equal(returning.best, 900, 'historical best survives lower returning run');
  assert.equal(returning.rank, 2);
  assert.equal((await submit('old-user', 1200)).rank, 1, 'higher score improves rank');
  today = '2027-01-01';
  const board = await read('new-user');
  assert.deepEqual(board.top10.map((r) => r.score), [1200, 1000, 0]);
  assert.equal(board.myRank, 2);
  assert.equal(board.neighbors.length, 3);
  assert.equal(board.total, 3);
  assert.equal(scans, scansAfterMigration, 'successful backfill runs once');
  assert.deepEqual([...boards.keys()], [ALL_TIME_BOARD_KEY], 'all dates share one permanent board');

  const { playerNameError, displayPlayerName } = require('./player-name.ts');
  for (const name of ['LadOPuteee', 'l_a_d_o', 'f.u.c.k', 'fuuuck', 'b1tch', 'chikne', 'm4d4rch0d', 'पुती']) {
    assert.ok(playerNameError(name), 'reject offensive input: ' + name);
    assert.equal(displayPlayerName(name), 'Player');
  }
  for (const name of ['Ishan', 'NikeshDahal', 'Harshit', 'Ishita', 'Scunthorpe', 'Doge', 'HeroDai']) assert.equal(playerNameError(name), null);
  const { POST: rename } = require('../app/api/rename/route.ts');
  const offensiveRequest = () => new Request('http://localhost/api/score', {method:'POST',body:JSON.stringify({pid:'old-user',score:5000,initials:'LadOPuteee'})});
  assert.equal((await POST(offensiveRequest())).status, 400);
  assert.equal((await rename(offensiveRequest())).status, 400);
  assert.equal(players.get('player:old-user').initials, 'player', 'rejection does not overwrite stored name');
  players.get('player:old-user').initials = 'LadOPuteee';
  for (let i=0;i<15;i++) await redis.zadd(ALL_TIME_BOARD_KEY, {gt:true}, {score:2000+i,member:'extra-user-'+i});
  const ranked = await read('old-user');
  assert.equal(ranked.top10.length,10,'only top ten are returned');
  assert.equal(ranked.me.rank,16,'personal position is returned even outside top ten');
  assert.equal(ranked.me.score,1200);
  assert.equal(ranked.me.initials,'Player','legacy names are masked without deleting scores');
  const unranked = await read('unknown-user');
  assert.equal(unranked.me,null);
  assert.equal(unranked.myRank,null);
  console.log('ok — name validation, legacy moderation, top ten and personal rank');

  require('./leaderboard-core.test.ts');
  console.log('ok — all-time leaderboard route and migration checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
