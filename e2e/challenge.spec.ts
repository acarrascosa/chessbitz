import { expect, test, type Locator, type Page } from '@playwright/test';

// Pin the calendar: day 0 of the schedule is the Modern Benoni (the player has black),
// day 2 is the English Opening (a single white move).
const DAY_0 = new Date('2026-09-22T12:00:00');
const DAY_2 = new Date('2026-09-24T12:00:00');
const BENONI = [['g8', 'f6'], ['c7', 'c5'], ['e7', 'e6'], ['e6', 'd5'], ['d7', 'd6']] as const;

async function center(page: Page, square: string) {
    const box = await page.locator(`#challenge-square-${square}`).boundingBox();
    if (!box) throw new Error(`Square ${square} not found`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Drag and drop on desktop, click-to-move on touch devices. */
async function move(page: Page, from: string, to: string) {
    if (test.info().project.name === 'mobile') {
        await page.locator(`#challenge-square-${from}`).click();
        await page.locator(`#challenge-square-${to}`).click();
        return;
    }
    // Raw mouse events don't auto-scroll like click() does.
    await page.locator('.board-frame').scrollIntoViewIfNeeded();
    const start = await center(page, from);
    const end = await center(page, to);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
}

/**
 * dnd-kit swallows clicks for a moment after a drag ends, so a click that
 * immediately follows the last move is retried until it takes effect.
 */
async function clickAfterDrag(target: Locator, done: () => Promise<void>) {
    await expect(async () => {
        await target.click();
        await done();
    }).toPass();
}

async function openDay(page: Page, date: Date, path = '/') {
    await page.clock.setFixedTime(date);
    await page.addInitScript(() => localStorage.setItem('chessbitz-onboarded', 'true'));
    await page.goto(path);
}

const yourTurn = (page: Page) => expect(page.getByText('Tu turno: encuentra la jugada de la línea')).toBeVisible();

test('plays a full line, unlocks study mode and remembers the result', async ({ page }) => {
    await openDay(page, DAY_0);
    await expect(page.getByRole('heading', { level: 1, name: 'Benoni Moderna' })).toBeVisible();
    await expect(page.getByText('Juegas con negras')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Estudiar' })).toBeDisabled();

    for (const [from, to] of BENONI) {
        await yourTurn(page);
        await move(page, from, to);
        await expect(page.getByText('¡Correcto!').or(page.getByText('¡Línea completada!'))).toBeVisible();
    }

    await expect(page.getByRole('heading', { name: '¡Línea completada!' })).toBeVisible();
    await expect(page.getByText('🟩🟩🟩🟩🟩')).toBeVisible();
    await expect(page.getByText('Ideas y planes')).toBeVisible();
    // Your game: mistakes, hints and time.
    await expect(page.getByRole('region', { name: 'Tu partida' })).toContainText('0/5');

    await clickAfterDrag(page.getByRole('tab', { name: 'Estudiar' }), () =>
        expect(page.getByRole('button', { name: 'd6', exact: true })).toHaveAttribute('aria-current', 'step', { timeout: 1000 }));

    await page.reload();
    await expect(page.getByRole('heading', { name: '¡Línea completada!' })).toBeVisible();
});

test('counts mistakes and reveals hints step by step', async ({ page }) => {
    await openDay(page, DAY_0);
    await yourTurn(page);

    await move(page, 'e7', 'e5');
    await expect(page.getByText('Esa no es la jugada de la línea.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Errores: 1/5' })).toBeVisible();
    // dnd-kit swallows clicks for a moment after a drag ends; wait like a person would.
    await yourTurn(page);

    // Help on a move costs half an error, the square is free and the arrow the other half.
    const hint = page.getByRole('button', { name: /Pista/ });
    await expect(hint).toContainText('−½ error');
    await hint.click();
    await expect(page.getByText('Mueve un caballo')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Errores: 1,5/5' })).toBeVisible();
    await expect(hint).not.toContainText('−½');
    await hint.click();
    await expect(page.getByText('La pieza está en g8')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Errores: 1,5/5' })).toBeVisible();
    await hint.click();
    await expect(page.getByText('La jugada es Nf6')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Errores: 2/5' })).toBeVisible();
    await expect(hint).toBeDisabled();
});

test('ignores illegal moves and loses after five mistakes', async ({ page }) => {
    await openDay(page, DAY_0);
    await yourTurn(page);

    await move(page, 'e7', 'e4');
    await expect(page.getByRole('img', { name: 'Errores: 0/5' })).toBeVisible();

    for (let i = 0; i < 5; i++) {
        // A wrong move is not played, so the same legal-but-wrong move can be repeated.
        await move(page, 'a7', 'a6');
        if (i < 4) await yourTurn(page);
    }
    await expect(page.getByRole('heading', { name: 'Te quedaste sin errores' })).toBeVisible();
    await expect(page.getByText('🟥🟥🟥🟥🟥')).toBeVisible();
});

test('records hints in the result and the statistics panel', async ({ page }) => {
    await openDay(page, DAY_2);
    await expect(page.getByText('Juegas con blancas')).toBeVisible();
    await page.getByRole('button', { name: /Pista/ }).click();
    await move(page, 'c2', 'c4');
    await expect(page.getByRole('heading', { name: '¡Línea completada!' })).toBeVisible();
    await expect(page.getByText('🟨')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Tu partida' }).getByText('Pistas')).toBeVisible();
    // The hint shows up as half an error.
    await expect(page.getByRole('region', { name: 'Tu partida' })).toContainText('0,5/5');

    await clickAfterDrag(page.getByRole('button', { name: 'Tus estadísticas' }), () =>
        expect(page.getByRole('dialog', { name: 'Tus estadísticas' })).toBeVisible({ timeout: 1000 }));
    await expect(page.getByRole('dialog')).toContainText('Pistas por reto: 1');
});

test('unlocks a real tactic from the opening', async ({ page }) => {
    await openDay(page, DAY_2);
    await expect(page.getByRole('tab', { name: 'Táctica' })).toBeDisabled();
    await move(page, 'c2', 'c4');
    await expect(page.getByRole('heading', { name: '¡Línea completada!' })).toBeVisible();
    await clickAfterDrag(page.getByRole('tab', { name: 'Táctica' }), () =>
        expect(page.getByText('Tu turno: encuentra la mejor jugada')).toBeVisible({ timeout: 2000 }));
    await expect(page.locator('#tactic-square-a1')).toBeAttached();
});

test('serves the English version at /en/', async ({ page }) => {
    await openDay(page, DAY_0, '/en/');
    await expect(page.getByRole('heading', { level: 1, name: 'Modern Benoni' })).toBeVisible();
    await expect(page.getByText('You play black')).toBeVisible();
    await expect(page.locator('header a[hreflang="es"]')).toHaveAttribute('href', '/');
});

test('copies a spoiler-free result to share', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Touch devices use the native share sheet');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openDay(page, DAY_2);

    await expect(page.getByText('Juegas con blancas')).toBeVisible();
    await move(page, 'c2', 'c4');
    await expect(page.getByRole('heading', { name: '¡Línea completada!' })).toBeVisible();
    await clickAfterDrag(page.getByRole('button', { name: 'Compartir' }), () =>
        expect(page.getByText('¡Copiado!')).toBeVisible({ timeout: 1000 }));

    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('Chessbitz #3 · Apertura Inglesa\n🟩 0/5\nhttps://chessbitz.com');
});
