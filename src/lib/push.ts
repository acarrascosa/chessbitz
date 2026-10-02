/*
 * Web Push notifications people can opt into. Each topic has its message (in the
 * subscriber's language), where a click takes them, and how long it's worth
 * delivering: "someone is searching" is stale in minutes, a daily reminder isn't.
 */

export const PUSH_TOPICS = ['daily', 'battle', 'match'] as const;
export type PushTopic = (typeof PUSH_TOPICS)[number];

export interface PushMessage {
    title: string;
    body: string;
    /** Opened on click. */
    url: string;
    /** Notifications with the same tag replace each other. */
    tag: string;
    /** Seconds the push service keeps it for an offline device. */
    ttl: number;
}

const TEXT = {
    es: {
        daily: { title: 'Tu apertura de hoy te espera', body: 'Un reto nuevo, unas pocas jugadas. ¿Mantienes la racha?' },
        battle: { title: '¡Hora de batalla!', body: 'Ahora es cuando más gente busca partida pública. ¿Te apuntas?' },
        match: { title: 'Alguien busca rival', body: 'Hay una persona buscando partida en Chessbitz ahora mismo.' },
    },
    en: {
        daily: { title: 'Today’s opening is waiting', body: 'A new challenge, just a few moves. Keep your streak going?' },
        battle: { title: 'It’s battle hour!', body: 'This is when most people look for a public match. Join in?' },
        match: { title: 'Someone is looking for a rival', body: 'A player is searching for a match on Chessbitz right now.' },
    },
} as const;

const PATHS = {
    es: { daily: '/', battle: '/batalla/?buscar=1', match: '/batalla/?buscar=1' },
    en: { daily: '/en/', battle: '/en/battle/?buscar=1', match: '/en/battle/?buscar=1' },
} as const;

const TTL: Record<PushTopic, number> = { daily: 4 * 3600, battle: 3600, match: 300 };

export function pushText(lang: 'es' | 'en', topic: PushTopic): PushMessage {
    return { ...TEXT[lang][topic], url: PATHS[lang][topic], tag: `chessbitz-${topic}`, ttl: TTL[topic] };
}

/** Someone searching notifies at most this often overall, and each person at most this often. */
export const MATCH_NOTIFY_EVERY_MS = 10 * 60_000;
export const MATCH_NOTIFY_PERSON_MS = 30 * 60_000;
/** Hour of the day in Madrid for the daily reminder (the battle hour has its own, BATTLE_HOUR). */
export const DAILY_REMINDER_HOUR = 20;
