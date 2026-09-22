# Chessbitz

**A daily chess-opening challenge.** Every day there is a new opening to *play* on the board: find each move of the line, use hints if you get stuck, keep your streak alive and share a spoiler-free result — then study the line move by move.

[chessbitz.com](https://chessbitz.com) · [English](https://chessbitz.com/en/) · [Español](https://chessbitz.com/)

![Playing the Modern Benoni](docs/demo.webp)

## Features

- **Playable daily challenge** — you play the side that defines the opening (black in the Sicilian, white in the Ruy Lopez); the opponent replies on its own. Drag-and-drop or tap-to-move, legal-move hints on the board.
- **Wordle-style scoring** — 5 mistakes per line and three hint levels (which piece → from where → the arrow). Every move ends up 🟩 first try, 🟨 with help or 🟥 revealed, and the grid can be shared without spoilers.
- **366 curated openings** — one per day for a full year, each with bilingual names, a description, the strategic ideas behind it and an explanation for *every* move.
- **Streaks and statistics** stored locally, plus **anonymous global stats** served from the edge (e.g. "312 players · 41% flawless" today).
- **Study mode** with keyboard navigation, unlocked once today's challenge is finished.
- **Rich link previews** — when the site is shared, the preview shows today's opening with its final position.
- Spanish and English, light and dark themes, a decorative 3D brass king on large screens.

| | | |
| --- | --- | --- |
| ![Challenge with hints, light theme](docs/challenge-light.webp) | ![Result card, dark theme](docs/result-dark.webp) | ![Mobile](docs/mobile-light.webp) |

## Architecture

```mermaid
flowchart LR
    subgraph Build ["npm run build"]
        A[Opening catalog<br/>src/data/openings/*.json] --> B[Astro static build]
        A --> C[Open Graph renderer<br/>Satori + resvg]
        B --> D[(dist/)]
        C --> D
    end
    subgraph Edge ["Cloudflare"]
        W[Worker] -- "/api/results<br/>/api/stats/:day" --> DB[(D1)]
        W -- "everything else" --> S[Static assets]
        W -- "/ and /en/<br/>HTMLRewriter: today's og:image" --> S
    end
    D --> S
    Browser -- "HTML, JS, today's opening JSON" --> W
```

- **Static first.** Astro renders the pages; the game is a React island. The client downloads only *today's* opening (`/data/daily/{n}.json`, ~2 KB) — the request starts in `<head>`, before hydration.
- **Pure game logic.** Everything that matters is framework-free and unit-tested: the challenge is a reducer (`src/lib/challenge.ts`), plus the daily rotation, stats and share text.
- **Edge API.** A Cloudflare Worker serves the assets and a tiny API backed by D1. It stores only aggregated `(day, mistakes)` counters — no cookies, no identifiers; the IP is used transiently for rate limiting and never stored.
- **Link previews without SSR.** Crawlers don't run JavaScript, so the Worker rewrites the home page's Open Graph tags on the fly to point at a pre-rendered image of today's opening.

![Open Graph image](docs/og-example.png)

## Tech stack

Astro 5 · React 19 · TypeScript · Tailwind CSS 4 · chess.js · react-chessboard · Three.js (React Three Fiber) · Cloudflare Workers + D1 · Satori + resvg · Vitest · Playwright

## Quality

| | |
| --- | --- |
| Unit tests | 406 Vitest tests — game engine, dates across time zones and DST, stats, API validation and every opening in the catalog (legal line, one explanation per move, both languages) |
| End-to-end | Playwright on desktop Chrome (drag and drop) and a mobile device (tap to move) |
| Lighthouse | Mobile **99 / 100 / 100 / 100**, desktop **100 / 100 / 100 / 100** (performance / accessibility / best practices / SEO) |
| Accessibility | Keyboard navigation, named board pieces for screen readers, live regions for feedback, `prefers-reduced-motion`, AA contrast in both themes |
| Privacy | Self-hosted fonts, locally generated 3D lighting, no third-party requests or cookies |

## Design decisions

- **Why a challenge instead of a viewer?** Recalling a move teaches far more than clicking "next". Limited mistakes and hints keep it fun for beginners without making it trivial.
- **Why curate 366 openings by hand?** The first version shipped 1,000 lines with template text ("A solid move.") that any chess player would notice. Fewer, correct lines beat volume. The content is validated by `scripts/check-openings.mjs` and the test suite, and the schedule only ever grows, so no player's history breaks.
- **Why the 3D king loads last.** Three.js is ~280 KB gzipped; it loads on the first interaction or after a few idle seconds, only on large screens, and pauses with reduced motion.
- **Why Cloudflare Workers + D1.** Static assets are free, the database sits next to the code, and the same Worker powers the API and the link previews.

## Project structure

```text
src/
  components/    React islands (challenge, study, result, board) and Astro layout pieces
  data/          Opening catalog (one JSON per family) and the daily schedule
  i18n/          UI strings (es, en)
  lib/           Framework-free logic: challenge engine, daily rotation, progress, stats API
  pages/         /, /en/, legal pages, 404 and the per-day JSON endpoints
worker/          Cloudflare Worker: API, D1 queries and link-preview rewriting
migrations/      D1 schema
scripts/         Content checks, schedule, Open Graph renderer, README screenshots
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
npx wrangler dev     # Worker + assets + local D1 on http://localhost:8787
```

Adding or editing openings: see [`src/data/openings/README.md`](src/data/openings/README.md). Deployment: see [`DEPLOY.md`](DEPLOY.md).

## Credits

3D model: "chess king" by [Amresh08_x_y_z](https://skfb.ly/pqzuU), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Chess pieces from react-chessboard. Built by [acarrascosa](https://acarrascosa.com).
