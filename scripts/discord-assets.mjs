// Renders the Discord app's artwork into docs/discord/ (uploaded by hand in the Developer Portal):
//   app-icon.png  1024×1024, the knight on the dark club green (Discord crops it to a circle)
//   banner.png    680×240 bot profile banner (the avatar covers its bottom-left corner)
//
//   node scripts/discord-assets.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultPieces } from 'react-chessboard';
import { Chess } from 'chess.js';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const OUT = 'docs/discord';
const COLORS = { night: '#0e1815', club: '#1f3a30', brass: '#d4b37a', ivory: '#efe6d0', muted: '#a2aca4', light: '#ecdfc7', dark: '#a47e56', mate: '#d0765c' };

const font = (pkg, file) => readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`);
const fonts = [
    { name: 'Fraunces', weight: 600, data: font('fraunces', 'fraunces-latin-600-normal.woff') },
    { name: 'Inter', weight: 400, data: font('inter', 'inter-latin-400-normal.woff') },
    { name: 'Inter', weight: 700, data: font('inter', 'inter-latin-700-normal.woff') },
];

const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat() } });

const knightPath = readFileSync('public/favicon.svg', 'utf8').match(/ d="([^"]+)"/)[1];
const knight = (from, to) => `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 200"><defs><linearGradient id="k" x1="0" y1="0" x2="1" y2="0.35"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><path fill="url(#k)" d="${knightPath}"/></svg>`,
).toString('base64')}`;

const pieceImages = Object.fromEntries(
    Object.entries(defaultPieces).map(([type, render]) => {
        const svg = renderToStaticMarkup(render({ svgStyle: { width: '100%', height: '100%' } }))
            .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        return [type, `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`];
    }),
);

/** A wooden board; `highlight` squares get the mate colour. */
function board(fen, size, highlight = []) {
    const squares = new Chess(fen).board();
    const cell = size / 8;
    return h('div', { flexDirection: 'column', padding: size * 0.035, borderRadius: size * 0.05, background: 'linear-gradient(145deg, #6b4b2e, #3f2a19)', boxShadow: '0 18px 40px rgba(0,0,0,0.45)' },
        h('div', { flexDirection: 'column', borderRadius: size * 0.015, overflow: 'hidden' },
            squares.map((row, r) => h('div', {}, row.map((piece, c) => {
                const square = `${'abcdefgh'[c]}${8 - r}`;
                const base = (r + c) % 2 ? COLORS.dark : COLORS.light;
                return h('div', { width: cell, height: cell, background: highlight.includes(square) ? COLORS.mate : base, alignItems: 'center', justifyContent: 'center' },
                    piece ? [{ type: 'img', props: { src: pieceImages[`${piece.color}${piece.type.toUpperCase()}`], width: cell * 0.92, height: cell * 0.92 } }] : []);
            })))));
}

async function render(node, width, height, scale, file) {
    const svg = await satori(node, { width, height, fonts });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: width * scale } }).render().asPng();
    await sharp(png).resize(width, height).png({ compressionLevel: 9 }).toFile(`${OUT}/${file}`);
    console.log(`${OUT}/${file}`);
}

mkdirSync(OUT, { recursive: true });

// Icon: the knight in brass and ivory, inside the circle Discord crops to.
await render(
    h('div', { width: 1024, height: 1024, alignItems: 'center', justifyContent: 'center', background: `radial-gradient(circle at 50% 42%, ${COLORS.club}, ${COLORS.night} 75%)` },
        { type: 'img', props: { src: knight(COLORS.brass, COLORS.ivory), width: 462, height: 660, style: { marginLeft: 20 } } }),
    1024, 1024, 1, 'app-icon.png',
);

// Banner: title and pitch on the left (clear of the avatar in the bottom-left), a mated board on the right.
// Scholar's mate, Qxf7#: the most famous tactic there is.
const MATE_FEN = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
await render(
    h('div', { width: 680, height: 240, background: `radial-gradient(circle at 78% 50%, ${COLORS.club}, ${COLORS.night} 70%)`, position: 'relative', overflow: 'hidden' },
        // Faint pixel knight watermark behind the board.
        { type: 'img', props: { src: knight(`${COLORS.brass}18`, `${COLORS.ivory}0c`), width: 210, height: 300, style: { position: 'absolute', left: 330, top: -30 } } },
        // Everything readable sits in the top 60%: Discord puts the avatar over the bottom-left.
        h('div', { position: 'absolute', left: 32, top: 26, flexDirection: 'column', width: 400 },
            h('div', { alignItems: 'center', gap: 10 },
                { type: 'img', props: { src: knight(COLORS.brass, COLORS.ivory), width: 20, height: 28 } },
                h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 12, letterSpacing: 2.6, color: COLORS.brass }, 'CHESSBITZ · CHESS'),
            ),
            h('div', { fontFamily: 'Fraunces', fontWeight: 600, fontSize: 42, lineHeight: 1.02, color: COLORS.ivory, marginTop: 10, letterSpacing: -0.5 }, 'Tactics battle'),
            h('div', { fontFamily: 'Inter', fontWeight: 400, fontSize: 15, lineHeight: 1.4, color: COLORS.muted, marginTop: 10, width: 360 },
                'The same Lichess puzzles against the clock, for 2\u00a0to\u00a04 players, with a rematch every day.'),
        ),
        h('div', { position: 'absolute', right: 34, top: 26, transform: 'rotate(-4deg)' }, board(MATE_FEN, 180, ['f7'])),
    ),
    680, 240, 3, 'banner.png',
);
