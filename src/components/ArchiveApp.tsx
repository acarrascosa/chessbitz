import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Search, Shuffle } from 'lucide-react';
import OpeningGame, { type PlayMode } from './OpeningGame';
import { GameSkeleton } from './Stage';
import { LAUNCH_DAY_UTC, getDayNumber, getRotationIndex } from '../lib/daily';
import { INDEX_URL, fetchOpening, type IndexEntry, type Opening } from '../lib/openings';
import { lineDifficulty } from '../lib/puzzle';
import { loadArchive, loadHistory, type Archive, type History } from '../lib/progress';
import type { ChallengeState, PlyResult } from '../lib/challenge';
import type { ExpertState } from '../lib/expert';
import { archivePath, fill, homePath, ui, type Lang } from '../i18n/ui';

interface ArchiveAppProps {
    /** Number of openings in the rotation, known at build time. */
    count: number;
    lang: Lang;
}

const FAMILIES: Record<string, Record<Lang, string>> = {
    'open-games': { es: 'Juegos abiertos', en: 'Open games' },
    'italian': { es: 'Italiana', en: 'Italian' },
    'ruy-lopez': { es: 'Española', en: 'Ruy Lopez' },
    'sicilian': { es: 'Siciliana', en: 'Sicilian' },
    'french': { es: 'Francesa', en: 'French' },
    'caro-kann': { es: 'Caro-Kann', en: 'Caro-Kann' },
    'semi-open': { es: 'Semiabiertas', en: 'Semi-open' },
    'queens-gambit': { es: 'Gambito de Dama', en: "Queen's Gambit" },
    'slav': { es: 'Eslava', en: 'Slav' },
    'nimzo-queens-indian': { es: 'Nimzoindia e India de Dama', en: "Nimzo & Queen's Indian" },
    'kings-indian-grunfeld': { es: 'India de Rey y Grünfeld', en: "King's Indian & Grünfeld" },
    'benoni-dutch': { es: 'Benoni y Holandesa', en: 'Benoni & Dutch' },
    'queen-pawn-systems': { es: 'Sistemas de peón dama', en: "Queen's pawn systems" },
    'english': { es: 'Inglesa', en: 'English' },
    'flank': { es: 'Aperturas de flanco', en: 'Flank openings' },
};

interface Route {
    day?: number;
    mode: PlayMode;
}

function readRoute(today: number): Route & { random: boolean } {
    const params = new URLSearchParams(window.location.search);
    const day = Number(params.get('day'));
    const mode: PlayMode = params.get('mode') === 'expert' ? 'expert' : 'normal';
    const valid = params.has('day') && Number.isInteger(day) && day >= 0 && day < today;
    return { day: valid ? day : undefined, mode, random: params.has('random') };
}

const isStarted = (state?: ChallengeState) => Boolean(state && (state.cursor > 0 || state.mistakes > 0 || state.status !== 'playing'));
const expertStarted = (state?: ExpertState) => Boolean(state && state.attempts.length > 0);

/** A random past day, preferring the ones never played. */
function randomDay(today: number, history: History, archive: Archive): number {
    const days = Array.from({ length: today }, (_, d) => d);
    const fresh = days.filter(d => !history[d] && !isStarted(archive[d]?.normal?.state) && !expertStarted(archive[d]?.expert?.state));
    const pool = fresh.length ? fresh : days;
    return pool[Math.floor(Math.random() * pool.length)];
}

const DOT: Record<PlyResult, string> = { perfect: 'bg-good', assisted: 'bg-warn', revealed: 'bg-bad' };

/** Coloured dots of a finished line, in move order (no plies needed). */
function ResultDots({ state, label }: { state: ChallengeState; label: string }) {
    const results = Object.entries(state.results).sort(([a], [b]) => Number(a) - Number(b)).map(([, r]) => r);
    return (
        <span className="inline-flex items-center gap-1" title={label}>
            <span className="sr-only">{label}</span>
            {results.map((r, i) => <span key={i} className={`w-2 h-2 rounded-full ${DOT[r]}`} aria-hidden="true" />)}
        </span>
    );
}

const ArchiveApp: React.FC<ArchiveAppProps> = ({ count, lang }) => {
    const t = ui[lang];
    const today = useMemo(() => getDayNumber(), []);
    const [route, setRoute] = useState<Route | null>(null);
    const [opening, setOpening] = useState<Opening | null>(null);
    const [error, setError] = useState(false);

    // Resolve the URL once: ?day=N[&mode=expert] or ?random[&mode=expert].
    useEffect(() => {
        const parsed = readRoute(today);
        if (parsed.random && today > 0) {
            const day = randomDay(today, loadHistory(), loadArchive());
            const url = `${archivePath(lang)}?day=${day}${parsed.mode === 'expert' ? '&mode=expert' : ''}`;
            window.history.replaceState(null, '', url);
            setRoute({ day, mode: parsed.mode });
        } else {
            setRoute(parsed);
        }
    }, [today, lang]);

    useEffect(() => {
        if (route?.day === undefined) return;
        let cancelled = false;
        fetchOpening(getRotationIndex(route.day, count))
            .then(o => !cancelled && setOpening(o))
            .catch(() => !cancelled && setError(true));
        return () => {
            cancelled = true;
        };
    }, [route?.day, count]);

    if (error) return <p role="alert" className="py-24 text-center text-ink-muted">{t.loadError}</p>;
    if (!route) return <GameSkeleton label={t.loading} />;
    if (route.day !== undefined) {
        return opening
            ? <OpeningGame key={route.day} day={route.day} opening={opening} lang={lang} variant="archive" initialMode={route.mode} />
            : <GameSkeleton label={t.loading} />;
    }
    return <ArchiveList count={count} lang={lang} today={today} />;
};

type SideFilter = 'all' | 'w' | 'b';

function ArchiveList({ count, lang, today }: { count: number; lang: Lang; today: number }) {
    const t = ui[lang];
    const [index, setIndex] = useState<IndexEntry[] | null>(null);
    const [query, setQuery] = useState('');
    const [sideFilter, setSideFilter] = useState<SideFilter>('all');
    const [family, setFamily] = useState('');
    const history = useMemo(loadHistory, []);
    const archive = useMemo(loadArchive, []);

    useEffect(() => {
        fetch(INDEX_URL).then(r => r.json()).then(setIndex).catch(() => setIndex([]));
    }, []);

    const dateFormat = useMemo(() => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }), [lang]);

    const rows = useMemo(() => {
        if (!index?.length) return [];
        const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const q = normalized(query.trim());
        return Array.from({ length: today + 1 }, (_, i) => today - i)
            .map(day => ({ day, entry: index[getRotationIndex(day, count)] }))
            .filter(({ entry }) => entry
                && (sideFilter === 'all' || entry.side === sideFilter)
                && (!family || entry.family === family)
                && (!q || normalized(`${entry[lang]} ${entry.eco}`).includes(q)));
    }, [index, query, sideFilter, family, today, count, lang]);

    const chip = (active: boolean) =>
        `px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors ${active ? 'bg-brand text-brand-ink border-brand' : 'border-line text-ink-muted hover:text-ink'}`;

    return (
        <section className="w-full max-w-4xl mx-auto space-y-6 animate-rise" aria-labelledby="archive-title">
            <header className="text-center space-y-3">
                <p className="eyebrow">{fill(t.archiveCount, { n: today + 1 })}</p>
                <h1 id="archive-title" className="font-display text-4xl md:text-5xl font-semibold tracking-tight">{t.archiveTitle}</h1>
                <p className="text-ink-muted max-w-xl mx-auto text-balance">{t.archiveDesc}</p>
                {today === 0 && <p className="text-sm font-semibold text-accent">{t.archiveFirstDay}</p>}
                <div className={`flex flex-wrap justify-center gap-2 pt-1 ${today === 0 ? 'hidden' : ''}`}>
                    <a href={`${archivePath(lang)}?random`} className="btn btn-primary px-4 py-2.5 text-sm">
                        <Shuffle size={16} aria-hidden="true" /> {t.archiveRandom}
                    </a>
                    <a href={`${archivePath(lang)}?random&mode=expert`} className="btn btn-quiet px-4 py-2.5 text-sm">
                        <Brain size={16} aria-hidden="true" /> {t.archiveRandom} · {t.modeExpert}
                    </a>
                </div>
            </header>

            <div className="card p-3 flex flex-col md:flex-row gap-2 md:items-center">
                <label className="relative flex-1">
                    <span className="sr-only">{t.archiveSearch}</span>
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={t.archiveSearch}
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-2 border border-line text-sm placeholder:text-ink-muted"
                    />
                </label>
                <div className="flex flex-wrap gap-1.5" role="group">
                    {([['all', t.filterAll], ['w', t.filterWhite], ['b', t.filterBlack]] as [SideFilter, string][]).map(([value, label]) => (
                        <button key={value} onClick={() => setSideFilter(value)} aria-pressed={sideFilter === value} className={chip(sideFilter === value)}>{label}</button>
                    ))}
                </div>
                <label className="md:w-56">
                    <span className="sr-only">{t.archiveFamily}</span>
                    <select value={family} onChange={e => setFamily(e.target.value)} className="w-full h-10 px-3 rounded-xl bg-surface-2 border border-line text-sm">
                        <option value="">{t.archiveAllFamilies}</option>
                        {Object.entries(FAMILIES).map(([key, names]) => <option key={key} value={key}>{names[lang]}</option>)}
                    </select>
                </label>
            </div>

            {index === null ? (
                <div className="card min-h-[85svh] animate-pulse" aria-busy="true" aria-label={t.loading} />
            ) : rows.length === 0 ? (
                <p className="text-center text-ink-muted py-12">{t.archiveEmpty}</p>
            ) : (
                <ol className="card divide-y divide-line overflow-hidden">
                    {rows.map(({ day, entry }) => {
                        const isToday = day === today;
                        const daily = history[day]?.opening === entry.slug ? history[day].state : undefined;
                        const replay = archive[day]?.opening === entry.slug ? archive[day] : undefined;
                        const href = isToday ? homePath(lang) : `${archivePath(lang)}?day=${day}`;
                        return (
                            <li key={day}>
                                <a href={href} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                                    <span className="text-xs text-ink-muted tabular-nums leading-tight">
                                        <span className="block font-bold text-ink">#{day + 1}</span>
                                        {isToday ? t.archiveToday : dateFormat.format(new Date(LAUNCH_DAY_UTC + day * 86_400_000))}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block font-semibold truncate">{entry[lang]}</span>
                                        <span className="block text-xs text-ink-muted">
                                            {entry.eco} · {entry.side === 'w' ? t.filterWhite : t.filterBlack} · {t.difficulty[lineDifficulty(entry.moves)]}
                                        </span>
                                    </span>
                                    <span className="flex flex-col items-end gap-1">
                                        {daily && daily.status !== 'playing' && <ResultDots state={daily} label={`${t.modeChallenge}: ${daily.status === 'won' ? t.dayWon : t.dayLost}`} />}
                                        {replay?.normal && replay.normal.state.status !== 'playing' && (
                                            <ResultDots state={replay.normal.state} label={`${t.archiveTitle}: ${replay.normal.state.status === 'won' ? t.dayWon : t.dayLost}`} />
                                        )}
                                        {replay?.expert && replay.expert.state.status !== 'playing' && (
                                            <span className={`text-[0.65rem] font-bold uppercase tracking-wider ${replay.expert.state.status === 'won' ? 'text-good' : 'text-bad'}`}>
                                                {t.modeExpert} {replay.expert.state.status === 'won' ? `${replay.expert.state.attempts.length}/6` : '✕'}
                                            </span>
                                        )}
                                    </span>
                                </a>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

export default ArchiveApp;
