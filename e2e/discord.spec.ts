import { expect, test, type Page } from '@playwright/test';
import { FakeTable } from './fake-table';

/*
 * The Discord Activity page with the SDK's mock (what DISCORD_MOCK=1 does locally):
 * no Discord client, but the same handshake, one table per Activity instance and
 * the Discord-specific lobby and podium.
 */

test.use({ locale: 'es-ES' });

/** Discord identities come from the session; everyone in the instance may open the table. */
const discordTable = () => new FakeTable(url => {
    const [, id, name] = (url.searchParams.get('session') ?? '').split(':');
    return { token: `discord:${id}`, name, create: true, discordId: id };
});

async function openActivity(page: Page, table: FakeTable, name: string, locale?: string) {
    await page.route('**/api/discord/config', route => route.fulfill({ json: { clientId: '1', mock: true } }));
    // The mock's authorize code is "mock:<id>:<name>"; the fake Worker uses it as the session.
    await page.route('**/api/discord/token', route => route.fulfill({ json: { access_token: 'mock', session: route.request().postDataJSON().code, locale } }));
    await page.routeWebSocket(/\/api\/discord\/battle\//, ws => table.connect(ws));
    await page.goto(`/discord/?mock_user=${name}`);
}

test('everyone in the Activity sits at the same table and the podium goes to the channel', async ({ page, browser }) => {
    const table = discordTable();
    await openActivity(page, table, 'Ana');
    await expect(page.getByRole('heading', { name: 'Batalla de tácticas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invitar' })).toBeVisible();

    const other = await browser.newContext({ locale: 'es-ES' });
    const bea = await other.newPage();
    await openActivity(bea, table, 'Bea');
    await expect(bea.getByTestId('lobby-player')).toHaveCount(2);
    await expect(bea.getByTestId('lobby-player').first()).toContainText('Ana');

    // Names come from Discord and leaving is closing the Activity: no rename, no "leave the table".
    await expect(page.getByRole('button', { name: 'Cambiar nombre' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salir de la mesa' })).toHaveCount(0);
    await expect(page.getByTestId('table-code')).toHaveCount(0);

    // Rich Presence: the table with its party (throttled, so give it a few seconds).
    const presence = () => page.evaluate(() => (window as unknown as { chessbitzPresence?: { details: string; state: string; party?: { size: number[] } } }).chessbitzPresence);
    await expect.poll(presence, { timeout: 8_000 }).toMatchObject({ details: 'Batalla · Normal', state: 'En la mesa', party: { size: [2, 4] } });

    await bea.getByRole('button', { name: 'Estoy listo' }).click();
    await page.getByRole('button', { name: 'Comenzar' }).click();
    await expect(page.getByText('Tablero 1 de 2 · Elo 1100')).toBeVisible({ timeout: 6_000 });
    await expect.poll(presence, { timeout: 8_000 }).toMatchObject({ details: 'Tablero 1 de 2', state: '1.º · 0 pts' });

    bea.on('dialog', dialog => dialog.accept());
    await bea.getByRole('button', { name: 'Abandonar la partida' }).click();
    await expect(bea.getByText('Has salido de la mesa.')).toBeVisible();

    for (let board = 0; board < 2; board++) {
        await expect(page.getByText('Tu turno: encuentra la mejor jugada')).toBeVisible();
        await page.locator('#battle-square-h5').click();
        await page.locator('#battle-square-f7').click();
    }
    await expect(page.getByRole('heading', { name: '¡Has ganado!' })).toBeVisible();
    await expect(page.getByText('El podio se publica en el canal', { exact: false })).toBeVisible();

    // Back to the table after leaving.
    await bea.getByRole('button', { name: 'Volver a la mesa' }).click();
    await expect(bea.getByRole('heading', { name: '¡Gana Ana!' })).toBeVisible();
    await other.close();
});

test('speaks the language set in Discord, not the system one', async ({ page }) => {
    // The browser (the OS) says Spanish; Discord says English.
    await openActivity(page, discordTable(), 'Ana', 'en-US');
    await expect(page.getByRole('heading', { name: 'Tactics battle' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invite' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('says which handshake step failed', async ({ page }) => {
    await page.route('**/api/discord/config', route => route.fulfill({ json: { clientId: '1', mock: true } }));
    await page.route('**/api/discord/token', route => route.fulfill({ status: 401, json: { error: 'Discord refused the code' } }));
    await page.goto('/discord/?mock_user=Ana');
    await expect(page.getByText('No se pudo conectar con Discord', { exact: false })).toBeVisible();
    await expect(page.getByTestId('discord-error-detail')).toHaveText('token: HTTP 401 {"error":"Discord refused the code"}');
});

test('outside Discord it points to the web version', async ({ page }) => {
    await page.route('**/api/discord/config', route => route.fulfill({ json: { clientId: '1', mock: false } }));
    await page.goto('/discord/');
    await expect(page.getByText('Esta página es la actividad de Chessbitz para Discord', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Jugar la batalla en la web' })).toHaveAttribute('href', '/batalla/');
});
