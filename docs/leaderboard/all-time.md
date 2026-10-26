# All-time leaderboard

Current production-readiness changes supersede the implementation notes below: authenticated normal/casual boards use permanent environment-scoped `crush:v2:*:board:<mode>` keys. The old `lb:all-time` board is retained as a read-only historical archive, because its ownership and difficulty cannot be proven. See [README](../../README.md) for sessions, run validation, retries, limits, migration and deployment instructions.

The active leaderboard uses the permanent Redis sorted set `lb:all-time`, with no expiration. Both score submissions and leaderboard reads use this same key. `ZADD GT` retains each player's highest score; ranks, player count, and neighbors are all-time.

On the first leaderboard read or score submission after deployment, `ensureAllTimeBoard` scans existing `player:*` hashes and backfills their saved `best` values, including players who have not returned. Old daily sorted sets are not needed to recover these records. The marker `lb:all-time:backfilled:v1` is written only after all batches succeed. Retries and simultaneous backfills cannot reduce an existing score.

Daily play streaks and referral counters still use UTC dates. Player identity continues to use the anonymous browser player ID.

Validation now uses `npm test`, `npm run test:integration` (real Redis), `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:browser`.

The original `leaderboard_plan.md` and `leaderboard-diagram.md` describe the previous daily implementation.
