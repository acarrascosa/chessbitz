// Build-time only: bundles every opening. Never import from client components.
import schedule from '../data/schedule.json';
import puzzles from '../data/puzzles.json';
import type { Puzzle } from './puzzle';
import type { Opening, OpeningEntry } from './openings';

const files = import.meta.glob<OpeningEntry[]>('../data/openings/*.json', { eager: true, import: 'default' });

export const openings: Opening[] = Object.entries(files).flatMap(([path, entries]) => {
    const family = path.split('/').pop()!.replace(/\.json$/, '');
    return entries.map(entry => ({ ...entry, family, puzzles: (puzzles as Record<string, Puzzle[]>)[entry.slug] ?? [] }));
});

const bySlug = new Map(openings.map(opening => [opening.slug, opening]));

/** Openings in daily rotation order. */
export const scheduledOpenings: Opening[] = (schedule as string[]).map(slug => {
    const opening = bySlug.get(slug);
    if (!opening) throw new Error(`schedule.json references unknown opening "${slug}"`);
    return opening;
});
