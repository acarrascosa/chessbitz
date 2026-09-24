# Chessbitz

**A daily chess-opening challenge.** Every day there is a new opening to *play* on the board: find each move of the line, use hints if you get stuck, keep your streak alive and share a spoiler-free result — then study the line move by move and solve three real tactics from that opening.

[chessbitz.com](https://chessbitz.com) · [English](https://chessbitz.com/en/) · [Español](https://chessbitz.com/)

![Playing the Modern Benoni](docs/demo.webp)

## Features

- **Playable daily challenge** — you play the side that defines the opening (black in the Sicilian, white in the Ruy Lopez); the opponent replies on its own. Drag-and-drop or tap-to-move, legal-move hints on the board, difficulty and move count shown up front.
- **Wordle-style scoring** — 5 mistakes per line and three hint levels (which piece → from where → the arrow); asking for help on a move costs half a mistake and the arrow the other half, so hints never end a line but a line given away isn't a clean one. Every move ends up 🟩 first try, 🟨 with help or 🟥 revealed, and the grid can be shared without spoilers.
- **Your game vs. everyone's** — the result card compares your mistakes, hints and playing time with today's averages and highlights your column in the global distribution. Lifetime stats (streaks, mistakes per challenge, a 28-day calendar) live in their own panel.
- **366 curated openings** — one per day for a full year, each with bilingual names, a description, the strategic ideas behind it and an explanation for *every* move.
- **Tactic of the opening** — three puzzles per opening from the [Lichess open database](https://database.lichess.org/#puzzles) (CC0), matched to each line *by position*, unlocked after the challenge.
- **Tactics battle (multiplayer)** — 2 to 4 players share a table through an invite link and race through the same Lichess puzzles. The host picks a short (~2 min), normal (≤4 min) or long (~10 min) match; each board gets a clock derived from its rating and length and 5 mistakes, and scores 100 + up to 50 for speed − 15 per mistake − 5 per hint. Live standings, reconnection after a reload, podium and rematch.
- **Discord Activity** — the battle also runs inside Discord: everyone in the Activity sits at the same table, names come from Discord, profiles show the board, place and points live (Rich Presence), the bot posts the podium in the channel and pings the players the next day with a button that relaunches the Activity.
- **Archive and expert mode** — replay any past day (search, filters, random pick) in normal mode or in a Chessle-inspired expert mode: play the whole line blind, submit, get a colour per move, six attempts. Off-book replies come from a tiny built-in alpha-beta engine.
- **No accounts** — progress lives in the browser and moves between devices with an export file or code. Installable PWA that keeps today's (and tomorrow's) opening available offline.
- **Anonymous global stats** served from the edge, **rich link previews** with today's opening, Spanish and English, light/dark/system themes, a high-contrast colour-blind palette and a decorative 3D brass king on large screens.

| | | |
| --- | --- | --- |
| ![Challenge with hints, light theme](docs/challenge-light.webp) | ![Result card, dark theme](docs/result-dark.webp) | ![Mobile](docs/mobile-light.webp) |
| ![Expert mode](docs/expert-light.webp) | ![Archive](docs/archive-dark.webp) | ![Tactic](docs/tactic-light.webp) |

## Architecture

```mermaid
flowchart LR
    subgraph Build ["npm run build"]
        A[Opening catalog<br/>src/data/openings/*.json] --> B[Astro static build]
        P[Lichess puzzles<br/>src/data/puzzles.json] --> B
        A --> C[Open Graph renderer<br/>Satori + resvg]
        B --> D[(dist/)]
        C --> D
    end
    subgraph Edge ["Cloudflare"]
        W[Worker] -- "/api/results<br/>/api/stats/:day" --> DB[(D1)]
        W -- "/api/battle/:code<br/>WebSocket" --> R[Durable Object<br/>one per table]
        Discord[Discord iframe<br/>client_id.discordsays.com] -- "proxy" --> W
        R -- "podium" --> DAPI[Discord API]
        Cron[Daily cron] -- "reminders" --> DAPI
        W -- "everything else" --> S[Static assets]
        W -- "/ and /en/<br/>HTMLRewriter: today's og:image" --> S
    end
    D --> S
    Browser -- "HTML, JS, today's opening JSON" --> W
```

- **Static first.** Astro renders the pages; the game is a React island. The client downloads only *today's* opening (`/data/daily/{n}.json`, ~2 KB) — the request starts in `<head>`, before hydration.
- **Pure game logic.** Everything that matters is framework-free and unit-tested: the challenge is a reducer (`src/lib/challenge.ts`), expert mode grades attempts (`expert.ts`) with a small alpha-beta engine for off-book replies (`engine.ts`), plus puzzles, the daily rotation, stats, progress import/export and share text.
- **Edge API.** A Cloudflare Worker serves the assets and a tiny API backed by D1. It stores only aggregated counters per `(day, mistakes)` — plays plus the sums of hints and seconds, for the averages — no cookies, no identifiers; the IP is used transiently for rate limiting and never stored.
- **Battles on Durable Objects.** Each table code maps to one Durable Object that holds the room and the players' hibernatable WebSockets. The whole room is a pure state machine (`src/lib/battle.ts`: seats, ready/start, moves, clocks, scoring) that the Durable Object only wires to sockets, storage and an alarm; the alarm times out boards whose clock ran out even if nobody sends anything, and forgets abandoned tables after an hour. Clients play each move locally for instant feedback and the server replays it through the same challenge reducer, so both agree without a round trip. Clocks follow the server's time, so every player sees the same countdown.
- **Discord without a second app.** Discord proxies the Activity to chessbitz.com, so the same Worker serves it: the root with Discord's `frame_id`/`instance_id` returns the battle-only page, `/api/discord/token` swaps the Embedded App SDK's OAuth2 code and hands out an HMAC-signed session, and the table socket is only opened after asking Discord's activity-instances API that the player really is in that instance (which also says which channel to post in). Interactions are verified with Ed25519; the daily reminder is a Cron Trigger over a small D1 table.
- **Battle puzzles.** Battles draw from their own pool: 6,000 Lichess puzzles, 2,000 per difficulty tier spread evenly over 100-point rating bands (800–2199), picked by `scripts/battle-puzzles.mjs` with the same quality filters and a seeded reservoir sample. Only the Worker loads it, and a table never repeats a puzzle across rematches while fresh ones are left.
- **A time budget per match.** `timeLimit()` turns a puzzle's rating and number of moves into seconds (a 1000-rated mate in one gets 25 s, a 1900-rated three-mover 75 s). `pickBoards()` then fills each format's budget with random puzzles of the right difficulty, so the sum of the clocks can never exceed it: a short match is ~3 easy boards in ≤2 min, a normal one ~5 mixed boards in ≤4 min, a long one up to 10 hard boards in ≤10 min.
- **Puzzles matched by position.** `scripts/puzzles.mjs` streams the 6-million-row Lichess puzzle CSV, maps every line of the catalog to Lichess's opening tags by replaying it against the Lichess opening list (names differ, positions don't) and keeps the three most popular puzzles per opening.
- **Link previews without SSR.** Crawlers don't run JavaScript, so the Worker rewrites the home page's Open Graph tags on the fly to point at a pre-rendered image of today's opening.

![Open Graph image](docs/og-example.png)

## Tech stack

Astro 5 · React 19 · TypeScript · Tailwind CSS 4 · chess.js · react-chessboard · Three.js (React Three Fiber) · Cloudflare Workers + D1 + Durable Objects + Cron Triggers · Discord Embedded App SDK · Satori + resvg · Vitest · Playwright

## Quality

| | |
| --- | --- |
| Unit tests | 474 Vitest tests — challenge and expert engines, the reply engine, puzzles (every stored solution is legal), battle rooms (budgets, scoring, clocks, reconnection, leaving), Discord messages, reminders, signed sessions and interaction signatures, dates across time zones and DST, stats, progress import/export, API validation and every opening in the catalog |
| End-to-end | Playwright on desktop Chrome (drag and drop) and a mobile device (tap to move): daily challenge, hints and stats, tactics, archive, expert mode, settings, the guide, a full two-player battle against a mocked WebSocket server running the real room logic, and the Discord Activity with the SDK's mock |
| Lighthouse | Mobile **99 / 100 / 100 / 100**, desktop **100 / 100 / 100 / 100** (performance / accessibility / best practices / SEO) |
| Accessibility | Keyboard navigation, named board pieces for screen readers, live regions for feedback, `prefers-reduced-motion`, AA contrast in both themes |
| Privacy | Self-hosted fonts, locally generated 3D lighting, no third-party requests or cookies |

## Design decisions

- **Why a challenge instead of a viewer?** Recalling a move teaches far more than clicking "next". Limited mistakes and hints keep it fun for beginners without making it trivial.
- **Why curate 366 openings by hand?** The first version shipped 1,000 lines with template text ("A solid move.") that any chess player would notice. Fewer, correct lines beat volume. The content is validated by `scripts/check-openings.mjs` and the test suite, and the schedule only ever grows, so no player's history breaks.
- **Why the tactics and the archive, and not more daily puzzles?** One shared daily challenge keeps results comparable and shareable; everything extra (replays, expert mode, tactics) is counted apart, so it never distorts the streak or today's global stats.
- **Why no accounts?** The whole point is a one-minute daily ritual. An export code covers "I switched phones" without passwords or personal data.
- **Why the 3D king loads last.** Three.js is ~280 KB gzipped; it loads on the first interaction or after a few idle seconds, only on large screens, and pauses with reduced motion.
- **Why Durable Objects for battles.** A battle needs one place that owns the table: who's seated, whose clock is running, who scored what. A Durable Object per table is exactly that, with WebSockets that hibernate (an idle table costs nothing) and alarms for clocks — no separate server, no database for state that only lives a few minutes.
- **Why Cloudflare Workers + D1.** Static assets are free, the database sits next to the code, and the same Worker powers the API and the link previews.

## Project structure

```text
src/
  components/    React islands (challenge, study, result, board) and Astro layout pieces
  data/          Opening catalog (one JSON per family) and the daily schedule
  i18n/          UI strings (es, en)
  lib/           Framework-free logic: challenge engine, daily rotation, progress, stats API
  pages/         Home, archive, how-to-play and legal pages (es + en), 404, manifests and the JSON endpoints
worker/          Cloudflare Worker: API, D1 queries, link-preview rewriting, the battle Durable Object and the Discord Activity
migrations/      D1 schema
scripts/         Content checks, schedule, Lichess puzzle picker, Open Graph renderer, README screenshots
tests/ · e2e/    Vitest and Playwright suites
```

## Development

```bash
npm install
npm run dev          # http://localhost:4321 (global stats are hidden without the Worker)
npm test             # unit tests
npm run test:e2e     # end-to-end tests (builds and previews the site)
npm run check        # type-check the site and the Worker
npm run build        # static site + Open Graph images in dist/
npx wrangler dev     # Worker + assets + local D1 + battle tables on http://localhost:8787
```

`npm run dev` proxies `/api` (and the battle WebSockets) to `wrangler dev` on port 8787, so run both to play battles with hot reload. To try a battle alone, open the table in two different origins (`localhost` and `127.0.0.1`): each keeps its own seat.

Discord Activity (setup, tunnel for local testing inside Discord, or `DISCORD_MOCK=1` to try it without Discord): see [`DEPLOY.md`](DEPLOY.md#5-actividad-de-discord-solo-la-batalla).

Adding or editing openings: see [`src/data/openings/README.md`](src/data/openings/README.md). Deployment: see [`DEPLOY.md`](DEPLOY.md).

## Credits

3D model: "chess king" by [Amresh08_x_y_z](https://skfb.ly/pqzuU), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Tactics from the [Lichess puzzle database](https://database.lichess.org/#puzzles), CC0. Chess pieces from react-chessboard. Built by [acarrascosa](https://acarrascosa.com).
