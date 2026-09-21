import React, { useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Info, Lightbulb } from 'lucide-react';
import Board, { type SquareStyles } from './Board';
import { fenAt, pairMoves, type Ply } from '../lib/line';
import {
    MAX_HINT_LEVEL, MAX_MISTAKES, isPlayerTurn, judgeAttempt,
    type ChallengeAction, type ChallengeState, type PlyResult,
} from '../lib/challenge';
import { ui, type Lang } from '../i18n/ui';

interface ChallengeModeProps {
    plies: Ply[];
    state: ChallengeState;
    dispatch: React.Dispatch<ChallengeAction>;
    explanations: string[];
    lang: Lang;
    /** Rendered in place of the side panel once the challenge is over. */
    result?: React.ReactNode;
}

type Feedback = { kind: 'correct' | 'wrong'; square: Square };

const OPPONENT_DELAY_MS = 600;
const FEEDBACK_MS = 700;

const STYLE = {
    selected: { backgroundColor: 'rgba(245, 158, 11, 0.6)' },
    target: { background: 'radial-gradient(circle, rgba(28, 25, 23, 0.35) 22%, transparent 24%)' },
    hint: { boxShadow: 'inset 0 0 0 4px rgba(59, 130, 246, 0.85)' },
    correct: { backgroundColor: 'rgba(34, 197, 94, 0.6)' },
    wrong: { backgroundColor: 'rgba(239, 68, 68, 0.65)' },
} satisfies Record<string, React.CSSProperties>;

const RESULT_DOT: Record<PlyResult, string> = {
    perfect: 'bg-green-500',
    assisted: 'bg-amber-400',
    revealed: 'bg-red-500',
};

function pieceOf(san: string): 'p' | 'n' | 'b' | 'r' | 'q' | 'k' {
    if (san.startsWith('O-O')) return 'k';
    const letter = san[0];
    return 'NBRQK'.includes(letter) ? (letter.toLowerCase() as 'n' | 'b' | 'r' | 'q' | 'k') : 'p';
}

const ChallengeMode: React.FC<ChallengeModeProps> = ({ plies, state, dispatch, explanations, lang, result }) => {
    const t = ui[lang];
    const [selected, setSelected] = useState<Square | null>(null);
    const [feedback, setFeedback] = useState<Feedback | null>(null);

    const fen = fenAt(plies, state.cursor - 1);
    const position = useMemo(() => new Chess(fen), [fen]);
    const playerTurn = isPlayerTurn(state, plies);
    const target = plies[state.cursor];
    const lastPly = plies[state.cursor - 1];
    const moveList = useMemo(() => pairMoves(plies), [plies]);

    // The opponent replies on its own after a short pause.
    useEffect(() => {
        if (state.status !== 'playing' || playerTurn) return;
        const timer = setTimeout(() => dispatch({ type: 'opponent' }), OPPONENT_DELAY_MS);
        return () => clearTimeout(timer);
    }, [state.status, state.cursor, playerTurn, dispatch]);

    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
        return () => clearTimeout(timer);
    }, [feedback]);

    const ownsPiece = (square: Square) => position.get(square)?.color === state.side;

    const attempt = (from: Square, to: Square): boolean => {
        setSelected(null);
        const verdict = judgeAttempt(state, plies, from, to);
        if (verdict === 'illegal') return false;
        setFeedback({ kind: verdict, square: to });
        dispatch({ type: 'attempt', from, to });
        return verdict === 'correct';
    };

    const handleSquareClick = (square: Square) => {
        if (!playerTurn) return;
        if (selected && square !== selected && !ownsPiece(square)) {
            attempt(selected, square);
        } else {
            setSelected(square === selected || !ownsPiece(square) ? null : square);
        }
    };

    const squareStyles: SquareStyles = {};
    if (selected) {
        for (const move of position.moves({ square: selected, verbose: true })) squareStyles[move.to] = STYLE.target;
        squareStyles[selected] = STYLE.selected;
    }
    if (playerTurn && target && state.hintLevel >= 2) squareStyles[target.from] = { ...squareStyles[target.from], ...STYLE.hint };
    if (feedback) squareStyles[feedback.square] = STYLE[feedback.kind];

    const arrows = playerTurn && target && state.hintLevel >= MAX_HINT_LEVEL
        ? [{ startSquare: target.from, endSquare: target.to, color: 'rgba(59, 130, 246, 0.85)' }]
        : [];

    const hintLines = target ? [
        t.hintPiece.replace('{piece}', t.pieces[pieceOf(target.san)]),
        t.hintSquare.replace('{square}', target.from),
        t.hintMove.replace('{san}', target.san),
    ].slice(0, state.hintLevel) : [];

    const statusText = feedback?.kind === 'wrong' ? t.wrongMove
        : feedback?.kind === 'correct' ? t.correctMove
            : playerTurn ? t.yourTurn : t.opponentTurn;

    const renderPly = (ply?: Ply) => {
        if (!ply) return <span />;
        const played = ply.index < state.cursor;
        const outcome = state.results[ply.index];
        return (
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded font-medium ${ply.index === state.cursor - 1 ? 'bg-amber-500/20' : ''} ${played ? 'text-stone-800 dark:text-stone-200' : 'text-stone-400 dark:text-stone-600'}`}>
                {outcome && <span className={`w-2 h-2 rounded-full ${RESULT_DOT[outcome]}`} aria-hidden="true" />}
                {played ? ply.san : '···'}
            </span>
        );
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start justify-center w-full">
            <div className="flex flex-col items-center gap-4 w-full lg:w-auto flex-shrink-0">
                <div className={`w-full max-w-[450px] lg:w-[450px] aspect-square shadow-2xl rounded-sm overflow-hidden border-4 border-stone-800/80 dark:border-stone-900/50 ${feedback?.kind === 'wrong' ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}>
                    <Board
                        id="challenge"
                        fen={fen}
                        orientation={state.side === 'w' ? 'white' : 'black'}
                        lastMove={lastPly}
                        squareStyles={squareStyles}
                        arrows={arrows}
                        onMove={attempt}
                        canDragPiece={square => playerTurn && ownsPiece(square)}
                        onSquareClick={handleSquareClick}
                    />
                </div>
            </div>

            <div className="w-full lg:w-80 flex flex-col gap-4">
                {result ?? (
                    <div className="bg-stone-100/80 dark:bg-stone-900/80 rounded-xl shadow-xl border border-stone-300 dark:border-stone-700 overflow-hidden flex flex-col lg:h-[500px]">
                        <div className="bg-stone-200 dark:bg-stone-800 p-4 border-b border-stone-300 dark:border-stone-700 flex items-center justify-between gap-2">
                            <span className="text-stone-800 dark:text-stone-100 font-bold text-sm uppercase tracking-wider">
                                {t.playingAs.replace('{side}', state.side === 'w' ? t.white : t.black)}
                            </span>
                            <span className="flex items-center gap-1" role="img" aria-label={`${t.mistakes}: ${state.mistakes}/${MAX_MISTAKES}`}>
                                {Array.from({ length: MAX_MISTAKES }, (_, i) => (
                                    <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < state.mistakes ? 'bg-red-500' : 'bg-stone-400/50 dark:bg-stone-600'}`} />
                                ))}
                            </span>
                        </div>

                        <div className="p-4 border-b border-stone-300 dark:border-stone-700 space-y-3">
                            <p aria-live="polite" className={`text-sm font-semibold ${feedback?.kind === 'wrong' ? 'text-red-600 dark:text-red-400' : feedback?.kind === 'correct' ? 'text-green-700 dark:text-green-400' : 'text-stone-700 dark:text-stone-300'}`}>
                                {statusText}
                            </p>
                            <button
                                onClick={() => dispatch({ type: 'hint' })}
                                disabled={!playerTurn || state.hintLevel >= MAX_HINT_LEVEL}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 disabled:opacity-40 transition-colors"
                            >
                                <Lightbulb size={16} aria-hidden="true" />
                                {t.hint} ({state.hintLevel}/{MAX_HINT_LEVEL})
                            </button>
                            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 min-h-[4.25rem]" aria-live="polite">
                                {hintLines.map(line => <li key={line}>{line}</li>)}
                            </ul>
                        </div>

                        <ol className="flex-grow overflow-y-auto p-2 text-sm" aria-label={t.progress}>
                            {moveList.map(pair => (
                                <li key={pair.number} className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-1 py-0.5">
                                    <span className="px-2 text-stone-500 font-mono">{pair.number}.</span>
                                    {renderPly(pair.white)}
                                    {renderPly(pair.black)}
                                </li>
                            ))}
                        </ol>

                        <div className="bg-stone-200/50 dark:bg-stone-800/50 border-t border-stone-300 dark:border-stone-700 p-4">
                            <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
                                <Info size={16} aria-hidden="true" />
                                <span className="text-xs font-bold uppercase tracking-wider">
                                    {t.analysis}{lastPly && ` · ${Math.floor(lastPly.index / 2) + 1}${lastPly.color === 'w' ? '.' : '...'} ${lastPly.san}`}
                                </span>
                            </div>
                            <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed italic min-h-[2.5rem]">
                                {lastPly ? explanations[lastPly.index] : '—'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChallengeMode;
