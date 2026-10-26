require('./register.cjs');
const assert = require('node:assert/strict');
const { scoreRun } = require('../lib/run-validation.ts');
const { validateScore } = require('../lib/leaderboard-core.ts');
const { playerNameError, displayPlayerName } = require('../lib/player-name.ts');
require('../lib/leaderboard-core.test.ts');

assert.equal(validateScore(200000), 200000);
for (const value of [null, '', '123', true, [], {}, NaN, Infinity, 1.5, -1]) assert.equal(validateScore(value), null);
assert.equal(scoreRun([[1000, 'worm'], [2000, 'bug']], 3000, 4000, 'normal'), 60);
assert.equal(scoreRun([[1000, 'worm'], [1500, 'break'], [2000, 'bug']], 3000, 4000, 'normal'), 35);
assert.equal(scoreRun([[1000, 'worm'], [4000, 'bug']], 5000, 6000, 'normal'), 35);
assert.equal(scoreRun([[1000, 'beetle']], 2000, 3000, 'normal'), null, 'unavailable parasite');
assert.equal(scoreRun([[2000, 'worm'], [1000, 'worm']], 3000, 4000, 'normal'), null, 'time reversal');
assert.equal(scoreRun([[1000, 'worm']], 100000, 3000, 'normal'), null, 'future run');
assert.equal(scoreRun([[0, 'worm'], [0, 'worm']], 0, 0, 'normal'), null, 'impossible spawn count');
assert.equal(scoreRun([[0, '__proto__']], 0, 0, 'normal'), null);
const longRun = Array.from({length: 2000}, (_, i) => [1000 + i * 1000, 'worm']);
assert.ok(scoreRun(longRun, 2_001_000, 2_002_000, 'normal') > 200000, 'late-game scores accepted');
for (const name of ['LadOPuteee', 'f.u.c.k', 'b1tch', 'chikne', 'पुती']) {
  assert.ok(playerNameError(name));
  assert.equal(displayPlayerName(name), 'Player');
}
for (const name of ['Ishan', 'NikeshDahal', 'Harshit', 'Ishita', 'Scunthorpe']) assert.equal(playerNameError(name), null);
console.log('ok — shared scoring, run bounds, high scores, names');
