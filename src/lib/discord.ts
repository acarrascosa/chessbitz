import { outcomeEmoji, rankPlayers, type Room } from './battle';

/*
 * Chessbitz as a Discord Activity: the texts the bot posts in the channel where a
 * battle was played, and which channels get a reminder the day after. Pure, so
 * the Worker (worker/discord.ts) and the tests share it.
 */

export type DiscordLang = 'es' | 'en';

/** custom_id of the button that launches the Activity from a message. */
export const PLAY_BUTTON_ID = 'battle:play';
/** Channels that haven't played for this long are forgotten. */
export const FORGET_AFTER_DAYS = 30;

const DAY_MS = 86_400_000;
/** Days since the Unix epoch in UTC: "yesterday" for reminders is today − 1. */
export const utcDay = (ms: number) => Math.floor(ms / DAY_MS);

const TEXT = {
    es: {
        title: '⚔️ **Batalla de tácticas**',
        formats: { short: 'Corta', normal: 'Normal', long: 'Larga' },
        boards: (n: number) => `${n} ${n === 1 ? 'tablero' : 'tableros'}`,
        pts: 'pts',
        left: 'abandonó',
        outro: 'Mañana os aviso para la revancha.',
        rematch: 'Revancha',
        play: 'Jugar',
        reminder: (winner: string, points: number) => `♟️ **Nuevo día, nueva batalla.** Ayer ganó ${winner} con ${points} puntos.`,
        reminderNoWinner: '♟️ **Nuevo día, nueva batalla.** Ayer nadie resolvió ningún tablero.',
        reminderCall: (players: string) => `${players}, ¿revancha?`,
        notInDiscord: 'Este botón abre la batalla en Discord.',
    },
    en: {
        title: '⚔️ **Tactics battle**',
        formats: { short: 'Short', normal: 'Normal', long: 'Long' },
        boards: (n: number) => `${n} ${n === 1 ? 'board' : 'boards'}`,
        pts: 'pts',
        left: 'left',
        outro: "I'll remind you tomorrow for the rematch.",
        rematch: 'Rematch',
        play: 'Play',
        reminder: (winner: string, points: number) => `♟️ **New day, new battle.** Yesterday ${winner} won with ${points} points.`,
        reminderNoWinner: '♟️ **New day, new battle.** Nobody solved a board yesterday.',
        reminderCall: (players: string) => `${players}, rematch?`,
        notInDiscord: 'This button opens the battle in Discord.',
    },
} as const;

export const discordText = (lang: DiscordLang) => TEXT[lang];

/** Names are shown as typed: Discord markdown in them is escaped. */
export const escapeMarkdown = (text: string) => text.replace(/([\\*_~`|>#[\]()-])/g, '\\$1');

const mention = (player: { discordId?: string; name: string }) =>
    player.discordId ? `<@${player.discordId}>` : escapeMarkdown(player.name);

const MEDALS = ['🥇', '🥈', '🥉'];

/** A message payload for POST /channels/{id}/messages. */
export interface DiscordMessage {
    content: string;
    allowed_mentions: { parse: []; users: string[] };
    components: unknown[];
}

function playButton(label: string) {
    // Action row with one button; clicking it launches the Activity (interaction response type 12).
    return [{ type: 1, components: [{ type: 2, style: 1, custom_id: PLAY_BUTTON_ID, label, emoji: { name: '⚔️' } }] }];
}

/** The podium posted in the channel when a match ends. */
export function resultsMessage(room: Room, lang: DiscordLang): DiscordMessage {
    const t = TEXT[lang];
    const ranking = rankPlayers(room.players);
    const lines = ranking.map((s, rank) => {
        const player = room.players.find(p => p.id === s.id)!;
        const points = rank === 0 ? `**${s.points}**` : String(s.points);
        const left = player.left ? ` · _${t.left}_` : '';
        return `${MEDALS[rank] ?? `${rank + 1}.`} ${mention(player)} — ${points} ${t.pts} · ${player.results.map(outcomeEmoji).join('')}${left}`;
    });
    const header = `${t.title} · ${t.formats[room.format]} · ${t.boards(room.boards.length)}`;
    return {
        content: [header, ...lines, '', t.outro].join('\n'),
        allowed_mentions: { parse: [], users: room.players.flatMap(p => (p.discordId ? [p.discordId] : [])) },
        components: playButton(t.rematch),
    };
}

/** What the Worker remembers about the last battle played in a channel. */
export interface ChannelBattle {
    channel_id: string;
    guild_id: string | null;
    lang: DiscordLang;
    /** UTC day of the last match. */
    day: number;
    winner_id: string | null;
    winner_name: string;
    winner_points: number;
    /** JSON array of the players' Discord ids. */
    players: string;
    reminded_day: number | null;
}

/** The row stored when a match ends, for tomorrow's reminder. */
export function channelBattle(room: Room, now: number): ChannelBattle | null {
    if (!room.discord) return null;
    const [winner] = rankPlayers(room.players);
    const winnerPlayer = room.players.find(p => p.id === winner?.id);
    return {
        channel_id: room.discord.channelId,
        guild_id: room.discord.guildId,
        lang: room.discord.lang,
        day: utcDay(now),
        winner_id: winnerPlayer?.discordId ?? null,
        winner_name: winner?.name ?? '',
        winner_points: winner?.points ?? 0,
        players: JSON.stringify(room.players.flatMap(p => (p.discordId ? [p.discordId] : []))),
        reminded_day: null,
    };
}

/** Channels that played yesterday, haven't played today and weren't reminded yet. */
export function dueReminders(rows: ChannelBattle[], today: number): ChannelBattle[] {
    return rows.filter(row => row.day === today - 1 && (row.reminded_day ?? -1) < today);
}

export function reminderMessage(row: ChannelBattle, lang: DiscordLang = row.lang): DiscordMessage {
    const t = TEXT[lang];
    let players: string[] = [];
    try {
        const parsed: unknown = JSON.parse(row.players);
        if (Array.isArray(parsed)) players = parsed.filter((id): id is string => typeof id === 'string' && /^\d{1,20}$/.test(id));
    } catch {
        // A malformed row just skips the mentions.
    }
    const winner = row.winner_id ? `<@${row.winner_id}>` : escapeMarkdown(row.winner_name);
    const lines = [row.winner_points > 0 ? t.reminder(winner, row.winner_points) : t.reminderNoWinner];
    if (players.length) lines.push(t.reminderCall(players.map(id => `<@${id}>`).join(' ')));
    return {
        content: lines.join('\n'),
        allowed_mentions: { parse: [], users: [...new Set([...players, ...(row.winner_id ? [row.winner_id] : [])])] },
        components: playButton(t.play),
    };
}

/** Discord passes these on the Activity URL; outside Discord they're absent. */
export function isDiscordLaunch(search: string): boolean {
    const params = new URLSearchParams(search);
    return params.has('frame_id') && params.has('instance_id');
}

export const discordLang = (locale: string | undefined): DiscordLang => (locale?.toLowerCase().startsWith('es') ? 'es' : 'en');
