// Keeps src/data/schedule.json in sync with src/data/openings/*.json.
// Existing days keep their opening; new openings are appended round-robin
// across families so consecutive days rarely repeat the same opening family.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';

const DIR = 'src/data/openings';
const SCHEDULE = 'src/data/schedule.json';

const families = readdirSync(DIR)
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(file => JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')).map(entry => entry.slug));

const known = new Set(families.flat());
const previous = existsSync(SCHEDULE) ? JSON.parse(readFileSync(SCHEDULE, 'utf8')) : [];
const schedule = previous.filter(slug => known.has(slug));
const scheduled = new Set(schedule);

const queues = families.map(slugs => slugs.filter(slug => !scheduled.has(slug)));
while (queues.some(queue => queue.length)) {
    for (const queue of queues) if (queue.length) schedule.push(queue.shift());
}

writeFileSync(SCHEDULE, JSON.stringify(schedule, null, 2) + '\n');
console.log(`schedule.json: ${schedule.length} openings (${schedule.length - previous.length >= 0 ? '+' : ''}${schedule.length - previous.length})`);
