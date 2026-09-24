import { MAX_PLAYERS, rankPlayers, type PublicRoom } from './battle';
import type { DiscordLang } from './discord';

/*
 * Discord Rich Presence for the battle Activity: what a player's profile says while
 * they play. Short snippets rather than sentences, one line each, following Discord's
 * best practices; the large image is the same for the whole table and the small one
 * shows the player's own place. Images are the art assets uploaded in the Developer
 * Portal under these keys (scripts/discord-assets.mjs renders them).
 */

export const PRESENCE_ASSETS = {
    large: 'battle',
    lobby: 'lobby',
    winner: 'winner',
    rank: (place: number) => `rank-${Math.min(place, MAX_PLAYERS)}`,
} as const;

/** The fields of Discord's activity object that setActivity takes and we use. */
export interface PresenceActivity {
    type: 0;
    details: string;
    state: string;
    assets: { large_image: string; large_text: string; small_image: string; small_text: string };
    /** Only at the table, where others can still join: Discord shows "(2 of 4)" and Ask to Join. */
    party?: { id: string; size: [number, number] };
    /** Unix seconds: Discord shows the time elapsed since the match started. */
    timestamps?: { start: number };
}

const TEXT = {
    es: {
        battle: 'Batalla',
        formats: { short: 'Corta', normal: 'Normal', long: 'Larga' },
        atTable: 'En la mesa',
        waitingStart: 'Esperando a empezar',
        board: (i: number, n: number) => `Tablero ${i} de ${n}`,
        place: (n: number) => `${n}.º`,
        of: (place: string, n: number) => `${place} de ${n}`,
        done: 'Tableros terminados',
        waiting: 'esperando',
        won: 'Ganó la batalla',
    },
    en: {
        battle: 'Battle',
        formats: { short: 'Short', normal: 'Normal', long: 'Long' },
        atTable: 'At the table',
        waitingStart: 'Waiting to start',
        board: (i: number, n: number) => `Board ${i} of ${n}`,
        place: (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`,
        of: (place: string, n: number) => `${place} of ${n}`,
        done: 'All boards done',
        waiting: 'waiting',
        won: 'Won the battle',
    },
} as const;

/** What the player's profile shows for this state of the table, or null when they aren't seated. */
export function battlePresence(room: PublicRoom, you: string, lang: DiscordLang): PresenceActivity | null {
    const t = TEXT[lang];
    const me = room.players.find(p => p.id === you);
    if (!me) return null;
    const match = `${t.battle} · ${t.formats[room.format]}`;
    const large = { large_image: PRESENCE_ASSETS.large, large_text: match };

    if (room.status === 'lobby') {
        return {
            type: 0,
            details: match,
            state: t.atTable,
            assets: { ...large, small_image: PRESENCE_ASSETS.lobby, small_text: t.waitingStart },
            party: { id: room.code, size: [room.players.length, MAX_PLAYERS] },
        };
    }

    const ranking = rankPlayers(room.players.map(p => ({ ...p, token: '' })));
    const index = ranking.findIndex(s => s.id === you);
    const mine = ranking[index].points;
    // During the match players level on points share a place (everyone is 1st at the start);
    // the podium uses the full tie-breaks.
    const place = room.status === 'finished' ? index + 1 : 1 + ranking.filter(s => s.points > mine).length;
    const points = `${mine} pts`;
    const ordinal = t.of(t.place(place), room.players.length);
    const timestamps = { start: Math.floor(room.startsAt / 1000) };

    if (room.status === 'finished') {
        const winner = place === 1;
        return {
            type: 0,
            details: winner ? t.won : ordinal,
            state: points,
            assets: { ...large, small_image: winner ? PRESENCE_ASSETS.winner : PRESENCE_ASSETS.rank(place), small_text: ordinal },
        };
    }

    const done = me.left || me.board >= room.boards.length;
    return {
        type: 0,
        details: done ? t.done : t.board(me.board + 1, room.boards.length),
        state: done ? `${points} · ${t.waiting}` : `${t.place(place)} · ${points}`,
        assets: { ...large, small_image: PRESENCE_ASSETS.rank(place), small_text: ordinal },
        timestamps,
    };
}
