import { expect, test, type Page } from '@playwright/test';
import { FakeTable } from './fake-table';

/* A two-player battle end to end, against a fake table server (see fake-table.ts). */

async function solveBoard(page: Page) {
    await expect(page.getByText('Tu turno: encuentra la mejor jugada')).toBeVisible();
    await page.locator('#battle-square-h5').click();
    await page.locator('#battle-square-f7').click();
}

test('two players race through the same boards and see the podium', async ({ page, browser }) => {
    const table = new FakeTable();
    const route = (p: Page) => p.routeWebSocket(/\/api\/battle\//, ws => table.connect(ws));

    // Ana creates a table.
    await route(page);
    await page.goto('/batalla/');
    await page.getByPlaceholder('Cómo te verán en la mesa').fill('Ana');
    await page.getByRole('button', { name: 'Crear mesa' }).click();
    const code = await page.getByTestId('table-code').textContent();
    expect(code).toMatch(/^[A-Z2-9]{4}$/);
    await expect(page.getByText('Hace falta al menos otro jugador.')).toBeVisible();

    // Bea follows the invite link.
    const other = await browser.newContext();
    const bea = await other.newPage();
    await route(bea);
    await bea.goto(`/batalla/?mesa=${code}`);
    await expect(bea.getByRole('heading', { name: `Te han invitado a la mesa ${code}` })).toBeVisible();
    await bea.getByPlaceholder('Cómo te verán en la mesa').fill('Bea');
    await bea.getByRole('button', { name: 'Sentarme' }).click();
    await expect(bea.getByTestId('lobby-player')).toHaveCount(2);

    // The host can only start once Bea is ready; changing the format asks again.
    const start = page.getByRole('button', { name: 'Comenzar' });
    await expect(start).toBeDisabled();
    await bea.getByRole('button', { name: 'Estoy listo' }).click();
    await expect(start).toBeEnabled();
    await page.getByRole('radio', { name: /Corta/ }).click();
    await expect(start).toBeDisabled();
    await bea.getByRole('button', { name: 'Estoy listo' }).click();
    await start.click();

    // Countdown, then both play the same two boards; Ana is quicker.
    await expect(page.getByText('Preparados…')).toBeVisible();
    await expect(page.getByText('Tablero 1 de 2 · Elo 1100')).toBeVisible({ timeout: 6_000 });
    await expect(page.getByTestId('board-clock')).toHaveText(/^[01]:\d\d$/);
    await solveBoard(page);
    await expect(page.getByTestId('board-result')).toHaveText(/¡Resuelto! \+\d+/);
    await expect(page.getByText('Tablero 2 de 2 · Elo 1100')).toBeVisible();
    await solveBoard(page);
    await expect(page.getByText('Has terminado. Esperando al resto…')).toBeVisible();

    // A hint (5 points) and a wrong move (15) cost Bea points.
    await expect(bea.getByText('Tu turno: encuentra la mejor jugada')).toBeVisible();
    const hint = bea.getByRole('button', { name: /Pista/ });
    await expect(hint).toContainText('−5 pts');
    await hint.click();
    await expect(bea.getByText('Mueve la dama')).toBeVisible();
    await bea.locator('#battle-square-h5').click();
    await bea.locator('#battle-square-h6').click();
    await expect(bea.getByText('Hay algo mejor.')).toBeVisible();
    await solveBoard(bea);
    await expect(bea.getByText('Tablero 2 de 2 · Elo 1100')).toBeVisible();
    await solveBoard(bea);

    for (const p of [page, bea]) await expect(p.getByTestId('results-table').locator('tbody tr')).toHaveCount(2);
    await expect(page.getByRole('heading', { name: '¡Has ganado!' })).toBeVisible();
    await expect(bea.getByRole('heading', { name: '¡Gana Ana!' })).toBeVisible();
    await expect(bea.getByTestId('results-table').locator('tbody tr').first()).toContainText('Ana');

    // Only the host decides what's next; Bea is told.
    await expect(bea.getByText('El anfitrión puede empezar la revancha o volver a la mesa.')).toBeVisible();
    await expect(bea.getByRole('button', { name: 'Revancha' })).toHaveCount(0);

    // Rematch: the same match again straight away, nobody has to confirm.
    await page.getByRole('button', { name: 'Revancha' }).click();
    await expect(bea.getByText('Preparados…')).toBeVisible();
    await expect(bea.getByText('Tablero 1 de 2 · Elo 1100')).toBeVisible({ timeout: 6_000 });
    for (const p of [page, bea]) {
        for (let board = 0; board < 2; board++) await solveBoard(p);
    }
    await expect(page.getByTestId('results-table')).toBeVisible();

    // Back to the table: here the host can change the match or wait for others; Bea confirms again.
    await page.getByRole('button', { name: 'Volver a la mesa' }).click();
    await expect(bea.getByRole('button', { name: 'Estoy listo' })).toBeVisible();
    await other.close();
});

test('explains that a table code does not exist', async ({ page }) => {
    const table = new FakeTable();
    await page.routeWebSocket(/\/api\/battle\//, ws => table.connect(ws));
    await page.goto('/batalla/');
    await page.getByPlaceholder('Código de mesa').fill('zzzz');
    await page.getByRole('button', { name: 'Unirse' }).click();
    await expect(page.getByRole('alert')).toHaveText('No hay ninguna mesa abierta con ese código.');
});
