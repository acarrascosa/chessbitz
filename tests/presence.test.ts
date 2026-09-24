import { describe, expect, it } from 'vitest';
import {
    COUNTDOWN_MS, TRANSITION_MS, createRoom, joinRoom, leaveRoom, playMove, publicRoom, setReady, startMatch,
    type BattleBoard, type Outcome, type Room,
} from '../src/lib/battle';
import { battlePresence } from '../src/lib/presence';

const MATE: BattleBoard = {
    id: 'mate', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    moves: 'g8f6 h5f7', rating: 1100, themes: ['mateIn1'], limit: 30,
};
const T0 = 1_790_000_000_000;
const START = T0 + COUNTDOWN_MS;

const unwrap = (outcome: Outcome): Room => {
    if (!outcome.ok) throw new Error(outcome.error);
    return outcome.room;
};

function table(): Room {
    let room = createRoom('instance-1', T0);
    room = unwrap(joinRoom(room, { id: 'a', token: 'ta', name: 'Ana' }, T0));
    room = unwrap(joinRoom(room, { id: 'b', token: 'tb', name: 'Bea' }, T0));
    return unwrap(setReady(room, 'b', true, T0));
}

const started = () => unwrap(startMatch(table(), 'a', [MATE, { ...MATE, id: 'mate-2' }], T0));
const presence = (room: Room, you: string, lang: 'es' | 'en' = 'es') => battlePresence(publicRoom(room), you, lang);

describe('battle presence', () => {
    it('shows the table with its party, so friends can ask to join', () => {
        expect(presence(table(), 'a')).toEqual({
            type: 0,
            details: 'Batalla · Normal',
            state: 'En la mesa',
            assets: { large_image: 'battle', large_text: 'Batalla · Normal', small_image: 'lobby', small_text: 'Esperando a empezar' },
            party: { id: 'instance-1', size: [2, 4] },
        });
    });

    it('follows the board, the place and the points during the match, without a party', () => {
        const room = unwrap(playMove(started(), 'a', 0, 'h5', 'f7', START + 6_000));
        const ana = presence(room, 'a')!;
        expect(ana).toMatchObject({ details: 'Tablero 2 de 2', state: '1.º · 140 pts', timestamps: { start: Math.floor(START / 1000) } });
        expect(ana.assets).toMatchObject({ small_image: 'rank-1', small_text: '1.º de 2' });
        expect(ana.party).toBeUndefined();
        // Level on points at the start: both are 1st.
        expect(presence(started(), 'b')).toMatchObject({ state: '1.º · 0 pts', assets: { small_image: 'rank-1' } });
        expect(presence(room, 'b')).toMatchObject({ details: 'Tablero 1 de 2', state: '2.º · 0 pts', assets: { small_image: 'rank-2' } });
    });

    it('says when the boards are done and the player waits for the others', () => {
        let room = unwrap(playMove(started(), 'a', 0, 'h5', 'f7', START + 1_000));
        room = unwrap(playMove(room, 'a', 1, 'h5', 'f7', START + 1_000 + TRANSITION_MS + 1_000));
        expect(presence(room, 'a')).toMatchObject({ details: 'Tableros terminados', state: expect.stringMatching(/^\d+ pts · esperando$/) });
        expect(presence(leaveRoom(started(), 'b', START + 1), 'b')).toMatchObject({ details: 'Tableros terminados' });
    });

    it('crowns the winner on the podium, in English too', () => {
        let room = unwrap(playMove(started(), 'a', 0, 'h5', 'f7', START + 1_000));
        room = unwrap(playMove(room, 'a', 1, 'h5', 'f7', START + 1_000 + TRANSITION_MS + 1_000));
        room = leaveRoom(room, 'b', START + 5_000);
        expect(room.status).toBe('finished');
        expect(presence(room, 'a', 'en')).toMatchObject({ details: 'Won the battle', assets: { small_image: 'winner', small_text: '1st of 2' } });
        expect(presence(room, 'b', 'en')).toMatchObject({ details: '2nd of 2', state: '0 pts', assets: { small_image: 'rank-2' } });
    });

    it('keeps every line short enough for one line on a profile', () => {
        const rooms = [table(), started()];
        for (const room of rooms) {
            for (const lang of ['es', 'en'] as const) {
                const activity = presence(room, 'a', lang)!;
                for (const text of [activity.details, activity.state, activity.assets.large_text, activity.assets.small_text]) {
                    expect(text.length).toBeLessThanOrEqual(28);
                }
            }
        }
        expect(presence(table(), 'nobody')).toBeNull();
    });
});
