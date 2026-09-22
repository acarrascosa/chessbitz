import { expect, test } from '@playwright/test';

test('loads the decorative 3D king only after the first interaction on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'The 3D scene is desktop-only');
    await page.addInitScript(() => localStorage.setItem('chessbitz-onboarded', 'true'));
    await page.goto('/');
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.mouse.move(200, 200);
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 10_000 });
});

test('names board pieces for screen readers', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-09-22T12:00:00'));
    await page.addInitScript(() => localStorage.setItem('chessbitz-onboarded', 'true'));
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'caballo negro, g8' })).toBeVisible();
});
