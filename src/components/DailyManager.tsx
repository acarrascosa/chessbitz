import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Swords, BookOpen } from 'lucide-react';
import confetti from 'canvas-confetti';
import ChallengeMode from './ChallengeMode';
import StudyMode from './StudyMode';
import ResultCard from './ResultCard';
import { getDailyOpening, getPlayerSide } from '../lib/openings';
import { parseLine, type Ply } from '../lib/line';
import { challengeReducer, createChallenge } from '../lib/challenge';
import { computeStats, loadHistory, saveDay } from '../lib/progress';
import { ui, defaultLang, type Lang } from '../i18n/ui';

interface DailyManagerProps {
    lang?: Lang;
}

type Mode = 'challenge' | 'study';

function celebrate() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const end = Date.now() + 2500;
    const colors = ['#f59e0b', '#fbbf24', '#ffffff'];
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

const DailyManager: React.FC<DailyManagerProps> = ({ lang = defaultLang }) => {
    const t = ui[lang];
    // Rendered client-only: the daily opening depends on the viewer's local date.
    const { day, opening } = useMemo(() => getDailyOpening(new Date()), []);
    const content = opening.content[lang];
    const side = getPlayerSide(opening);
    const plies = useMemo(() => safeParse(opening.pgn), [opening.pgn]);
    const reducer = useMemo(() => challengeReducer(plies), [plies]);

    const [state, dispatch] = useReducer(reducer, undefined, () => {
        const saved = loadHistory()[day];
        return saved?.openingId === opening.id ? saved.state : createChallenge(plies, side);
    });
    const [history, setHistory] = useState(loadHistory);
    const [mode, setMode] = useState<Mode>('challenge');
    const finished = state.status !== 'playing';

    useEffect(() => {
        setHistory(saveDay(day, { openingId: opening.id, state }));
    }, [day, opening.id, state]);

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
            ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow'
            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'}`;

    return (
        <div className="w-full flex flex-col items-center">
            <header className="text-center space-y-3 mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                    {t.challengeNumber.replace('{n}', String(day + 1))} · {opening.eco}
                </p>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-stone-800 dark:text-stone-100 drop-shadow-sm">
                    {content.name}
                </h1>
                <p className="text-lg md:text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed border-l-4 border-amber-500 pl-4 py-1 bg-stone-400/10 dark:bg-stone-800/20 italic">
                    {content.description}
                </p>
            </header>

            <div role="tablist" className="flex gap-1 p-1 mb-6 rounded-full bg-stone-200/70 dark:bg-stone-800/70 border border-stone-300 dark:border-stone-700">
                <button role="tab" aria-selected={mode === 'challenge'} onClick={() => setMode('challenge')} className={tabClass(mode === 'challenge')}>
                    <Swords size={16} aria-hidden="true" /> {t.modeChallenge}
                </button>
                <button role="tab" aria-selected={mode === 'study'} onClick={() => setMode('study')} className={tabClass(mode === 'study')}>
                    <BookOpen size={16} aria-hidden="true" /> {t.modeStudy}
                </button>
            </div>

            {mode === 'challenge' ? (
                <ChallengeMode
                    plies={plies}
                    state={state}
                    dispatch={dispatch}
                    explanations={content.explanations}
                    lang={lang}
                    result={finished ? (
                        <ResultCard
                            state={state}
                            plies={plies}
                            stats={stats}
                            challengeNumber={day + 1}
                            openingName={content.name}
                            lang={lang}
                            onStudy={() => setMode('study')}
                        />
                    ) : undefined}
                />
            ) : (
                <StudyMode
                    plies={plies}
                    orientation={orientation}
                    explanations={content.explanations}
                    lang={lang}
                    initialPly={finished ? plies.length - 1 : undefined}
                />
            )}
        </div>
    );
};

export default DailyManager;
