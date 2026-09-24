import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, RotateCcw, Target } from 'lucide-react';
import { useStore } from '@nanostores/react';
import ChallengeMode from './ChallengeMode';
import { notifyGameFinished, notifyProgress } from './hooks';
import { MAX_MISTAKES, challengeReducer, createChallenge, errorCount, hintsUsed, isSolved, resultGrid } from '../lib/challenge';
import { lichessPuzzleUrl, puzzleGoal, puzzleMotifs, puzzlePlies, puzzleSide, type Puzzle } from '../lib/puzzle';
import { loadTactics, saveTactic } from '../lib/progress';
import { contrastStore } from '../store/theme';
import type { IntroText } from './OpeningGame';
import { fill, formatDecimal, ui, type Lang } from '../i18n/ui';

interface TacticModeProps {
    puzzles: Puzzle[];
    lang: Lang;
    /** The opening the tactic comes from, named in the header so it's clear why it's here. */
    openingName: string;
    renderIntro: (text: IntroText) => React.ReactNode;
}

/** First puzzle not solved yet, so coming back continues where the player left off. */
function firstOpen(puzzles: Puzzle[]): number {
    const tactics = loadTactics();
    const index = puzzles.findIndex(p => tactics[p.id]?.state.status !== 'won');
    return index === -1 ? 0 : index;
}

const TacticMode: React.FC<TacticModeProps> = ({ puzzles, lang, openingName, renderIntro }) => {
    const [index, setIndex] = useState(() => firstOpen(puzzles));
    const [round, setRound] = useState(0);
    const puzzle = puzzles[index];
    if (!puzzle) return null;
    return (
        <TacticBoard
            key={`${puzzle.id}-${round}`}
            puzzle={puzzle}
            position={index}
            total={puzzles.length}
            lang={lang}
            openingName={openingName}
            renderIntro={renderIntro}
            onNext={() => setIndex(i => (i + 1) % puzzles.length)}
            onRetry={() => {
                saveTactic(puzzle.id, createChallenge(puzzlePlies(puzzle), puzzleSide(puzzlePlies(puzzle))));
                setRound(r => r + 1);
            }}
        />
    );
};

interface TacticBoardProps {
    puzzle: Puzzle;
    position: number;
    total: number;
    lang: Lang;
    openingName: string;
    renderIntro: (text: IntroText) => React.ReactNode;
    onNext: () => void;
    onRetry: () => void;
}

function TacticBoard({ puzzle, position, total, lang, openingName, renderIntro, onNext, onRetry }: TacticBoardProps) {
    const t = ui[lang];
    const plies = useMemo(() => puzzlePlies(puzzle), [puzzle]);
    const side = puzzleSide(plies);
    const reducer = useMemo(() => challengeReducer(plies), [plies]);
    const [state, dispatch] = useReducer(reducer, undefined, () => loadTactics()[puzzle.id]?.state ?? createChallenge(plies, side));
    const contrast = useStore(contrastStore);
    const goal = t.goals[puzzleGoal(puzzle)];
    const finished = state.status !== 'playing';

    useEffect(() => {
        saveTactic(puzzle.id, state);
        notifyProgress();
    }, [puzzle.id, state]);

    const wasPlaying = useRef(!finished);
    useEffect(() => {
        if (finished && wasPlaying.current) notifyGameFinished();
        wasPlaying.current = !finished;
    }, [finished]);

    const label = t.playingAs.replace('{side}', side === 'w' ? t.white : t.black);
    const intro = renderIntro({
        eyebrow: `${fill(t.tacticOf, { i: position + 1, n: total })} · Elo ${puzzle.rating}`,
        title: goal,
        description: fill(t.tacticContext, { name: openingName }),
    });
    const won = isSolved(state);

    const result = finished ? (
        <section aria-labelledby="tactic-result" className="card flex flex-col overflow-hidden animate-rise">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4 text-center">
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
                {total > 1 && (
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

export default TacticMode;
