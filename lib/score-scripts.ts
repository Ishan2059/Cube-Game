// Atomic commit: reset, overlapping submissions, and retrying a lost response
// cannot lower a best, resurrect a reset profile, or count a run twice.
export const COMMIT_RUN = `
if redis.call('GET', KEYS[4]) ~= ARGV[1] or redis.call('HGET', KEYS[1], 'pid') ~= ARGV[1]
  or tonumber(redis.call('HGET', KEYS[2], 'version') or '0') ~= tonumber(ARGV[2]) then return 'expired' end
local previous = redis.call('HGET', KEYS[1], 'receipt')
if previous then
  if redis.call('HGET', KEYS[1], 'fingerprint') ~= ARGV[7] then return 'conflict' end
  return previous
end
redis.call('ZADD', KEYS[3], 'GT', ARGV[3], ARGV[1])
local best = tonumber(redis.call('ZSCORE', KEYS[3], ARGV[1]))
local last = redis.call('HGET', KEYS[2], 'lastPlayed')
local streak = tonumber(redis.call('HGET', KEYS[2], 'streak') or '0')
if last == ARGV[5] then streak = math.max(1, streak)
elseif last == ARGV[6] then streak = streak + 1
else streak = 1 end
redis.call('HSET', KEYS[2], 'initials', ARGV[4], 'streak', streak, 'lastPlayed', ARGV[5], 'best:' .. ARGV[8], best)
if ARGV[8] == 'normal' then redis.call('HSET', KEYS[2], 'best', best) end
local receipt = cjson.encode({rank=redis.call('ZREVRANK', KEYS[3], ARGV[1])+1, total=redis.call('ZCARD', KEYS[3]), best=best, streak=streak, score=tonumber(ARGV[3])})
redis.call('HSET', KEYS[1], 'receipt', receipt, 'fingerprint', ARGV[7])
return receipt`;

export const RESET_PLAYER = `
if redis.call('GET', KEYS[4]) ~= ARGV[1] then return 0 end
local version = tonumber(redis.call('HGET', KEYS[1], 'version') or '0') + 1
redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[1], 'version', version)
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('ZREM', KEYS[3], ARGV[1])
redis.call('DEL', KEYS[4])
return 1`;
