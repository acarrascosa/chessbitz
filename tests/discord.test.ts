import { describe, expect, it } from 'vitest';
import {
    COUNTDOWN_MS, TRANSITION_MS, createRoom, joinRoom, leaveRoom, playMove, setReady, startMatch,
    type BattleBoard, type Outcome, type Room,
} from '../src/lib/battle';
import {
    PLAY_BUTTON_ID, channelBattle, discordLang, dueReminders, escapeMarkdown, isDiscordLaunch, reminderMessage, resultsMessage, utcDay,
    type ChannelBattle,
} from '../src/lib/discord';
import { readSession, signSession, verifyInteraction } from '../worker/discord';

const MATE: BattleBoard = {
    id: 'mate', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
    moves: 'g8f6 h5f7', rating: 1100, themes: ['mateIn1'], limit: 30,
};
const T0 = Date.UTC(2026, 8, 23, 18);
const START = T0 + COUNTDOWN_MS;

const unwrap = (outcome: Outcome): Room => {
    if (!outcome.ok) throw new Error(outcome.error);
    return outcome.room;
};

/** A finished Discord match: Ana solves both boards, Bea one with a mistake, Cris leaves. */
function finishedMatch(): Room {
    let room: Room = { ...createRoom('instance-1', T0), discord: { instanceId: 'instance-1', channelId: '111', guildId: '222', lang: 'es' } };
    room = unwrap(joinRoom(room, { id: 'a', token: 'discord:1', name: 'Ana', discordId: '1' }, T0));
    room = unwrap(joinRoom(room, { id: 'b', token: 'discord:2', name: 'Bea_*', discordId: '2' }, T0));
    room = unwrap(joinRoom(room, { id: 'c', token: 'discord:3', name: 'Cris', discordId: '3' }, T0));
    room = unwrap(setReady(room, 'b', true, T0));
    room = unwrap(setReady(room, 'c', true, T0));
    room = unwrap(startMatch(room, 'a', [MATE, { ...MATE, id: 'mate-2' }], T0));
    room = leaveRoom(room, 'c', START + 1);
    room = unwrap(playMove(room, 'a', 0, 'h5', 'f7', START + 3_000));
    room = unwrap(playMove(room, 'a', 1, 'h5', 'f7', START + 3_000 + TRANSITION_MS + 3_000));
    room = unwrap(playMove(room, 'b', 0, 'h5', 'h6', START + 1_000));
    room = unwrap(playMove(room, 'b', 0, 'h5', 'f7', START + 2_000));
    return room;
}

describe('channel messages', () => {
    it('posts the podium with mentions, grids and a rematch button', () => {
        let room = finishedMatch();
        room = unwrap(playMove(room, 'b', 1, 'h5', 'f7', START + 2_000 + TRANSITION_MS + 20_000));
        expect(room.status).toBe('finished');
        const message = resultsMessage(room, 'es');
        const lines = message.content.split('\n');
        expect(lines[0]).toBe('⚔️ **Batalla de tácticas** · Normal · 2 tableros');
        expect(lines[1]).toMatch(/^🥇 <@1> — \*\*\d+\*\* pts · 🟩🟩$/);
        expect(lines[2]).toMatch(/^🥈 <@2> — \d+ pts · 🟨🟩$/);
        expect(lines[3]).toBe('🥉 <@3> — 0 pts · ⏱️⏱️ · _abandonó_');
        expect(message.allowed_mentions).toEqual({ parse: [], users: ['1', '2', '3'] });
        expect(message.components).toEqual([{ type: 1, components: [expect.objectContaining({ type: 2, custom_id: PLAY_BUTTON_ID, label: 'Revancha' })] }]);
        expect(resultsMessage(room, 'en').content).toContain('Tactics battle');
    });

    it('escapes Discord markdown in names shown without a mention', () => {
        expect(escapeMarkdown('Bea_*')).toBe('Bea\\_\\*');
    });
});

describe('reminders', () => {
    const row = (changes: Partial<ChannelBattle>): ChannelBattle => ({
        channel_id: '111', guild_id: '222', lang: 'es', day: 100, winner_id: '1', winner_name: 'Ana', winner_points: 284,
        players: '["1","2"]', reminded_day: null, ...changes,
    });

    it('remembers who played, including those who left, and who won', () => {
        const stored = channelBattle(finishedMatch(), T0)!;
        expect(stored).toMatchObject({ channel_id: '111', guild_id: '222', lang: 'es', day: utcDay(T0), winner_id: '1', winner_name: 'Ana', reminded_day: null });
        expect(JSON.parse(stored.players)).toEqual(['1', '2', '3']);
        expect(channelBattle(createRoom('ABCD', T0), T0)).toBeNull();
    });

    it('reminds only the channels that played yesterday, once', () => {
        const rows = [row({ channel_id: 'yesterday' }), row({ channel_id: 'today', day: 101 }), row({ channel_id: 'old', day: 98 }), row({ channel_id: 'done', reminded_day: 101 })];
        expect(dueReminders(rows, 101).map(r => r.channel_id)).toEqual(['yesterday']);
    });

    it('mentions yesterday\'s players and offers to play', () => {
        const message = reminderMessage(row({}));
        expect(message.content).toBe('♟️ **Nuevo día, nueva batalla.** Ayer ganó <@1> con 284 puntos.\n<@1> <@2>, ¿revancha?');
        expect(message.allowed_mentions.users).toEqual(['1', '2']);
        expect(JSON.stringify(message.components)).toContain(PLAY_BUTTON_ID);
    });

    it('never mentions anything but user ids stored as digits', () => {
        const message = reminderMessage(row({ players: '["1","@everyone","<@&9>"]', winner_id: null, winner_name: '**X**' }));
        expect(message.content).toContain('Ayer ganó \\*\\*X\\*\\*');
        expect(message.allowed_mentions).toEqual({ parse: [], users: ['1'] });
        expect(reminderMessage(row({ players: 'not json' })).content).not.toContain('revancha');
        expect(reminderMessage(row({ winner_points: 0 })).content).toContain('Ayer nadie resolvió ningún tablero.');
    });
});

describe('launch', () => {
    it('recognises the Activity URL and the player\'s language', () => {
        expect(isDiscordLaunch('?instance_id=i-1&frame_id=f&platform=desktop')).toBe(true);
        expect(isDiscordLaunch('?mesa=ABCD')).toBe(false);
        expect(discordLang('es-ES')).toBe('es');
        expect(discordLang('en-US')).toBe('en');
        expect(discordLang(undefined)).toBe('en');
    });
});

describe('worker security', () => {
    it('signs sessions and rejects tampered or expired ones', async () => {
        const token = await signSession({ uid: '1', name: 'Ana', exp: 2_000 }, 'secret');
        expect(await readSession(token, 'secret', 1_000)).toEqual({ uid: '1', name: 'Ana', exp: 2_000 });
        expect(await readSession(token, 'secret', 3_000)).toBeNull();
        expect(await readSession(token, 'other secret', 1_000)).toBeNull();
        const [, signature] = token.split('.');
        const forged = `${Buffer.from(JSON.stringify({ uid: '2', name: 'Eve', exp: 2_000 })).toString('base64url')}.${signature}`;
        expect(await readSession(forged, 'secret', 1_000)).toBeNull();
        expect(await readSession('garbage', 'secret', 1_000)).toBeNull();
    });

    it('verifies interaction signatures like Discord sends them', async () => {
        const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']) as CryptoKeyPair;
        const hex = (bytes: ArrayBuffer) => Buffer.from(bytes).toString('hex');
        const publicKey = hex(await crypto.subtle.exportKey('raw', keys.publicKey));
        const body = '{"type":1}';
        const timestamp = '1790000000';
        const signature = hex(await crypto.subtle.sign('Ed25519', keys.privateKey, new TextEncoder().encode(timestamp + body)));
        expect(await verifyInteraction(publicKey, signature, timestamp, body)).toBe(true);
        expect(await verifyInteraction(publicKey, signature, timestamp, '{"type":2}')).toBe(false);
        expect(await verifyInteraction(publicKey, 'zz', timestamp, body)).toBe(false);
    });
});
