/*
 * The daily battle hour: one fixed hour (21:00 in Madrid, where most players are)
 * when everyone is told to come and look for a public match, so that, with little
 * traffic, people meet at the same time. During it the queue waits longer before
 * handing out a recorded rival, since someone is more likely to turn up.
 */

/** Hour of the day, in Madrid, when the battle hour starts. */
export const BATTLE_HOUR = 21;
export const BATTLE_HOUR_MS = 60 * 60_000;

const MADRID = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
});

/** Milliseconds Madrid is ahead of UTC at `time` (one or two hours). */
function madridOffset(time: number): number {
    const parts = Object.fromEntries(MADRID.formatToParts(new Date(time)).map(p => [p.type, Number(p.value)]));
    const local = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
    return local - Math.floor(time / 60_000) * 60_000;
}

/** When the battle hour starts on the Madrid calendar day `daysAhead` after the one of `time`. */
function startOnDay(time: number, daysAhead: number): number {
    const parts = Object.fromEntries(MADRID.formatToParts(new Date(time)).map(p => [p.type, Number(p.value)]));
    const local = Date.UTC(parts.year, parts.month - 1, parts.day + daysAhead, BATTLE_HOUR, 0);
    // The offset of that evening (clocks change at night, so judging it a day away is safe).
    return local - madridOffset(local - madridOffset(time));
}

export interface BattleHourWindow {
    start: number;
    end: number;
    /** It is on right now. */
    live: boolean;
}

/** The battle hour that is on now, or the next one. */
export function battleHour(now: number): BattleHourWindow {
    let start = startOnDay(now, 0);
    if (now >= start + BATTLE_HOUR_MS) start = startOnDay(now, 1);
    return { start, end: start + BATTLE_HOUR_MS, live: now >= start && now < start + BATTLE_HOUR_MS };
}
