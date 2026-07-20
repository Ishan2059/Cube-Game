# Leaderboard — Feature Diagrams

Daily-reset leaderboard + streak + neighbors. Anonymous (localStorage id), Redis-backed.

## 1. Data flow (client ↔ API ↔ Redis)

```mermaid
flowchart TD
  subgraph Client["Browser (game/leaderboard.ts)"]
    LS[("localStorage<br/>crush-pid<br/>crush-initials")]
    GO["gameOver()"]
    HOME["Start screen load"]
    BOARD["renderBoard()<br/>right-side panel"]
  end

  subgraph API["Next.js route handlers"]
    SCORE["POST /api/score"]
    LB["GET /api/leaderboard"]
    ME["GET /api/me"]
  end

  subgraph Redis["Redis (local SRH / Upstash prod)"]
    DAILY[("lb:YYYY-MM-DD<br/>sorted set · TTL 48h")]
    PLAYER[("player:uuid<br/>hash: initials,streak,lastPlayed,best")]
    RL[("rl:uuid<br/>rate-limit · TTL 2s")]
  end

  GO -->|"pid, initials, score"| SCORE
  GO --> LB
  HOME --> ME
  LS -.pid/initials.-> GO
  LS -.pid.-> HOME

  SCORE -->|"ZADD GT"| DAILY
  SCORE -->|"read+write streak/best"| PLAYER
  SCORE -->|"SET NX EX 2"| RL
  LB -->|"ZREVRANGE / ZREVRANK / ZCARD"| DAILY
  LB -->|"HGET initials"| PLAYER
  ME -->|"HGETALL"| PLAYER

  LB -->|"top50 + myRank + neighbors"| BOARD
  ME -->|"streak, atRisk"| HOME
```

## 2. Submit path — validation, board, streak

```mermaid
flowchart TD
  A["POST /api/score"] --> B{"pid valid?"}
  B -- no --> E400["400 bad pid"]
  B -- yes --> C{"score integer<br/>0..MAX_SCORE?"}
  C -- no --> E400b["400 bad score"]
  C -- yes --> D{"rate limit<br/>SET rl:pid NX EX 2"}
  D -- exists --> E429["429 slow down"]
  D -- fresh --> F["ZADD GT lb:today"]
  F --> G["read player:pid hash"]
  G --> H["computeStreak(lastPlayed, prev, today)"]
  H --> I["HSET player:pid<br/>initials, streak, lastPlayed, best=max"]
  I --> J["ZREVRANK + ZCARD"]
  J --> K["return rank, total, streak, best"]
```

## 3. Streak logic (retention core)

```mermaid
flowchart LR
  S["player submits today"] --> Q{"lastPlayed?"}
  Q -- "== today" --> U["streak unchanged<br/>(replay, min 1)"]
  Q -- "== yesterday" --> P["streak + 1 🔥"]
  Q -- "gap / first play" --> R["streak = 1"]

  Y["played yesterday,<br/>not yet today"] --> AR["atRisk = true"]
  AR --> N["home nudge:<br/>'play today to keep 🔥N'"]
```

## 4. Local vs deploy (same client code)

```mermaid
flowchart LR
  APP["@upstash/redis client"]
  APP -->|"local .env.local<br/>localhost:8079"| SRH["SRH proxy (docker)"]
  SRH --> LRED[("local redis:7")]
  APP -->|"Vercel env vars"| UP[("Upstash Redis")]
```
