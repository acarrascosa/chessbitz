# Opening catalog

Each `*.json` file in this folder is one opening family and holds an array of entries:

```jsonc
{
  "slug": "ruy-lopez-berlin",          // unique, kebab-case, never renamed (stored in players' history)
  "eco": "C65",
  "side": "b",                         // who makes the defining choice; the player plays this side
  "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6", // canonical SAN, ends on the defining move
  "es": { "name": "", "description": "", "idea": "", "moves": [] },
  "en": { "name": "", "description": "", "idea": "", "moves": [] }
}
```

## Style guide

- **side**: the side whose move gives the line its name. The Sicilian Najdorf is black's
  choice; the Alapin Sicilian (2.c3) is white's. Lines end on that side's defining move.
- **name**: the established name in each language ("Apertura Española: Defensa Berlinesa" /
  "Ruy Lopez: Berlin Defense"). Family first, variation after a colon.
- **description**: one sentence, a hook — why this line is interesting. No move lists.
- **idea**: two or three sentences on plans, pawn structures and typical piece placement
  *after* the line ends. This is what the player should remember.
- **moves**: one short sentence per ply (6–20 words) explaining the *purpose* of the move,
  not restating it. Mention threats, squares and plans; avoid filler like "a solid move".
- Spanish uses Spanish piece letters only inside prose ("el caballo de f3"); SAN stays English.

## Workflow

```bash
node scripts/check-openings.mjs   # legality, canonical PGN, ply/explanation counts, duplicates
node scripts/schedule.mjs         # append new openings to the daily schedule (never reorders)
npm test                          # includes the same catalog checks
```
