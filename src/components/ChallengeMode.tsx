import React, { useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Info, Lightbulb } from 'lucide-react';
import Board, { type SquareStyles } from './Board';
import Stage from './Stage';
import { fenAt, moveLabel, pairMoves, type Ply } from '../lib/line';
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
    /** Title and tabs shown above the panel. */
    intro: React.ReactNode;
    /** Rendered in place of the side panel once the challenge is over. */
    result?: React.ReactNode;
}

type Feedback = { kind: 'correct' | 'wrong'; square: Square };

const OPPONENT_DELAY_MS = 600;
const FEEDBACK_MS = 700;

/** Square highlights are drawn as overlays so the wood colour stays visible underneath. */
const overlay = (color: string): React.CSSProperties => ({ boxShadow: `inset 0 0 0 100vmax ${color}` });
const STYLE = {
    selected: overlay('rgba(214, 170, 60, 0.55)'),
    target: { backgroundImage: 'radial-gradient(circle, rgba(31, 40, 35, 0.38) 21%, transparent 23%)' },
    hint: { outline: '4px solid rgba(47, 111, 143, 0.9)', outlineOffset: '-4px' },
    correct: overlay('rgba(47, 125, 79, 0.55)'),
    wrong: overlay('rgba(179, 67, 47, 0.6)'),
} satisfies Record<string, React.CSSProperties>;

const RESULT_DOT: Record<PlyResult, string> = {
    perfect: 'bg-good',
    assisted: 'bg-warn',
    revealed: 'bg-bad',
};

function pieceOf(san: string): 'p' | 'n' | 'b' | 'r' | 'q' | 'k' {
    if (san.startsWith('O-O')) return 'k';
    const letter = san[0];
    return 'NBRQK'.includes(letter) ? (letter.toLowerCase() as 'n' | 'b' | 'r' | 'q' | 'k') : 'p';
}

const ChallengeMode: React.FC<ChallengeModeProps> = ({ plies, state, dispatch, explanations, lang, intro, result }) => {
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
        ? [{ startSquare: target.from, endSquare: target.to, color: 'rgba(47, 111, 143, 0.9)' }]
        : [];

    const hintLines = target ? [
        t.hintPiece.replace('{piece}', t.pieces[pieceOf(target.san)]),
        t.hintSquare.replace('{square}', target.from),
        t.hintMove.replace('{san}', target.san),
    ].slice(0, state.hintLevel) : [];

    const statusText = feedback?.kind === 'wrong' ? t.wrongMove
        : feedback?.kind === 'correct' ? t.correctMove
            : playerTurn ? t.yourTurn : t.opponentTurn;
    const statusColor = feedback?.kind === 'wrong' ? 'text-bad' : feedback?.kind === 'correct' ? 'text-good' : 'text-ink';

    const renderPly = (ply?: Ply) => {
        if (!ply) return <span />;
        const played = ply.index < state.cursor;
        const outcome = state.results[ply.index];
        const isLast = ply.index === state.cursor - 1;
        return (
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-medium tabular-nums ${isLast ? 'bg-accent-soft' : ''} ${played ? 'text-ink' : 'text-ink-muted'}`}>
                {outcome && <span className={`w-2 h-2 rounded-full ${RESULT_DOT[outcome]}`} aria-hidden="true" />}
                {played ? ply.san : '···'}
            </span>
        );
    };

    const panel = (
        <div className="card overflow-hidden flex flex-col animate-rise">
            <div className="px-5 py-3.5 bg-surface-2 border-b border-line flex items-center justify-between gap-2">
                <span className="eyebrow">
                    {t.playingAs.replace('{side}', state.side === 'w' ? t.white : t.black)}
                </span>
                <span className="flex items-center gap-1.5" role="img" aria-label={`${t.mistakes}: ${state.mistakes}/${MAX_MISTAKES}`}>
                    {Array.from({ length: MAX_MISTAKES }, (_, i) => (
                        <span key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${i < state.mistakes ? 'bg-bad' : 'bg-line'}`} />
                    ))}
                </span>
            </div>

            <div className="p-5 border-b border-line space-y-3">
                <p aria-live="polite" className={`font-semibold ${statusColor}`}>{statusText}</p>
                <button
                    onClick={() => dispatch({ type: 'hint' })}
                    disabled={!playerTurn || state.hintLevel >= MAX_HINT_LEVEL}
                    className="btn btn-quiet w-full py-2 text-sm"
                >
                    <Lightbulb size={16} aria-hidden="true" />
                    {t.hint} · {state.hintLevel}/{MAX_HINT_LEVEL}
                </button>
                <ul className="text-sm text-hint space-y-1 min-h-[4.25rem]" aria-live="polite">
                    {hintLines.map(line => <li key={line}>{line}</li>)}
                </ul>
            </div>

            <ol className="flex-grow min-h-0 overflow-y-auto px-3 py-2 text-sm max-h-64 lg:max-h-none" aria-label={t.progress}>
                {moveList.map(pair => (
                    <li key={pair.number} className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1 py-0.5">
                        <span className="px-2 text-ink-muted tabular-nums">{pair.number}.</span>
                        {renderPly(pair.white)}
                        {renderPly(pair.black)}
                    </li>
                ))}
            </ol>

            <div className="bg-surface-2 border-t border-line p-5">
                <div className="flex items-center gap-2 mb-2 eyebrow">
                    <Info size={14} aria-hidden="true" />
                    {t.analysis}{lastPly && <span className="normal-case tracking-normal"> · {moveLabel(lastPly)}</span>}
                </div>
                <p className="text-sm text-ink leading-relaxed min-h-[2.5rem]">
                    {lastPly ? explanations[lastPly.index] : '—'}
                </p>
            </div>
        </div>
    );

    return (
        <Stage
            intro={intro}
            board={
                <div className={`board-frame ${feedback?.kind === 'wrong' ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}>
                    <div className="aspect-square">
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
                            lang={lang}
                        />
                    </div>
                </div>
            }
            side={result ?? panel}
        />
    );
};

export default ChallengeMode;
