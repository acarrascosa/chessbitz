import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowRight, Check, Coffee, ExternalLink, RotateCcw, Share2, Shuffle, Swords, Target, Trophy } from 'lucide-react';
import { useStore } from '@nanostores/react';
import ChallengeMode from './ChallengeMode';
import { NextTiles, type NextItem } from './ResultCard';
import { notifyGameFinished, notifyProgress, useCountdown, useShare } from './hooks';
import { MAX_MISTAKES, challengeReducer, createChallenge, errorCount, hintsUsed, isSolved, resultGrid, type ChallengeState } from '../lib/challenge';
import { lichessPuzzleUrl, puzzleGoal, puzzleMotifs, puzzlePlies, puzzleSide, type Puzzle } from '../lib/puzzle';
import { loadTactics, saveTactic } from '../lib/progress';
import { buildTacticsShareText } from '../lib/share';
import { contrastStore } from '../store/theme';
import type { IntroText } from './OpeningGame';
import { archivePath, battlePath, fill, formatDecimal, ui, type Lang } from '../i18n/ui';

interface TacticModeProps {
    puzzles: Puzzle[];
    lang: Lang;
    /** The opening the tactics come from, named in the header so it's clear why they're here. */
    openingName: string;
    challengeNumber: number;
    /** Today's challenge (come back tomorrow) or an archive replay (more in the archive). */
    daily: boolean;
    renderIntro: (text: IntroText) => React.ReactNode;
}

const finished = (state?: ChallengeState) => Boolean(state && state.status !== 'playing');

/** Saved progress of every tactic, in order (undefined: not started). */
const progressOf = (puzzles: Puzzle[]) => {
    const saved = loadTactics();
    return puzzles.map(p => saved[p.id]?.state);
};

/** Where to (re)open: the first tactic still to finish, or the last one when all are done. */
function firstOpen(states: (ChallengeState | undefined)[]): number {
    const index = states.findIndex(s => !finished(s));
    return index === -1 ? states.length - 1 : index;
}

const TacticMode: React.FC<TacticModeProps> = ({ puzzles, lang, openingName, challengeNumber, daily, renderIntro }) => {
    const [states, setStates] = useState(() => progressOf(puzzles));
    const [index, setIndex] = useState(() => firstOpen(states));
    const [round, setRound] = useState(0);
    const puzzle = puzzles[index];
    if (!puzzle) return null;
    // The next tactic still to finish after this one (none once every tactic is done).
    const next = [...puzzles.keys()].map(i => (index + 1 + i) % puzzles.length).find(i => i !== index && !finished(states[i]));
    return (
        <TacticBoard
            key={`${puzzle.id}-${round}`}
            puzzle={puzzle}
            position={index}
            states={states}
            lang={lang}
            openingName={openingName}
            challengeNumber={challengeNumber}
            daily={daily}
            renderIntro={renderIntro}
            onProgress={() => setStates(progressOf(puzzles))}
            onPick={setIndex}
            onNext={next === undefined ? undefined : () => setIndex(next)}
            onRetry={() => {
                saveTactic(puzzle.id, createChallenge(puzzlePlies(puzzle), puzzleSide(puzzlePlies(puzzle))));
                setStates(progressOf(puzzles));
                setRound(r => r + 1);
            }}
        />
    );
};

/** One dot per tactic: solved, not solved, or still to play; the current one is ringed. */
function TacticPips({ states, current, lang, onPick }: { states: (ChallengeState | undefined)[]; current: number; lang: Lang; onPick?: (i: number) => void }) {
    const t = ui[lang];
    return (
        <span className="inline-flex items-center gap-1.5 align-middle" data-testid="tactic-pips">
            {states.map((state, i) => {
                const color = !finished(state) ? 'bg-line' : isSolved(state!) ? 'bg-good' : 'bg-bad';
                const label = `${fill(t.tacticOf, { i: i + 1, n: states.length })}: ${!finished(state) ? '—' : isSolved(state!) ? t.tacticSolved : t.tacticFailed}`;
                return (
                    <button
                        key={i}
                        onClick={onPick ? () => onPick(i) : undefined}
                        disabled={!onPick}
                        aria-label={label}
                        title={label}
                        aria-current={i === current ? 'step' : undefined}
                        className={`w-2.5 h-2.5 rounded-full ${color} ${i === current ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''}`}
                    />
                );
            })}
        </span>
    );
}

interface TacticBoardProps {
    puzzle: Puzzle;
    position: number;
    states: (ChallengeState | undefined)[];
    lang: Lang;
    openingName: string;
    challengeNumber: number;
    daily: boolean;
    renderIntro: (text: IntroText) => React.ReactNode;
    onProgress: () => void;
    onPick: (index: number) => void;
    /** Undefined once every tactic is done. */
    onNext?: () => void;
    onRetry: () => void;
}

function TacticBoard({ puzzle, position, states, lang, openingName, challengeNumber, daily, renderIntro, onProgress, onPick, onNext, onRetry }: TacticBoardProps) {
    const t = ui[lang];
    const plies = useMemo(() => puzzlePlies(puzzle), [puzzle]);
    const side = puzzleSide(plies);
    const reducer = useMemo(() => challengeReducer(plies), [plies]);
    const [state, dispatch] = useReducer(reducer, undefined, () => loadTactics()[puzzle.id]?.state ?? createChallenge(plies, side));
    const contrast = useStore(contrastStore);
    const goal = t.goals[puzzleGoal(puzzle)];
    const done = state.status !== 'playing';
    const total = states.length;

    useEffect(() => {
        saveTactic(puzzle.id, state);
        notifyProgress();
    }, [puzzle.id, state]);

    const wasPlaying = useRef(!done);
    useEffect(() => {
        if (done && wasPlaying.current) {
            notifyGameFinished();
            onProgress();
        }
        wasPlaying.current = !done;
    }, [done, onProgress]);

    // This board's live state stands in for its saved one, so the dots follow the game.
    const current = states.map((s, i) => (i === position ? state : s));
    const allDone = current.every(finished);
    const solvedCount = current.filter(s => s && isSolved(s)).length;

    const label = t.playingAs.replace('{side}', side === 'w' ? t.white : t.black);
    const intro = renderIntro({
        eyebrow: (
            <span className="inline-flex items-center gap-3">
                <span>{fill(t.tacticOf, { i: position + 1, n: total })} · Elo {puzzle.rating}</span>
                <TacticPips states={current} current={position} lang={lang} onPick={onPick} />
            </span>
        ),
        title: goal,
        description: fill(daily ? t.tacticContext : t.tacticContextArchive, { n: total, name: openingName }),
    });
    const won = isSolved(state);

    const result = done ? (
        <section aria-labelledby="tactic-result" className="card flex flex-col overflow-hidden animate-rise">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4 text-center">
                {/* Every tactic done: that's the news, so it goes first; this one's details follow. */}
                {allDone && (
                    <TacticsComplete
                        states={current as ChallengeState[]}
                        solved={solvedCount}
                        position={position}
                        lang={lang}
                        daily={daily}
                        onPick={onPick}
                    />
                )}
                <div className="space-y-1">
                    <p className="eyebrow">{fill(t.tacticOf, { i: position + 1, n: total })} · {goal}</p>
                    <h2 id="tactic-result" className="font-display text-2xl font-semibold">{won ? t.tacticSolved : t.tacticFailed}</h2>
                    <p className="text-2xl tracking-[0.2em] pt-1" aria-hidden="true">{resultGrid(state, plies, contrast)}</p>
                </div>
                <dl className="grid grid-cols-3 gap-2">
                    {[
                        [t.statMistakes, state.status === 'won' ? `${formatDecimal(lang, errorCount(state))}/${MAX_MISTAKES}` : '✕'],
                        [t.statHints, String(hintsUsed(state))],
                        ['Elo', String(puzzle.rating)],
                    ].map(([name, value]) => (
                        <div key={name} className="rounded-xl border border-line bg-surface-2/60 py-2.5 flex flex-col-reverse gap-1">
                            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-muted">{name}</dt>
                            <dd className="font-display text-2xl font-semibold tabular-nums leading-none">{value}</dd>
                        </div>
                    ))}
                </dl>
                {puzzleMotifs(puzzle).length > 0 && (
                    <ul className="flex flex-wrap justify-center gap-1.5">
                        {puzzleMotifs(puzzle).map(theme => t.motifs[theme] && (
                            <li key={theme} className="px-2.5 py-1 rounded-full bg-accent-soft text-xs font-semibold">{t.motifs[theme]}</li>
                        ))}
                    </ul>
                )}
                <a href={lichessPuzzleUrl(puzzle.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-accent hover:underline underline-offset-4">
                    {t.viewOnLichess} <ExternalLink size={14} aria-hidden="true" />
                </a>
            </div>
            <div className="shrink-0 grid grid-cols-2 gap-2 p-4 border-t border-line bg-surface-2">
                <button onClick={onRetry} className="btn btn-quiet py-2.5 text-sm">
                    <RotateCcw size={16} aria-hidden="true" /> {t.replay}
                </button>
                {allDone ? (
                    <ShareTactics states={current as ChallengeState[]} challengeNumber={challengeNumber} openingName={openingName} lang={lang} daily={daily} />
                ) : onNext && (
                    <button onClick={onNext} className="btn btn-primary py-2.5 text-sm">
                        {t.nextTactic} <ArrowRight size={16} aria-hidden="true" />
                    </button>
                )}
            </div>
        </section>
    ) : undefined;

    return (
        <ChallengeMode
            plies={plies}
            state={state}
            dispatch={dispatch}
            lang={lang}
            intro={intro}
            result={result}
            boardId="tactic"
            label={<span className="inline-flex items-center gap-1.5"><Target size={13} aria-hidden="true" />{label}</span>}
            texts={{ yourTurn: t.tacticYourTurn, wrong: t.tacticWrong }}
        />
    );
}

/** Once every tactic is done: the tally, when there'll be more, and where else to play. */
function TacticsComplete({ states, solved, position, lang, daily, onPick }: {
    states: ChallengeState[]; solved: number; position: number; lang: Lang; daily: boolean; onPick: (i: number) => void;
}) {
    const t = ui[lang];
    const countdown = useCountdown();
    const next: NextItem[] = [
        { icon: <Swords size={18} />, label: t.tileBattle, description: t.tileBattleTactics, href: battlePath(lang) },
        { icon: <Shuffle size={18} />, label: t.archiveRandom, description: t.tileArchiveDesc, href: `${archivePath(lang)}?random` },
    ];
    return (
        <section className="rounded-xl border border-accent/40 bg-accent-soft/30 p-4 space-y-3 text-center" aria-labelledby="tactics-done" data-testid="tactics-complete">
            <div className="space-y-1">
                <Trophy size={22} className="mx-auto text-accent" aria-hidden="true" />
                <h3 id="tactics-done" className="font-display text-xl font-semibold">{daily ? t.tacticsDoneToday : t.tacticsDoneArchive}</h3>
                <p className="text-sm font-semibold inline-flex items-center gap-2">
                    <TacticPips states={states} current={position} lang={lang} onPick={onPick} />
                    {fill(t.tacticsSolvedOf, { s: solved, n: states.length })}
                </p>
                <p className="text-sm text-ink-muted">
                    {daily ? <>{t.tacticsTomorrow} {t.nextIn} <span className="font-semibold text-ink tabular-nums">{countdown}</span></> : t.tacticsMore}
                </p>
            </div>
            <NextTiles title={t.keepPlaying} items={next} />
            <a href="https://buymeacoffee.com/acarrascosa" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline underline-offset-4">
                <Coffee size={15} aria-hidden="true" /> {t.buyMeCoffee}
            </a>
        </section>
    );
}

function ShareTactics({ states, challengeNumber, openingName, lang, daily }: { states: ChallengeState[]; challengeNumber: number; openingName: string; lang: Lang; daily: boolean }) {
    const t = ui[lang];
    const contrast = useStore(contrastStore);
    const { share, copied } = useShare(() =>
        buildTacticsShareText(states, challengeNumber, openingName, t.tacticsShare, { tag: daily ? undefined : t.archiveTag, contrast }));
    return (
        <button onClick={share} className="btn btn-primary py-2.5 text-sm">
            {copied ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />} {copied ? t.copied : t.shareResult}
        </button>
    );
}

export default TacticMode;
