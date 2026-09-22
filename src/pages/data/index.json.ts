import type { APIRoute } from 'astro';
import { scheduledOpenings } from '../../lib/catalog';
import { parseLine } from '../../lib/line';
import { playerPlies } from '../../lib/challenge';
import type { IndexEntry } from '../../lib/openings';

/** Light catalog in schedule order, for the archive list (names only, no content). */
export const GET: APIRoute = () => {
    const index: IndexEntry[] = scheduledOpenings.map(opening => ({
        slug: opening.slug,
        eco: opening.eco,
        side: opening.side,
        family: opening.family,
        moves: playerPlies(parseLine(opening.pgn), opening.side).length,
        es: opening.es.name,
        en: opening.en.name,
    }));
    return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
};
