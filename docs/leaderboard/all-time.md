# All-time leaderboard

The active leaderboard uses the permanent Redis sorted set `lb:all-time`, with no expiration. Both score submissions and leaderboard reads use this same key. `ZADD GT` retains each player's highest score; ranks, player count, and neighbors are all-time.

On the first leaderboard read or score submission after deployment, `ensureAllTimeBoard` scans existing `player:*` hashes and backfills their saved `best` values, including players who have not returned. Old daily sorted sets are not needed to recover these records. The marker `lb:all-time:backfilled:v1` is written only after all batches succeed. Retries and simultaneous backfills cannot reduce an existing score.

Daily play streaks and referral counters still use UTC dates. Player identity continues to use the anonymous browser player ID.

Validation: `node lib/leaderboard-routes.test.cjs` exercises migration retries, historical and zero-score players, lower/higher submissions, date rollover, ranks, neighbors, and streaks against an in-memory Redis substitute. `npx.cmd tsc --noEmit` checks types.

The original `leaderboard_plan.md` and `leaderboard-diagram.md` describe the previous daily implementation.
