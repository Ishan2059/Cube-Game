# CRUSH

A browser arcade game built with Next.js, React, TypeScript and Three.js. Roll the cube, crush parasites, earn cosmetic coins, and compete on all-time boards.

## Development

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, and set the REST URL/token of a **development** Upstash Redis database (or a local Redis REST proxy). Then run `npm run dev`.

Without Redis, the game is playable locally. Online ranking, profile updates, and reset require a working backend. Never put Redis credentials in `NEXT_PUBLIC_*` variables or commit `.env.local`.

## Checks

- `npm run lint` — ESLint, including Next.js and TypeScript rules.
- `npm run typecheck` — TypeScript.
- `npm test` — scoring, validation, moderation and durable-save regression tests.
- `TEST_REDIS_URL=redis://127.0.0.1:6379 npm run test:integration` — real Redis tests. Use a dedicated test database. Tests only delete their random namespace, never flush the database. On PowerShell, set `$env:TEST_REDIS_URL='redis://127.0.0.1:6379'` first.
- `npm run build` — production build; does not require production credentials.
- `npx playwright install chromium` then `npm run test:browser` — desktop/mobile browser smoke tests using mocked network responses. Redis integration tests cover real backend behavior separately.

GitHub Actions runs all of these on pull requests to `develop` and `main`, with a disposable Redis 7 service. No production secrets are available to CI.

## Branch and release workflow

Create a feature branch from current `develop`, open a PR into `develop`, and wait for `checks` to pass. Merge and test the preview. Release through a `develop` → `main` PR. Main requires a PR, an up-to-date branch, resolved conversations, and the successful `checks` job; direct and force pushes are blocked, including for admins. Solo-maintainer PRs do not require an additional person's approval.

Vercel's production branch should be `main`; verify that setting in the Vercel project. Scope production Redis credentials to Production and use a **separate Redis database** for Preview. Keys also include the deployment environment and optional `REDIS_NAMESPACE`, so preview writes cannot touch production scores even if credentials are accidentally shared. Historical unnamespaced data is accessible only in production. Preview namespaces currently persist per environment; use a distinct `REDIS_NAMESPACE` for isolated staging scenarios.

Rollback by reverting the release through a PR. Do not redeploy the old unauthenticated API against the live database: it reopens the identity and score vulnerabilities. Historical Redis data is preserved, so rollback does not require destructive data migration.

## Rankings and identity

New anonymous identities are issued by `/api/session` and owned by a random, HttpOnly, SameSite=Strict cookie (Secure in production). Only its SHA-256 hash is stored in Redis. Public player IDs are never authentication credentials. Clearing cookies loses access to the anonymous account; there is no account recovery.

Normal and casual each have a permanent sorted set, with one highest score per player. New runs receive a server-issued ID with fixed difficulty, owner, start time, and seven-day expiry. `/api/score` derives points from kill/combo events, validates event order, type availability, spawn ceilings, and elapsed time, then atomically updates the board and profile. Duplicate submissions return the same receipt; changed replays are rejected. Limits apply to both the session's player and a trusted platform IP bucket. Vercel's overwritten `x-vercel-forwarded-for` header is used only on Vercel; other hosts share a conservative bucket until a trusted proxy adapter is added.

**Security boundary:** event logs are client-reported. These checks stop arbitrary numeric submissions, cross-player writes, invalid replays and implausible scores; they do not prove every movement or collision. Determined modified clients can fabricate plausible event logs. Full anti-cheat requires deterministic server replay or a server-authoritative simulation. Do not treat these rankings as suitable for prizes or payments.

Historical `lb:all-time` and `player:*` records remain in the read-only **Historical — mixed modes** board. Existing IDs were public and had no ownership secret, so it is unsafe to let anyone claim them. Historical scores cannot be truthfully assigned to normal or casual mode. New boards therefore start separately; neither new board resets daily. The one-time historical backfill runs only when viewing the historical board, not on score submission.

Finished online runs are queued in browser storage before sending. Transient failures retry on reconnect, page load, and every minute. Names are saved locally only after server confirmation. Runs started offline are local-only; a run cannot be issued retroactively. Pending runs expire after seven days; a six-hour gameplay limit and 60,000-event cap bound server work.

Reset clears the authenticated player's current normal/casual rankings, revokes its session and outstanding run authority, then clears browser progress and reloads the game. Offline reset fails without clearing local state. Old public historical entries cannot be deleted using an unproven browser ID.

## Code map

- `game/engine.ts`: game simulation, rendering and inputs.
- `lib/game-rules.ts`, `lib/exploration-rules.ts`: shared scoring and elapsed-time swarm progression. `game/levels.ts` remains only for validating historical pending runs.
- `game/run-client.ts`: online runs, durable score queue and reset.
- `game/leaderboard.ts`: ranking UI and profile client.
- `game/storage.ts`: local coins, cosmetics and settings.
- `lib/server-api.ts`: sessions, request limits, namespacing and API errors.
- `lib/score-scripts.ts`: atomic Redis score/reset transactions.
- `app/api/`: sessions, runs, scores, ranks, rename, reset and referrals.
- `app/c/[pid]/`: public challenge page and social image.
- `legacy/`: archived standalone prototype, not used by the current app.

The older plans under `docs/` describe previous implementations; this README and `docs/leaderboard/all-time.md` describe the current behavior.

## Exploration and visuals

See [the exploration notes](docs/exploration-checklist.md) for controls, world rules, rendering budgets, audio sources and validation. Space (or the on-screen jump button) jumps with your current momentum. Giant mode breaks obstacle props. Bushes hide the cube completely.

All skins and trails are temporarily available through `PREVIEW_UNLOCK_ALL` in `game/cosmetic-access.ts`; this does not overwrite purchases or spend coins. This is a client-side preview setting, not an entitlement/security mechanism.
