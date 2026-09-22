import { expect, test } from '@playwright/test';

const DAY_3 = new Date('2026-09-25T12:00:00');

test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(DAY_3);
    await page.addInitScript(() => localStorage.setItem('chessbitz-onboarded', 'true'));
});

test('shows the guide on the first visit only', async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('seeded')) {
            localStorage.removeItem('chessbitz-onboarded');
            sessionStorage.setItem('seeded', '1');
        }
    });
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: 'Cómo se juega' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Siguiente' }).click();
    await expect(dialog.getByText('Tienes 5 errores por línea.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Siguiente' }).click();
    await dialog.getByRole('button', { name: 'Jugar' }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('lists past days in the archive and filters them', async ({ page }) => {
    await page.goto('/archivo/');
    await expect(page.getByRole('heading', { level: 1, name: 'Archivo' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Benoni Moderna/ })).toBeVisible();
    await page.getByPlaceholder('Buscar apertura o ECO…').fill('A60');
    await expect(page.getByRole('link', { name: /Benoni Moderna/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Apertura Inglesa/ })).toHaveCount(0);
});

test('plays an archive day in expert mode', async ({ page }) => {
    // Day 2 is the English Opening: a single white move, 1. c4.
    await page.goto('/archivo/?day=2&mode=expert');
    await expect(page.getByRole('heading', { level: 1, name: 'Apertura Inglesa' })).toBeVisible();
    await expect(page.getByText('Tu jugada 1 de 1')).toBeVisible();
    await page.locator('#expert-square-d2').click();
    await page.locator('#expert-square-d4').click();
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByText('Intento 2/6')).toBeVisible();
    await page.locator('#expert-square-c2').click();
    await page.locator('#expert-square-c4').click();
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('heading', { name: '¡Línea encontrada!' })).toBeVisible();
    await expect(page.getByText('En 2 de 6 intentos.', { exact: false })).toBeVisible();
});

test('switches to the high-contrast palette from settings', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('switch', { name: 'Alto contraste' }).click();
    await expect(page.locator('html')).toHaveClass(/contrast/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/contrast/);
});

test('serves the guide with FAQ structured data in both languages', async ({ page }) => {
    await page.goto('/como-jugar/');
    await expect(page.getByRole('heading', { level: 1, name: 'Cómo se juega a Chessbitz' })).toBeVisible();
    const schema = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
    expect(schema['@type']).toBe('FAQPage');
    await page.goto('/en/how-to-play/');
    await expect(page.getByRole('heading', { level: 1, name: 'How to play Chessbitz' })).toBeVisible();
});

test('suggests a coffee after a few finished games, once', async ({ page }) => {
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('seeded')) {
            localStorage.setItem('chessbitz:support:v1', JSON.stringify({ views: 0, games: 2 }));
            sessionStorage.setItem('seeded', '1');
        }
    });
    // Day 2 of the calendar (Sep 24) is the English Opening: one move, 1. c4.
    await page.clock.setFixedTime(new Date('2026-09-24T12:00:00'));
    await page.goto('/');
    await page.locator('#challenge-square-c2').click();
    await page.locator('#challenge-square-c4').click();
    const note = page.getByRole('complementary', { name: '¿Te está gustando Chessbitz?' });
    await expect(note).toBeVisible({ timeout: 8000 });
    await expect(note.getByRole('link', { name: 'Invítame a un café' })).toHaveAttribute('href', 'https://buymeacoffee.com/acarrascosa');
    await note.getByRole('button', { name: 'Ahora no' }).click();
    await expect(note).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { name: '¡Línea completada!' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: '¿Te está gustando Chessbitz?' })).toHaveCount(0);
});
