import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { BookOpen, Brain, CalendarDays, Lock, Shuffle, Swords, Target } from 'lucide-react';
import confetti from 'canvas-confetti';
import ChallengeMode from './ChallengeMode';
import ExpertMode from './ExpertMode';
import StudyMode from './StudyMode';
import TacticMode from './TacticMode';
import ResultCard, { type NextItem } from './ResultCard';
import { notifyGameFinished, notifyProgress, useElapsed } from './hooks';
import type { Opening } from '../lib/openings';
import { parseLine, type Ply } from '../lib/line';
import {
    challengeReducer, createChallenge, errorHalves, hintsUsed, isSolved, playerPlies, resultBucket,
    type ChallengeAction, type ChallengeState,
} from '../lib/challenge';
import { createExpert, type ExpertState } from '../lib/expert';
import { lineDifficulty } from '../lib/puzzle';
import { computeStats, loadArchive, loadHistory, saveArchiveDay, saveDay } from '../lib/progress';
import { fetchGlobalStats, submitResult, type GlobalStats } from '../lib/stats-api';
import { archivePath, battlePath, fill, plural, ui, type Lang } from '../i18n/ui';

export type Variant = 'daily' | 'archive';
export type PlayMode = 'normal' | 'expert';
type Tab = 'challenge' | 'study' | 'tactic';

export interface IntroText {
    eyebrow?: React.ReactNode;
    title?: React.ReactNode;
    description?: React.ReactNode;
}

interface OpeningGameProps {
    day: number;
    opening: Opening;
    lang: Lang;
    /** The daily challenge counts for streaks and global stats; archive replays don't. */
    variant: Variant;
    initialMode?: PlayMode;
}

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

type Action = ChallengeAction | { type: 'reset' };

/** Saves are throttled to one every few seconds while the clock runs. */
const SAVE_EVERY_MS = 5000;

const OpeningGame: React.FC<OpeningGameProps> = ({ day, opening, lang, variant, initialMode = 'normal' }) => {
    const t = ui[lang];
    const content = opening[lang];
    const side = opening.side;
    const daily = variant === 'daily';
    const plies = useMemo(() => safeParse(opening.pgn), [opening.pgn]);
    const puzzles = opening.puzzles ?? [];

    // Saved progress for this day (daily history or archive).
    const saved = useMemo(() => {
        if (daily) {
            const record = loadHistory()[day];
            return record?.opening === opening.slug ? { normal: record, submitted: record.submitted ?? false } : undefined;
        }
        const record = loadArchive()[day];
        return record?.opening === opening.slug ? { normal: record.normal, expert: record.expert, submitted: true } : undefined;
    }, [daily, day, opening.slug]);
    const playedAsDaily = useMemo(() => !daily && loadHistory()[day]?.opening === opening.slug && loadHistory()[day].state.status !== 'playing', [daily, day, opening.slug]);

    const reducer = useMemo(() => {
        const inner = challengeReducer(plies);
        return (state: ChallengeState, action: Action) => (action.type === 'reset' ? createChallenge(plies, side) : inner(state, action));
    }, [plies, side]);
    const [state, dispatch] = useReducer(reducer, undefined, () => saved?.normal?.state ?? createChallenge(plies, side));
    const [expert, setExpert] = useState<ExpertState>(() => saved?.expert?.state ?? createExpert(side));
    const [mode, setMode] = useState<PlayMode>(daily ? 'normal' : initialMode);
    const [tab, setTab] = useState<Tab>('challenge');
    const [submitted, setSubmitted] = useState(saved?.submitted ?? false);
    const [global, setGlobal] = useState<GlobalStats | null>(null);
    const [history, setHistory] = useState(loadHistory);

    const normalDone = state.status !== 'playing';
    const expertDone = expert.status !== 'playing';
    const finished = mode === 'normal' ? normalDone : expertDone;
    const unlocked = normalDone || expertDone || playedAsDaily;

    // Playing time, per mode, only while that mode is on screen and unfinished.
    const lastSave = useRef(0);
    const [normalMs, resetNormalMs] = useElapsed(!normalDone && mode === 'normal' && tab === 'challenge', saved?.normal?.elapsedMs ?? 0, ms => {
        if (ms - lastSave.current >= SAVE_EVERY_MS) persist({ normalMs: ms });
    });
    const [expertMs, resetExpertMs] = useElapsed(!expertDone && mode === 'expert' && tab === 'challenge', saved?.expert?.elapsedMs ?? 0, ms => {
        if (ms - lastSave.current >= SAVE_EVERY_MS) persist({ expertMs: ms });
    });

    function persist(times: { normalMs?: number; expertMs?: number } = {}) {
        lastSave.current = Math.max(times.normalMs ?? 0, times.expertMs ?? 0);
        if (daily) {
            setHistory(saveDay(day, { opening: opening.slug, state, submitted, elapsedMs: times.normalMs ?? normalMs }));
        } else {
            saveArchiveDay(day, {
                opening: opening.slug,
                normal: { state, elapsedMs: times.normalMs ?? normalMs },
                expert: { state: expert, elapsedMs: times.expertMs ?? expertMs },
            });
        }
        notifyProgress();
    }

    // Save whenever the game itself changes.
    useEffect(() => {
        persist();
        // `persist` reads the latest times; only game changes should trigger a save.
    }, [state, expert, submitted]);

    // Daily only: report the finished result once, then show how everyone did.
    // Archive: show how everyone did on that day.
    useEffect(() => {
        if (!normalDone && daily) return;
        let cancelled = false;
        (async () => {
            if (daily && !submitted) {
                const ok = await submitResult({ day, mistakes: resultBucket(state), halves: errorHalves(state), hints: hintsUsed(state), seconds: normalMs / 1000 });
                if (ok && !cancelled) setSubmitted(true);
            }
            const stats = await fetchGlobalStats(day);
            if (!cancelled) setGlobal(stats);
        })();
        return () => {
            cancelled = true;
        };
        // Only when the challenge finishes (or on load of a finished day).
    }, [normalDone, daily, day]);

    // Celebrate a win only when it happens, not when revisiting a finished day.
    const was = useRef({ normal: state.status, expert: expert.status });
    useEffect(() => {
        const before = was.current;
        const wonNow = (isSolved(state) && before.normal !== 'won') || (expert.status === 'won' && before.expert !== 'won');
        const endedNow = (normalDone && before.normal === 'playing') || (expertDone && before.expert === 'playing');
        if (wonNow) celebrate();
        if (endedNow) notifyGameFinished();
        was.current = { normal: state.status, expert: expert.status };
    }, [state.status, expert.status, normalDone, expertDone]);

    const stats = useMemo(() => computeStats(history, day), [history, day]);
    const orientation = side === 'w' ? 'white' : 'black';
    const playerMoves = playerPlies(plies, side).length;

    const replay = () => {
        if (mode === 'normal') {
            dispatch({ type: 'reset' });
            resetNormalMs();
        } else {
            setExpert(createExpert(side));
            resetExpertMs();
        }
        setTab('challenge');
    };

    const tabClass = (active: boolean) =>
        `flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors ${active
            ? 'bg-surface text-ink shadow-sm'
            : 'text-ink-muted hover:text-ink'}`;

    const lockedTab = (id: Tab, icon: React.ReactNode, label: string) => (
        <button
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            disabled={!unlocked}
            title={unlocked ? undefined : t.lockedUntilDone}
            className={`${tabClass(tab === id)} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            {unlocked ? icon : <Lock size={15} aria-hidden="true" />} {label}
        </button>
    );

    const meta = [
        fill(t.challengeNumber, { n: day + 1 }),
        opening.eco,
        t.difficulty[lineDifficulty(playerMoves)],
        plural(lang, playerMoves, t.movesToFindOne, t.movesToFindOther),
    ].join(' · ');

    /** The header above the panel; the tactic tab replaces the title with its own. */
    const renderIntro = ({ eyebrow = meta, title = content.name, description = content.description }: IntroText = {}) => (
        <header className="text-center lg:text-left space-y-2 animate-rise">
            {!daily && (
                <a href={archivePath(lang)} className="inline-flex text-sm font-semibold text-accent hover:underline underline-offset-4">{t.archiveBack}</a>
            )}
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-[clamp(1.75rem,4.5svh,2.6rem)] leading-[1.05] font-semibold tracking-tight text-balance">
                {title}
            </h1>
            <p className="font-display italic text-lg lg:text-base text-ink-muted text-balance">
                {description}
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mt-2">
                <div role="tablist" className="inline-flex gap-1 p-1 rounded-full bg-surface-2 border border-line">
                    <button role="tab" aria-selected={tab === 'challenge'} onClick={() => setTab('challenge')} className={tabClass(tab === 'challenge')}>
                        {mode === 'expert' ? <Brain size={15} aria-hidden="true" /> : <Swords size={15} aria-hidden="true" />}
                        {mode === 'expert' ? t.modeExpert : t.modeChallenge}
                    </button>
                    {lockedTab('study', <BookOpen size={15} aria-hidden="true" />, t.modeStudy)}
                    {puzzles.length > 0 && lockedTab('tactic', <Target size={15} aria-hidden="true" />, t.modeTactic)}
                </div>
                {!daily && (
                    <div className="inline-flex gap-1 p-1 rounded-full border border-line" role="radiogroup" aria-label={t.expertTitle}>
                        {(['normal', 'expert'] as PlayMode[]).map(m => (
                            <button
                                key={m}
                                role="radio"
                                aria-checked={mode === m}
                                onClick={() => {
                                    setMode(m);
                                    setTab('challenge');
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${mode === m ? 'bg-brand text-brand-ink' : 'text-ink-muted hover:text-ink'}`}
                            >
                                {m === 'normal' ? t.modeNormal : t.modeExpert}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </header>
    );
    const intro = renderIntro();

    if (tab === 'study' && unlocked) {
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

    if (tab === 'tactic' && unlocked && puzzles.length) {
        return <TacticMode puzzles={puzzles} lang={lang} openingName={content.name} renderIntro={renderIntro} />;
    }

    // The archive only has past days, so on launch day there is nothing to link to yet.
    const hasArchive = day > 0;
    const next: NextItem[] = [
        ...(puzzles.length ? [{ icon: <Target size={18} />, label: t.tileTactic, description: t.tileTacticDesc, onClick: () => setTab('tactic') }] : []),
        ...(!daily
            ? [
                { icon: <Shuffle size={18} />, label: t.archiveRandom, description: t.tileArchiveDesc, href: `${archivePath(lang)}?random` },
                mode === 'normal'
                    ? { icon: <Brain size={18} />, label: t.tileExpert, description: t.tileExpertDesc, onClick: () => setMode('expert') }
                    : { icon: <Swords size={18} />, label: t.modeNormal, description: t.modeChallenge, onClick: () => setMode('normal') },
            ]
            : [
                ...(hasArchive
                    ? [
                        { icon: <CalendarDays size={18} />, label: t.tileArchive, description: t.tileArchiveDesc, href: archivePath(lang) },
                        { icon: <Brain size={18} />, label: t.tileExpert, description: t.tileExpertDesc, href: `${archivePath(lang)}?random&mode=expert` },
                    ]
                    : []),
                { icon: <Swords size={18} />, label: t.tileBattle, description: t.tileBattleDesc, href: battlePath(lang) },
            ]),
    ];

    if (mode === 'expert') {
        return (
            <ExpertMode
                plies={plies}
                state={expert}
                onChange={setExpert}
                lang={lang}
                intro={intro}
                challengeNumber={day + 1}
                openingName={content.name}
                elapsedMs={expertMs}
                idea={content.idea}
                onStudy={() => setTab('study')}
                onReplay={replay}
                next={next}
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
                    challengeNumber={day + 1}
                    eco={opening.eco}
                    openingName={content.name}
                    lang={lang}
                    elapsedMs={normalMs}
                    variant={variant}
                    streak={stats.currentStreak}
                    global={global}
                    idea={content.idea}
                    onStudy={() => setTab('study')}
                    onReplay={daily ? undefined : replay}
                    next={next}
                />
            ) : undefined}
        />
    );
};

export default OpeningGame;
