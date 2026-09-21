// Build-time only: bundles every opening. Never import from client components.
import schedule from '../data/schedule.json';
import type { Opening, OpeningEntry } from './openings';

const files = import.meta.glob<OpeningEntry[]>('../data/openings/*.json', { eager: true, import: 'default' });

export const openings: Opening[] = Object.entries(files).flatMap(([path, entries]) => {
    const family = path.split('/').pop()!.replace(/\.json$/, '');
    return entries.map(entry => ({ ...entry, family }));
});

const bySlug = new Map(openings.map(opening => [opening.slug, opening]));

/** Openings in daily rotation order. */
export const scheduledOpenings: Opening[] = (schedule as string[]).map(slug => {
    const opening = bySlug.get(slug);
    if (!opening) throw new Error(`schedule.json references unknown opening "${slug}"`);
    return opening;
});
