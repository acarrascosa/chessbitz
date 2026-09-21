import { defineConfig, devices } from '@playwright/test';

const PORT = 4323;

export default defineConfig({
    testDir: 'e2e',
    fullyParallel: true,
    // Drag-and-drop under parallel load can very rarely race; retries surface it as "flaky".
    retries: 1,
    reporter: 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'retain-on-failure',
        // Also keeps the 3D scene on a single frame, so software WebGL in
        // headless runs doesn't starve the main thread.
        contextOptions: { reducedMotion: 'reduce' },
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],
    webServer: {
        command: `npm run build:site && npx astro preview --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 180_000,
    },
});
