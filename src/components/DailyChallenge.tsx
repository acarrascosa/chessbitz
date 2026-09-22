import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Swords, BookOpen, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';
import ChallengeMode from './ChallengeMode';
import StudyMode from './StudyMode';
import ResultCard from './ResultCard';
import GlobalStatsPanel from './GlobalStatsPanel';
import type { Opening } from '../lib/openings';
import { parseLine, type Ply } from '../lib/line';
import { challengeReducer, createChallenge, resultBucket } from '../lib/challenge';
import { computeStats, loadHistory, saveDay } from '../lib/progress';
import { fetchGlobalStats, submitResult, type GlobalStats } from '../lib/stats-api';
import { ui, defaultLang, type Lang } from '../i18n/ui';

interface DailyChallengeProps {
    day: number;
    opening: Opening;
    lang?: Lang;
}

type Mode = 'challenge' | 'study';

function celebrate() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const end = Date.now() + 2500;
    const colors = ['#d4b37a', '#1f4435', '#f4efe4'];
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
    })();
}

function safeParse(pgn: string): Ply[] {
    try {
        return parseLine(pgn);
    } catch (e) {
        console.error('Invalid PGN:', pgn, e);
        return [];
    }
}

const DailyChallenge: React.FC<DailyChallengeProps> = ({ day, opening, lang = defaultLang }) => {
    const t = ui[lang];
    const content = opening[lang];
    const side = opening.side;
    const plies = useMemo(() => safeParse(opening.pgn), [opening.pgn]);
    const reducer = useMemo(() => challengeReducer(plies), [plies]);

    const saved = useMemo(() => {
        const record = loadHistory()[day];
        return record?.opening === opening.slug ? record : undefined;
    }, [day, opening.slug]);
    const [state, dispatch] = useReducer(reducer, undefined, () => saved?.state ?? createChallenge(plies, side));
    const [submitted, setSubmitted] = useState(saved?.submitted ?? false);
    const [history, setHistory] = useState(loadHistory);
    const [global, setGlobal] = useState<GlobalStats | null>(null);
    const [mode, setMode] = useState<Mode>('challenge');
    const finished = state.status !== 'playing';

    useEffect(() => {
        setHistory(saveDay(day, { opening: opening.slug, state, submitted }));
    }, [day, opening.slug, state, submitted]);

    // Report the finished result once, then show how everyone else did today.
    useEffect(() => {
        if (!finished) return;
        let cancelled = false;
        (async () => {
            if (!submitted && (await submitResult(day, resultBucket(state))) && !cancelled) setSubmitted(true);
            const stats = await fetchGlobalStats(day);
            if (!cancelled) setGlobal(stats);
        })();
        return () => {
            cancelled = true;
        };
        // Only when the challenge finishes (or on load of a finished day).
    }, [finished, day]);

    // Celebrate a win only when it happens, not when revisiting a finished day.
    const wasFinished = useRef(finished);
    useEffect(() => {
        if (!wasFinished.current && state.status === 'won') celebrate();
        wasFinished.current = finished;
    }, [finished, state.status]);

    const stats = useMemo(() => computeStats(history, day), [history, day]);
    const orientation = side === 'w' ? 'white' : 'black';

    const tabClass = (active: boolean) =>
        `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${active
            ? 'bg-surface text-ink shadow-sm'
            : 'text-ink-muted hover:text-ink'}`;

    const intro = (
        <header className="text-center lg:text-left space-y-2 animate-rise">
            <p className="eyebrow">
                {t.challengeNumber.replace('{n}', String(day + 1))} · {opening.eco}
            </p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-[clamp(1.75rem,4.5svh,2.6rem)] leading-[1.05] font-semibold tracking-tight text-balance">
                {content.name}
            </h1>
            <p className="font-display italic text-lg lg:text-base text-ink-muted text-balance">
                {content.description}
            </p>
            <div role="tablist" className="inline-flex gap-1 p-1 mt-2 rounded-full bg-surface-2 border border-line">
                <button role="tab" aria-selected={mode === 'challenge'} onClick={() => setMode('challenge')} className={tabClass(mode === 'challenge')}>
                    <Swords size={16} aria-hidden="true" /> {t.modeChallenge}
                </button>
                <button
                    role="tab"
                    aria-selected={mode === 'study'}
                    onClick={() => setMode('study')}
                    disabled={!finished}
                    title={finished ? undefined : t.studyLocked}
                    className={`${tabClass(mode === 'study')} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {finished ? <BookOpen size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />} {t.modeStudy}
                </button>
            </div>
        </header>
    );

    if (mode === 'study' && finished) {
        return (
            <StudyMode
                plies={plies}
                orientation={orientation}
                explanations={content.moves}
                lang={lang}
                initialPly={plies.length - 1}
                intro={intro}
                idea={content.idea}
            />
        );
    }

    return (
        <ChallengeMode
            plies={plies}
            state={state}
            dispatch={dispatch}
            explanations={content.moves}
            lang={lang}
            intro={intro}
            result={finished ? (
                <ResultCard
                    state={state}
                    plies={plies}
                    stats={stats}
                    challengeNumber={day + 1}
                    openingName={content.name}
                    lang={lang}
                    onStudy={() => setMode('study')}
                    global={global && <GlobalStatsPanel stats={global} bucket={resultBucket(state)} lang={lang} />}
                    idea={content.idea}
                />
            ) : undefined}
        />
    );
};

export default DailyChallenge;
