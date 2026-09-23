import { defineConfig } from '@playwright/test';

/*
 * Screenshots of the Discord Activity for the App Directory (public/media/discord/media-*.png):
 *   npx playwright test -c scripts/discord-media.config.ts
 * Not part of the test suite; it reuses the e2e fake table server.
 */
const PORT = 4323;

export default defineConfig({
    testDir: '.',
    testMatch: 'discord-media.spec.ts',
    timeout: 120_000,
    reporter: 'list',
    use: { baseURL: `http://localhost:${PORT}` },
    webServer: {
        command: `npm run build:site && npx astro preview --port ${PORT}`,
        cwd: '..',
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 180_000,
    },
});
