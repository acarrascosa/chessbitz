// Regenerates the README images from a running production build:
//   npm run build && npx astro preview --port 4323 & node scripts/screenshots.mjs
import { mkdirSync } from 'node:fs';
import { chromium, devices } from '@playwright/test';
import sharp from 'sharp';

const BASE = process.env.BASE_URL ?? 'http://localhost:4323';
const OUT = 'docs';
const DAY_0 = new Date('2026-09-22T12:00:00'); // Modern Benoni, player has black
const DAY_2 = new Date('2026-09-24T12:00:00'); // English Opening, player has white
const BENONI = [['g8', 'f6'], ['c7', 'c5'], ['e7', 'e6'], ['e6', 'd5'], ['d7', 'd6']];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function open({ theme = 'light', date = DAY_0, viewport = { width: 1440, height: 900 }, device, path = '/', ready = /Tu turno/ } = {}) {
    const context = await browser.newContext({ ...(device ?? { viewport }), deviceScaleFactor: 2, colorScheme: theme });
    const page = await context.newPage();
    await page.clock.setFixedTime(date);
    await page.addInitScript(t => {
        localStorage.setItem('chessbitz-onboarded', 'true');
        localStorage.setItem('theme', t);
    }, theme);
    await page.goto(BASE + path);
    await page.getByText(ready).first().waitFor();
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

// 4. Expert mode on an archive day: one graded attempt and the next one under way.
{
    const { context, page } = await open({ date: new Date('2026-10-20T12:00:00'), path: '/archivo/?day=0&mode=expert', ready: /Tu jugada/ });
    await page.mouse.move(700, 300);
    const attempt = [['g8', 'f6'], ['e7', 'e6'], ['c7', 'c5'], ['e6', 'd5'], ['d7', 'd6']];
    for (const [from, to] of attempt) {
        await page.getByText(/Tu jugada/).waitFor();
        await page.locator(`#expert-square-${from}`).click();
        await page.locator(`#expert-square-${to}`).click();
    }
    await page.getByRole('button', { name: 'Enviar' }).click();
    for (const [from, to] of BENONI.slice(0, 2)) {
        await page.getByText(/Tu jugada/).waitFor();
        await page.locator(`#expert-square-${from}`).click();
        await page.locator(`#expert-square-${to}`).click();
    }
    await page.waitForTimeout(2500);
    await save(page, 'expert-light');
    await context.close();
}

// 5. Archive list, dark.
{
    const { context, page } = await open({ theme: 'dark', date: new Date('2026-10-20T12:00:00'), path: '/archivo/', ready: /Benoni Moderna/ });
    await page.waitForTimeout(800);
    await save(page, 'archive-dark');
    await context.close();
}

// 6. The tactic unlocked after finishing the English Opening.
{
    const { context, page } = await open({ date: DAY_2 });
    await page.mouse.move(700, 300);
    await play(page, 'c2', 'c4');
    await page.getByRole('heading', { name: '¡Línea completada!' }).waitFor();
    await page.getByRole('tab', { name: 'Táctica' }).click();
    await page.getByText(/encuentra la mejor jugada/).waitFor();
    await page.waitForTimeout(4000);
    await save(page, 'tactic-light');
    await context.close();
}

// 7. Animated WebP of a full line, cropped to the board and panel.
{
    const { context, page } = await open({ viewport: { width: 1280, height: 800 } });
    const stage = await page.locator('.stage').boundingBox();
    const clip = { x: stage.x - 16, y: stage.y - 16, width: stage.width + 32, height: stage.height + 32 };
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
