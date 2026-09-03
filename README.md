# 🪢 Rope War — Online Multiplayer Tug of War

A web-based, multi-mode (1v1 / 3v3 / 5v5), click-rate-based online multiplayer tug-of-war game. Two teams race to pull the rope past the opponent's win line by clicking faster than they do, with a full Elo-based MMR ranking system.

## Features

- 🎮 **Three modes**: 1v1, 3v3, 5v5
- ⏱️ **Rate-based clicking**: Every second, the team that clicks faster pulls the rope toward their side
- 🤖 **Bot AI**: Quick offline test mode (three difficulties: easy / normal / hard)
- 🏆 **Ranked play**: Bronze → Silver → Gold → Platinum → Diamond with Elo-style MMR
- 📊 **Leaderboards**: Overall + per-mode top 100
- 👤 **Profile**: Stats, MMR, match history
- 🔐 **Auth**: Email / password with bcrypt and session cookies
- ⚡ **Realtime**: Server-authoritative click processing via Socket.io
- 🛡️ **Anti-cheat**: Per-player click-per-second cap
- 🔌 **Reconnect-safe**: Pending matches survive page refresh

## Tech Stack

- **Backend**: Node.js 24 + Express + Socket.io
- **Database**: `node:sqlite` (Node 24 built-in, no native compilation)
- **Sessions**: SQLite-backed (custom store)
- **Frontend**: Vanilla ES modules, hash-based SPA router, plain CSS
- **Auth**: bcryptjs + zod validation + express-session
- **Security**: Helmet, express-rate-limit on auth routes

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. (Optional) copy the env template
cp .env.example .env

# 3. Start the server
npm start
# or, for hot-reload during development:
npm run dev
```

The server runs on **http://localhost:3000**.

Optional: seed a few test users with `npm run seed` (password: `password123`).

## Local Test Flow

1. Open **http://localhost:3000** → **Register** (email + username + password)
2. **Menu** → **Play** → pick a mode (e.g. 1v1) → **Play vs Bot Now**
3. Watch the 3-2-1 countdown, then mash the **CLICK!** button
4. The rope shifts toward whichever side clicks faster
5. When `|rope| === 50` the match ends → results screen + MMR delta
6. Check your new rank on the **Profile** page
7. Climb the **Leaderboard** by winning more matches

## Project Structure

```
ropewar/
├── server.js                  # Express + Socket.io entry point
├── config/                    # gameConfig (all balance values), DB connection
├── db/                        # schema.sql, migrate, seed (DB is gitignored)
├── models/                    # userModel, matchModel, leaderboardModel
├── services/                  # auth, game, matchmaking, bot, mmr, ranking
├── sockets/                   # gameHandlers (Socket.io event bindings)
├── routes/                    # auth, profile, leaderboard, match
├── middleware/                # requireAuth, errorHandler
├── utils/                     # logger, time, sqliteSessionStore
├── public/                    # Frontend (index.html, css/, js/)
│   ├── index.html
│   ├── css/                   # main, auth, game, leaderboard
│   └── js/
│       ├── app.js             # entry: route registration + auth guard
│       ├── router.js          # hash-based SPA router
│       ├── api.js             # fetch wrappers
│       ├── socket.js          # socket.io singleton
│       ├── shared/toast.js
│       └── views/             # login, register, menu, modeSelect,
│                              # matchmaking, game, results,
│                              # profile, leaderboard
└── test/realSocketTest.js     # Smoke test for socket.io + auth
```

## Game Mechanics

- **Rope range**: `[-50, +50]`, 0 = center
- **Tick rate**: 1000 ms
- **Delta formula**: `(clicksA − clicksB) × CLICK_UNIT` (defaults to 3.0)
- **Win condition**: `|ropePos| >= 50`
- **Max match length**: 60 seconds (1 minute)
- **Click cap**: 30 clicks per second per player (anti-cheat)
- **Bots**: Gaussian-sampled CPS with misfire rate (three difficulty profiles)

## MMR (Elo)

- K-factor **32** below 1800 MMR, **16** at or above (more stable ratings for veterans)
- In team play, each player gets a delta based on the team average vs. the opponent team average
- Draws award 0.5 to both sides
- Floor at 0 — MMR never drops below 0

| Tier    | MMR range  | Color    |
| ------- | ---------- | -------- |
| Bronze  | 0 – 1199   | #CD7F32  |
| Silver  | 1200 – 1399 | #C0C0C0 |
| Gold    | 1400 – 1599 | #FFD700 |
| Platinum| 1600 – 1799 | #00CED1 |
| Diamond | 1800+      | #B9F2FF  |

## HTTP API

| Method | Path                                | Description                          |
| ------ | ----------------------------------- | ------------------------------------ |
| POST   | `/api/auth/register`                | Create an account                    |
| POST   | `/api/auth/login`                   | Sign in                              |
| POST   | `/api/auth/logout`                  | Sign out                             |
| GET    | `/api/auth/me`                      | Current user                         |
| GET    | `/api/profile`                      | Profile + stats                      |
| GET    | `/api/profile/matches?limit=20`     | Match history                        |
| GET    | `/api/leaderboard?mode=overall\|1v1\|3v3\|5v5` | Top 100 (default 100, max 500) |
| POST   | `/api/match/bot`                    | Create a bot match (body: `{mode}`)  |
| GET    | `/api/match/:matchId`               | Fetch a finished match (for results) |
| GET    | `/api/health`                       | Health check                         |

## Socket Events

**Client → Server**
- `client:join_queue` `{mode}` — Join the matchmaking queue
- `client:leave_queue` — Leave the queue
- `client:click` `{matchId}` — Register a click
- `client:resume_match` — Request a snapshot of an in-progress match after a page refresh
- `client:leave_match` `{matchId}` — Logged but currently a no-op

**Server → Client**
- `server:queue_joined` `{mode, position, totalNeeded}`
- `server:match_found` `{matchId, mode, teamA, teamB, youAreTeam}`
- `server:countdown` `{secondsRemaining}`
- `server:match_start` `{matchId, ropePos, mode, teamA, teamB, durationSec}`
- `server:tick` `{second, ropePos, clicksA, clicksB, delta, timeLeft}`
- `server:match_end` `{matchId, mode, winnerTeam, finalRopePos, durationSec, results, teamA, teamB}`
- `server:match_state` `{active, matchId?, …}` (reply to `resume_match`)
- `server:error` `{message}`

## Configuration

Copy `.env.example` to `.env` and adjust:

```
PORT=3000
NODE_ENV=development
SESSION_SECRET=replace-me-with-a-long-random-string
DB_PATH=./db/halat.db
```

In production, `SESSION_SECRET` **must** be a long, unguessable random string (e.g. `openssl rand -hex 32`).

All gameplay balance constants live in `config/gameConfig.js`.

## Security Notes

- `.env`, the SQLite database files (`db/*.db*`), and `node_modules/` are gitignored.
- Auth endpoints are rate-limited (30 requests per 15 minutes per IP).
- Passwords are hashed with bcrypt (10 rounds).
- Helmet is enabled (with relaxed CSP for local dev; tighten for production).
- The match tick logic is server-authoritative: the client only sends click events, never the rope position.
- A per-player click-per-second cap prevents trivial auto-clickers.

## License

MIT
