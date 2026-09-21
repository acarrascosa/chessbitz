// Renders the Open Graph images into dist/og after `astro build`:
//   default-{lang}.png   generic site preview
//   {index}-{lang}.png   one per scheduled opening (the Worker picks today's)
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultPieces } from 'react-chessboard';
import { Chess } from 'chess.js';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const OUT = 'dist/og';
const WIDTH = 1200;
const HEIGHT = 630;
const COLORS = { paper: '#f4efe4', ink: '#1d2621', muted: '#5b675f', brass: '#8a6630', green: '#1f4435', light: '#ecdfc7', dark: '#a47e56' };
const TEXT = {
    es: { eyebrow: 'Apertura del día', tagline: 'Tu apertura diaria', pitch: 'Juega los movimientos de una apertura clásica cada día y aprende sus ideas.' },
    en: { eyebrow: 'Opening of the day', tagline: 'Your daily opening', pitch: 'Play the moves of a classic opening every day and learn its ideas.' },
};

const font = (pkg, file) => readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`);
const fonts = [
    { name: 'Fraunces', weight: 600, data: font('fraunces', 'fraunces-latin-600-normal.woff') },
    { name: 'Fraunces', weight: 600, data: font('fraunces', 'fraunces-latin-ext-600-normal.woff') },
    { name: 'Inter', weight: 400, data: font('inter', 'inter-latin-400-normal.woff') },
    { name: 'Inter', weight: 400, data: font('inter', 'inter-latin-ext-400-normal.woff') },
    { name: 'Inter', weight: 700, data: font('inter', 'inter-latin-700-normal.woff') },
];

// Minimal hyperscript for Satori's element tree.
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat() } });

const pieceImages = Object.fromEntries(
    Object.entries(defaultPieces).map(([type, render]) => {
        const svg = renderToStaticMarkup(render({ svgStyle: { width: '100%', height: '100%' } }))
            .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        return [type, `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`];
    }),
);

function board(fen, flipped, size) {
    const squares = new Chess(fen).board();
    const rows = flipped ? [...squares].reverse().map(row => [...row].reverse()) : squares;
    const cell = size / 8;
    return h('div', { flexDirection: 'column', padding: 14, borderRadius: 18, background: 'linear-gradient(145deg, #6b4b2e, #3f2a19)' },
        h('div', { flexDirection: 'column', borderRadius: 6, overflow: 'hidden' },
            rows.map((row, r) => h('div', {}, row.map((piece, c) => h('div', { width: cell, height: cell, background: (r + c) % 2 ? COLORS.dark : COLORS.light, alignItems: 'center', justifyContent: 'center' },
                piece ? [{ type: 'img', props: { src: pieceImages[`${piece.color}${piece.type.toUpperCase()}`], width: cell * 0.92, height: cell * 0.92 } }] : [],
            ))))));
}

const logo = (() => {
    const svg = readFileSync('public/favicon.svg', 'utf8')
        .replace(/<style>[\s\S]*?<\/style>/, '')
        .replace('class="a"', `stop-color="${COLORS.brass}"`)
        .replace('class="b"', `stop-color="${COLORS.green}"`);
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
})();

function card({ eyebrow, title, body, fen, flipped, lang }) {
    return h('div', { width: WIDTH, height: HEIGHT, background: COLORS.paper, padding: 64, gap: 56, alignItems: 'center', fontFamily: 'Inter' },
        h('div', { flexDirection: 'column', flex: 1, height: '100%', justifyContent: 'space-between' },
            h('div', { flexDirection: 'column', gap: 22 },
                h('div', { color: COLORS.brass, fontSize: 22, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase' }, eyebrow),
                h('div', { fontFamily: 'Fraunces', fontSize: title.length > 34 ? 50 : 62, lineHeight: 1.08, color: COLORS.ink }, title),
                h('div', { fontSize: 26, lineHeight: 1.4, color: COLORS.muted }, body)),
            h('div', { alignItems: 'center', gap: 16 },
                { type: 'img', props: { src: logo, width: 44, height: 44 } },
                h('div', { fontFamily: 'Fraunces', fontSize: 32, color: COLORS.ink }, 'Chessbitz'),
                h('div', { fontSize: 22, color: COLORS.muted, marginLeft: 8 }, lang === 'es' ? 'chessbitz.com' : 'chessbitz.com/en'))),
        board(fen, flipped, 440));
}

async function render(element, file) {
    const svg = await satori(element, { width: WIDTH, height: HEIGHT, fonts });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
    // Palette PNGs are ~3x smaller and visually identical for these flat illustrations.
    await sharp(png).png({ palette: true, quality: 90, effort: 7 }).toFile(`${OUT}/${file}`);
}

const catalog = new Map(
    readdirSync('src/data/openings')
        .filter(file => file.endsWith('.json'))
        .flatMap(file => JSON.parse(readFileSync(`src/data/openings/${file}`, 'utf8')))
        .map(entry => [entry.slug, entry]),
);
const schedule = JSON.parse(readFileSync('src/data/schedule.json', 'utf8'));

mkdirSync(OUT, { recursive: true });
const started = Date.now();
const start = new Chess().fen();

for (const lang of ['es', 'en']) {
    await render(card({ eyebrow: TEXT[lang].tagline, title: 'Chessbitz', body: TEXT[lang].pitch, fen: start, flipped: false, lang }), `default-${lang}.png`);
}

for (const [index, slug] of schedule.entries()) {
    const opening = catalog.get(slug);
    const game = new Chess();
    game.loadPgn(opening.pgn);
    for (const lang of ['es', 'en']) {
        const text = opening[lang];
        await render(card({
            eyebrow: `${TEXT[lang].eyebrow} · ${opening.eco}`,
            title: text.name,
            body: text.description,
            fen: game.fen(),
            flipped: opening.side === 'b',
            lang,
        }), `${index}-${lang}.png`);
    }
}

console.log(`og: ${2 + schedule.length * 2} images in ${((Date.now() - started) / 1000).toFixed(1)}s`);
