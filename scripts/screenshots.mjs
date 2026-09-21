// Regenerates the README images from a running production build:
//   npm run build && npx astro preview --port 4323 & node scripts/screenshots.mjs
import { mkdirSync } from 'node:fs';
import { chromium, devices } from '@playwright/test';
import sharp from 'sharp';

const BASE = process.env.BASE_URL ?? 'http://localhost:4323';
const OUT = 'docs';
const DAY_0 = new Date('2026-01-25T12:00:00'); // Modern Benoni, player has black
const DAY_2 = new Date('2026-01-27T12:00:00'); // English Opening, player has white
const BENONI = [['g8', 'f6'], ['c7', 'c5'], ['e7', 'e6'], ['e6', 'd5'], ['d7', 'd6']];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function open({ theme = 'light', date = DAY_0, viewport = { width: 1440, height: 900 }, device } = {}) {
    const context = await browser.newContext({ ...(device ?? { viewport }), deviceScaleFactor: 2, colorScheme: theme });
    const page = await context.newPage();
    await page.clock.setFixedTime(date);
    await page.addInitScript(t => {
        localStorage.setItem('chessbitz-onboarded', 'true');
        localStorage.setItem('theme', t);
    }, theme);
    await page.goto(BASE);
    await page.getByText(/Tu turno/).waitFor();
    return { context, page };
}

/** Screenshots are stored as WebP to keep the repository light. */
async function save(page, name) {
    const png = await page.screenshot();
    await sharp(png).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(`${OUT}/${name}.webp`);
}

async function play(page, from, to) {
    await page.locator(`#challenge-square-${from}`).click();
    await page.locator(`#challenge-square-${to}`).click();
}

const waitTurn = page => page.getByText(/Tu turno/).waitFor();

// 1. Desktop, light: mid-challenge with the full hint (arrow) and the 3D king.
{
    const { context, page } = await open();
    await page.mouse.move(700, 300);
    await play(page, 'g8', 'f6');
    await page.waitForTimeout(1500);
    await waitTurn(page);
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Pista/ }).click();
    await page.waitForTimeout(2500);
    await save(page, 'challenge-light');
    await context.close();
}

// 2. Desktop, dark: finished challenge with the result card.
{
    const { context, page } = await open({ theme: 'dark', date: DAY_2 });
    await page.mouse.move(700, 300);
    await play(page, 'c2', 'c4');
    await page.getByRole('heading', { name: '¡Línea completada!' }).waitFor();
    await page.waitForTimeout(3500);
    await save(page, 'result-dark');
    await context.close();
}

// 3. Mobile, light.
{
    const { context, page } = await open({ device: devices['iPhone 13'] });
    await save(page, 'mobile-light');
    await context.close();
}

// 4. Animated WebP of a full line, cropped to the board and panel.
{
    const { context, page } = await open({ viewport: { width: 1100, height: 760 } });
    await page.locator('.board-frame').scrollIntoViewIfNeeded();
    const board = await page.locator('.board-frame').boundingBox();
    const clip = { x: board.x - 16, y: board.y - 16, width: 480 + 40 + 352 + 32, height: board.height + 32 };
    const frames = [];
    const snap = async (repeat = 1) => {
        const frame = await page.screenshot({ clip });
        for (let i = 0; i < repeat; i++) frames.push(frame);
    };
    await snap(3);
    for (const [from, to] of BENONI) {
        await waitTurn(page);
        await page.locator(`#challenge-square-${from}`).click();
        await snap();
        await page.locator(`#challenge-square-${to}`).click();
        await page.waitForTimeout(250);
        await snap(2);
    }
    await page.getByRole('heading', { name: '¡Línea completada!' }).waitFor();
    await page.waitForTimeout(600);
    await snap(8);
    const resized = await Promise.all(frames.map(frame => sharp(frame).resize({ width: 900 }).toBuffer()));
    await sharp(resized, { join: { animated: true } })
        .webp({ loop: 0, delay: resized.map(() => 450), quality: 80 })
        .toFile(`${OUT}/demo.webp`);
    await context.close();
}

await browser.close();
console.log('README images written to docs/');
