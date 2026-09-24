// Renders the Discord app's artwork into public/media/discord/ (uploaded by hand in the Developer Portal):
//   app-icon.png  1024×1024, the knight on the dark club green (Discord crops it to a circle)
//   banner.png    680×240 bot profile banner (the avatar covers its bottom-left corner)
//   cover.png     1024×576 16:9 banner (Activity cover art)
//   presence/*.png 1024×1024 Rich Presence art (Portal → Rich Presence → Art Assets; the file
//                 name is the asset key): the large image shared by the table and small ones per player
//
//   node scripts/discord-assets.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Hourglass, Trophy } from 'lucide-react';
import { defaultPieces } from 'react-chessboard';
import { Chess } from 'chess.js';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const OUT = 'public/media/discord';
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

// Banner: everything readable in the centre. Discord crops it differently everywhere: the app
// page shows only a wide middle band (top and bottom cut), the Discover card cuts the sides and
// puts the icon over the bottom-left. Safe zone ≈ x 60–620, y 50–190; the boards at the edges
// are decoration and may be cut. Scholar's mate, Qxf7#: the most famous tactic there is.
const MATE_FEN = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
await render(
    h('div', { width: 680, height: 240, background: `radial-gradient(ellipse at 50% 45%, ${COLORS.club} 0%, #13221d 55%, ${COLORS.night} 100%)`, position: 'relative', overflow: 'hidden' },
        h('div', { position: 'absolute', left: -46, top: 118, transform: 'rotate(-10deg)', opacity: 0.55 }, board(MATE_FEN, 140, ['f7'])),
        h('div', { position: 'absolute', left: 566, top: -34, transform: 'rotate(8deg)' }, board(MATE_FEN, 156, ['f7'])),
        h('div', { position: 'absolute', left: 110, top: 58, width: 460, flexDirection: 'column', alignItems: 'center', gap: 8 },
            h('div', { alignItems: 'center', gap: 9 },
                { type: 'img', props: { src: knight(COLORS.brass, COLORS.ivory), width: 16, height: 23 } },
                h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 11, letterSpacing: 2.6, color: COLORS.brass }, 'CHESSBITZ · CHESS'),
            ),
            h('div', { fontFamily: 'Fraunces', fontWeight: 600, fontSize: 50, lineHeight: 1, color: COLORS.ivory, letterSpacing: -0.5 }, 'Tactics battle'),
            h('div', { fontFamily: 'Inter', fontWeight: 400, fontSize: 15, lineHeight: 1.4, color: '#b8c1b9', marginTop: 2 }, 'Race your friends through real chess puzzles.'),
        ),
    ),
    680, 240, 3, 'banner.png',
);

// Cover: the 16:9 banner (1024×576). The pitch on the left, the game on the right: the same
// scholar's mate and a live standings card like the Activity's (the players of media-*.png).
const STANDINGS = [['Leo', '#2e7563', 380], ['Ana', '#b5842f', 258], ['Maya', '#4a6aa3', 233], ['Sam', '#9c4a66', 176]];
const DOTS = { clean: '#5fbf7a', slow: '#e0b64a', next: COLORS.ivory, todo: '#2a3a34' };
const progress = [['clean', 'clean', 'slow', 'clean', 'next'], ['clean', 'clean', 'next', 'todo', 'todo'], ['slow', 'clean', 'next', 'todo', 'todo'], ['slow', 'next', 'todo', 'todo', 'todo']];
const chip = text => h('div', { alignItems: 'center', padding: '7px 13px', borderRadius: 999, border: '1px solid rgba(212,179,122,0.35)', background: 'rgba(31,58,48,0.6)', fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: COLORS.ivory }, text);
await render(
    h('div', { width: 1024, height: 576, background: `radial-gradient(ellipse at 62% 45%, ${COLORS.club} 0%, #13221d 50%, ${COLORS.night} 100%)`, position: 'relative', overflow: 'hidden' },
        h('div', { position: 'absolute', left: 612, top: 70, transform: 'rotate(6deg)' }, board(MATE_FEN, 330, ['f7'])),
        h('div', { position: 'absolute', left: 540, top: 326, width: 270, flexDirection: 'column', padding: '14px 16px', gap: 9, borderRadius: 14, border: '1px solid #2c4038', background: '#16231e', boxShadow: '0 20px 44px rgba(0,0,0,0.55)', transform: 'rotate(-3deg)' },
            h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 10, letterSpacing: 2, color: COLORS.brass, marginBottom: 2 }, 'LIVE STANDINGS'),
            STANDINGS.map(([name, color, points], i) => h('div', { alignItems: 'center', gap: 9, fontFamily: 'Inter', fontSize: 14, color: COLORS.ivory },
                h('div', { width: 12, fontWeight: 400, fontSize: 12, color: COLORS.muted }, String(i + 1)),
                h('div', { width: 24, height: 24, borderRadius: 12, background: color, alignItems: 'center', justifyContent: 'center', fontFamily: 'Fraunces', fontWeight: 600, fontSize: 12 }, name[0]),
                h('div', { flexGrow: 1, fontWeight: i === 1 ? 700 : 400 }, name),
                h('div', { gap: 3 }, progress[i].map(state => h('div', { width: 6, height: 12, borderRadius: 3, background: DOTS[state] }))),
                h('div', { width: 62, justifyContent: 'flex-end', alignItems: 'baseline', gap: 3, fontWeight: 700 }, String(points), h('span', { fontWeight: 400, fontSize: 11, color: COLORS.muted }, 'pts')),
            )),
        ),
        h('div', { position: 'absolute', left: 72, top: 0, height: 576, width: 440, flexDirection: 'column', justifyContent: 'center', gap: 14 },
            h('div', { alignItems: 'center', gap: 11 },
                { type: 'img', props: { src: knight(COLORS.brass, COLORS.ivory), width: 21, height: 30 } },
                h('div', { fontFamily: 'Inter', fontWeight: 700, fontSize: 14, letterSpacing: 3.2, color: COLORS.brass }, 'CHESSBITZ · CHESS'),
            ),
            h('div', { flexDirection: 'column', fontFamily: 'Fraunces', fontWeight: 600, fontSize: 78, lineHeight: 0.98, color: COLORS.ivory, letterSpacing: -1 }, h('div', {}, 'Tactics'), h('div', {}, 'battle')),
            h('div', { fontFamily: 'Inter', fontWeight: 400, fontSize: 20, lineHeight: 1.45, color: '#b8c1b9', marginTop: 4 }, 'Race your friends through real chess puzzles, right in the voice channel.'),
            h('div', { gap: 8, marginTop: 10, flexWrap: 'wrap' }, chip('2–4 players'), chip('Lichess puzzles'), chip('Live podium')),
        ),
    ),
    1024, 576, 2, 'cover.png',
);

// Rich Presence art. Shown small on profiles, so bold shapes and little detail.
mkdirSync(`${OUT}/presence`, { recursive: true });
const PRESENCE_BG = `radial-gradient(circle at 50% 42%, ${COLORS.club}, ${COLORS.night} 75%)`;

/** The heart of the scholar's mate (d5–g8): the queen on f7, highlighted, facing the king. */
function mateCloseUp(size) {
    const squares = new Chess(MATE_FEN).board();
    const cell = size / 4;
    const rows = squares.slice(0, 4).map(row => row.slice(3, 7));
    return h('div', { padding: size * 0.05, borderRadius: size * 0.07, background: 'linear-gradient(145deg, #6b4b2e, #3f2a19)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' },
        h('div', { flexDirection: 'column', borderRadius: size * 0.02, overflow: 'hidden' },
            rows.map((row, r) => h('div', {}, row.map((piece, c) => {
                const square = `${'defg'[c]}${8 - r}`;
                const base = (r + c + 3) % 2 ? COLORS.dark : COLORS.light;
                return h('div', { width: cell, height: cell, background: square === 'f7' ? COLORS.mate : base, alignItems: 'center', justifyContent: 'center' },
                    piece ? [{ type: 'img', props: { src: pieceImages[`${piece.color}${piece.type.toUpperCase()}`], width: cell * 0.9, height: cell * 0.9 } }] : []);
            })))));
}

await render(
    h('div', { width: 1024, height: 1024, alignItems: 'center', justifyContent: 'center', background: PRESENCE_BG },
        h('div', { transform: 'rotate(-6deg)' }, mateCloseUp(700))),
    1024, 1024, 1, 'presence/battle.png',
);

const icon = (Icon, color) => `data:image/svg+xml;base64,${Buffer.from(
    renderToStaticMarkup(createElement(Icon, { size: 24, color, strokeWidth: 2 })).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'),
).toString('base64')}`;

/** A round badge: Discord shows small images as circles in the corner of the large one. */
const badge = (fill, content) => h('div', { width: 1024, height: 1024, alignItems: 'center', justifyContent: 'center', borderRadius: 512, background: fill }, content);

const MEDALS = [
    ['rank-1', 'linear-gradient(145deg, #f3d27a, #b8862b)', '#3b2a08'],
    ['rank-2', 'linear-gradient(145deg, #eef0f2, #9aa3ab)', '#2b3136'],
    ['rank-3', 'linear-gradient(145deg, #e8a36a, #9c5a2c)', '#3a1f0c'],
    ['rank-4', `linear-gradient(145deg, #2f5a4a, ${COLORS.club})`, COLORS.ivory],
];
for (const [key, fill, ink] of MEDALS) {
    await render(badge(fill, h('div', { fontFamily: 'Fraunces', fontWeight: 600, fontSize: 620, lineHeight: 1, color: ink, marginTop: -40 }, key.slice(-1))), 1024, 1024, 1, `presence/${key}.png`);
}
await render(badge(PRESENCE_BG, { type: 'img', props: { src: icon(Hourglass, COLORS.brass), width: 560, height: 560 } }), 1024, 1024, 1, 'presence/lobby.png');
await render(badge('linear-gradient(145deg, #f3d27a, #b8862b)', { type: 'img', props: { src: icon(Trophy, '#3b2a08'), width: 560, height: 560 } }), 1024, 1024, 1, 'presence/winner.png');
