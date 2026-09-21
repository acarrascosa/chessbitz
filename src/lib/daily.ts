const MS_PER_DAY = 86_400_000;

/** Day #0 of the daily rotation (Jan 25, 2026). */
export const LAUNCH_DAY_UTC = Date.UTC(2026, 0, 25);

/**
 * Number of calendar days between the launch and `date`, using the viewer's
 * local calendar. Everyone gets a new opening at their own local midnight,
 * and DST shifts can never skip or repeat a day.
 */
export function getDayNumber(date: Date = new Date()): number {
    const localDayUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.max(0, Math.round((localDayUtc - LAUNCH_DAY_UTC) / MS_PER_DAY));
}

/** Index into a rotation of `count` items for the given day. */
export function getRotationIndex(dayNumber: number, count: number): number {
    if (count <= 0) throw new Error('Rotation must contain at least one item');
    return ((dayNumber % count) + count) % count;
}
