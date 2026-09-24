import { test, type Browser, type Page } from '@playwright/test';
import { Chess, type Square } from 'chess.js';
import sharp from 'sharp';
import battlePuzzles from '../src/data/battle-puzzles.json' with { type: 'json' };
import { FakeTable } from '../e2e/fake-table';
import {
    COUNTDOWN_MS, TRANSITION_MS, boardPoints, pickBoards, seededRandom,
    type BattleBoard, type BattlePlayer, type BoardOutcome, type BoardResult, type Room,
} from '../src/lib/battle';
import { challengeReducer, createChallenge, isPlayerTurn, type ChallengeState } from '../src/lib/challenge';
import { puzzlePlies, puzzleSide, type Puzzle } from '../src/lib/puzzle';

/*
 * App Directory media for the Discord Activity: four players at one table, a match
 * in progress and the podium, rendered with the SDK's mock at 1920×1080. The rooms
 * are built from real puzzles; only the timestamps are staged.
 */

const OUT = 'public/media/discord';
const VIEWPORT = { width: 1280, height: 720 };
const PLAYERS = [['Ana', '100000000000000011'], ['Leo', '100000000000000012'], ['Maya', '100000000000000013'], ['Sam', '100000000000000014']];
const boards = pickBoards(battlePuzzles as Puzzle[], 'normal', seededRandom(2026));

const table = new FakeTable(url => {
    const [, id, name] = (url.searchParams.get('session') ?? '').split(':');
    return { token: `discord:${id}`, name, create: true, discordId: id };
});

async function join(browser: Browser, name: string, id: string): Promise<Page> {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1.5, locale: 'en-US', colorScheme: 'dark', reducedMotion: 'reduce' });
    await context.addInitScript(mockId => localStorage.setItem('chessbitz-discord-mock-id', mockId), id);
    const page = await context.newPage();
    await page.route('**/api/discord/config', route => route.fulfill({ json: { clientId: '1', mock: true } }));
    await page.route('**/api/discord/token', route => route.fulfill({ json: { access_token: 'mock', session: route.request().postDataJSON().code, locale: 'en-US' } }));
    await page.routeWebSocket(/\/api\/discord\/battle\//, ws => table.connect(ws));
    await page.goto(`/discord/?mock_user=${name}`);
    await page.getByTestId('lobby-player').first().waitFor();
    return page;
}

async function shoot(page: Page, name: string) {
    await page.waitForTimeout(700);
    await sharp(await page.screenshot()).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}.png`);
    console.log(`${OUT}/${name}.png`);
}

/** A legal move that isn't the solution (nor another mate), for a staged mistake. */
function wrongMove(state: ChallengeState, board: BattleBoard): { from: Square; to: Square } {
    const plies = puzzlePlies(board);
    const target = plies[state.cursor];
    const game = new Chess(target.before);
    const move = game.moves({ verbose: true }).find(m => m.from + m.to !== target.from + target.to && !m.san.endsWith('#'))!;
    return { from: move.from, to: move.to };
}

/** The player's progress on a board: the setup move played, then `mistakes` wrong attempts. */
function stateOn(board: BattleBoard, mistakes: number): ChallengeState {
    const plies = puzzlePlies(board);
    const reduce = challengeReducer(plies);
    let state = createChallenge(plies, puzzleSide(plies));
    while (state.status === 'playing' && !isPlayerTurn(state, plies)) state = reduce(state, { type: 'opponent' });
    for (let i = 0; i < mistakes; i++) state = reduce(state, { type: 'attempt', ...wrongMove(state, board) });
    return state;
}

type Plan = [BoardOutcome, number, number][]; // outcome, mistakes, seconds

function results(plan: Plan): BoardResult[] {
    return plan.map(([outcome, mistakes, seconds], i) => ({
        outcome, mistakes, ms: seconds * 1000, points: boardPoints(outcome, mistakes, seconds * 1000, boards[i].limit),
    }));
}

/** Staged player: finished boards per `plan`, then on the next board since `sinceMs` ago. */
function player(base: BattlePlayer, plan: Plan, now: number, sinceMs: number, mistakes = 0): BattlePlayer {
    const board = plan.length;
    return {
        ...base, ready: false, online: true, board, results: results(plan),
        boardStartedAt: now - sinceMs,
        state: boards[board] ? stateOn(boards[board], mistakes) : null,
    };
}

test('Discord App Directory media', async ({ browser }) => {
    const pages: Page[] = [];
    for (const [name, id] of PLAYERS) pages.push(await join(browser, name, id));
    const [ana] = pages;
    for (const page of pages.slice(1)) await page.getByRole('button', { name: "I'm ready" }).click();
    await ana.getByText("Everyone's ready: you can start!").waitFor();
    await shoot(ana, 'media-1-table');

    // A match in progress: Leo ahead, Ana on board 3 after a mistake, Sam a bit behind.
    const lobby = table.room!;
    const byName = (name: string) => lobby.players.find(p => p.name === name)!;
    const now = Date.now();
    const startsAt = now - 60_000;
    const playing: Room = {
        ...lobby, status: 'playing', boards, startsAt, round: 1, updatedAt: now,
        players: [
            player(byName('Ana'), [['won', 0, 14], ['won', 0, 19]], now, 13_000, 1),
            player(byName('Leo'), [['won', 0, 11], ['won', 0, 16], ['won', 1, 21]], now, 6_000),
            player(byName('Maya'), [['won', 1, 18], ['won', 0, 22]], now, 9_000),
            player(byName('Sam'), [['won', 2, 27]], now, 24_000),
        ],
    };
    table.load(playing);
    await ana.getByTestId('board-clock').waitFor();
    await shoot(ana, 'media-2-match');

    // The podium: a close finish, one board lost on mistakes and one on time.
    const done = Date.now();
    const finished: Room = {
        ...playing, status: 'finished', finishedAt: done, updatedAt: done, startsAt: done - 200_000 - COUNTDOWN_MS,
        players: [
            player(byName('Ana'), [['won', 0, 14], ['won', 0, 19], ['won', 1, 24], ['won', 0, 17], ['won', 0, 31]], done, 0),
            player(byName('Leo'), [['won', 0, 11], ['won', 0, 16], ['won', 1, 21], ['won', 0, 20], ['timeout', 0, boards[4].limit]], done, 0),
            player(byName('Maya'), [['won', 1, 18], ['won', 0, 22], ['lost', 5, 26], ['won', 0, 19], ['won', 2, 38]], done, 0),
            player(byName('Sam'), [['won', 2, 27], ['won', 0, 25], ['won', 0, 33], ['timeout', 1, boards[3].limit], ['won', 1, 40]], done, 0),
        ].map(p => ({ ...p, boardStartedAt: done + TRANSITION_MS })),
    };
    table.load(finished);
    await ana.getByTestId('results-table').waitFor();
    await shoot(ana, 'media-3-podium');
});
