import React, { useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { BookOpen, Check, Lightbulb, RotateCcw, Send, Share2, Undo2 } from 'lucide-react';
import { useStore } from '@nanostores/react';
import Board, { type SquareStyles } from './Board';
import Stage from './Stage';
import { STYLE } from './ChallengeMode';
import { NextTiles, type NextItem } from './ResultCard';
import { useShare } from './hooks';
import {
    EXPERT_ATTEMPTS, expertLength, expertStartFen, opponentReply, submitAttempt, tryMove,
    type ExpertMove, type ExpertState, type Grade,
} from '../lib/expert';
import { buildExpertShareText } from '../lib/share';
import type { Ply } from '../lib/line';
import { contrastStore } from '../store/theme';
import { fill, formatClock, ui, type Lang } from '../i18n/ui';

interface ExpertModeProps {
    plies: Ply[];
    state: ExpertState;
    onChange: (state: ExpertState) => void;
    lang: Lang;
    intro: React.ReactNode;
    challengeNumber: number;
    openingName: string;
    elapsedMs: number;
    idea?: string;
    onStudy: () => void;
    onReplay: () => void;
    next?: NextItem[];
}

const OPPONENT_DELAY_MS = 450;

export const GRADE_CLASS: Record<Grade, string> = {
    exact: 'bg-good text-white border-good',
    piece: 'bg-warn text-white border-warn',
    square: 'bg-grade-square text-white border-grade-square',
    miss: 'bg-surface-2 text-ink-muted border-line',
};

function Tile({ move, grade, empty }: { move?: ExpertMove; grade?: Grade; empty?: boolean }) {
    const base = 'h-9 rounded-lg border text-sm font-semibold tabular-nums flex items-center justify-center min-w-0 px-1';
    if (empty || !move) return <span className={`${base} border-dashed border-line text-ink-muted`} aria-hidden="true">·</span>;
    return <span className={`${base} ${grade ? GRADE_CLASS[grade] : 'bg-surface border-ink/40 text-ink'}`}>{move.san}</span>;
}

const ExpertMode: React.FC<ExpertModeProps> = ({
    plies, state, onChange, lang, intro, challengeNumber, openingName, elapsedMs, idea, onStudy, onReplay, next = [],
}) => {
    const t = ui[lang];
    const contrast = useStore(contrastStore);
    const side = state.side;
    const total = expertLength(plies, side);
    const startFen = expertStartFen(plies);
    /** Moves of the attempt in progress, both sides, aligned with the line's plies. */
    const [pending, setPending] = useState<ExpertMove[]>([]);
    const [selected, setSelected] = useState<Square | null>(null);

    const fen = pending.length ? pending[pending.length - 1].fen : startFen;
    const position = useMemo(() => new Chess(fen), [fen]);
    const playerMoves = pending.filter(move => move.color === side);
    const gameOver = position.isGameOver();
    const complete = playerMoves.length >= total || (gameOver && playerMoves.length > 0);
    const playing = state.status === 'playing';
    const playerTurn = playing && !complete && position.turn() === side;

    // The opponent answers between the player's moves.
    useEffect(() => {
        if (!playing || complete || position.turn() === side) return;
        const timer = setTimeout(() => {
            const reply = opponentReply(plies, pending.length, fen);
            if (reply) setPending(moves => [...moves, reply]);
        }, OPPONENT_DELAY_MS);
        return () => clearTimeout(timer);
    }, [playing, complete, position, side, plies, pending.length, fen]);

    const play = (from: Square, to: Square): boolean => {
        setSelected(null);
        if (!playerTurn) return false;
        const move = tryMove(fen, from, to);
        if (!move) return false;
        setPending(moves => [...moves, move]);
        return true;
    };

    const takeBack = () => {
        setPending(moves => {
            const lastPlayer = moves.map(m => m.color).lastIndexOf(side);
            return lastPlayer === -1 ? moves : moves.slice(0, lastPlayer);
        });
    };

    const submit = () => {
        onChange(submitAttempt(state, playerMoves, plies));
        setPending([]);
    };

    const ownsPiece = (square: Square) => position.get(square)?.color === side;
    const handleSquareClick = (square: Square) => {
        if (!playerTurn) return;
        if (selected && square !== selected && !ownsPiece(square)) play(selected, square);
        else if (selected && square !== selected && position.get(selected)?.type === 'k' && position.get(square)?.type === 'r') play(selected, square);
        else setSelected(square === selected || !ownsPiece(square) ? null : square);
    };

    const squareStyles: SquareStyles = {};
    if (selected) {
        for (const move of position.moves({ square: selected, verbose: true })) squareStyles[move.to] = STYLE.target;
        squareStyles[selected] = STYLE.selected;
    }

    const attemptNumber = Math.min(EXPERT_ATTEMPTS, state.attempts.length + (playing ? 1 : 0));
    const statusText = playerTurn ? fill(t.expertTurn, { i: playerMoves.length + 1, n: total })
        : complete ? t.expertReady : t.opponentTurn;

    const grid = (
        <ol className="space-y-1.5" aria-label={t.progress}>
            {state.attempts.map((attempt, row) => (
                <li key={row} className="grid gap-1.5" style={{ gridTemplateColumns: `1.25rem repeat(${total}, minmax(0, 1fr))` }}>
                    <span className="text-xs text-ink-muted tabular-nums self-center">{row + 1}</span>
                    {attempt.grades.map((grade, i) => (
                        <span key={i} title={t.grades[grade]} className="contents">
                            <Tile move={attempt.moves[i]} grade={grade} empty={!attempt.moves[i]} />
                            <span className="sr-only">{t.grades[grade]}</span>
                        </span>
                    ))}
                </li>
            ))}
            {playing && (
                <li className="grid gap-1.5" style={{ gridTemplateColumns: `1.25rem repeat(${total}, minmax(0, 1fr))` }}>
                    <span className="text-xs font-bold text-ink tabular-nums self-center">{state.attempts.length + 1}</span>
                    {Array.from({ length: total }, (_, i) => <Tile key={i} move={playerMoves[i]} empty={!playerMoves[i]} />)}
                </li>
            )}
        </ol>
    );

    const legend = (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.7rem] text-ink-muted">
            {(['exact', 'piece', 'square', 'miss'] as Grade[]).map(grade => (
                <li key={grade} className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-sm border ${GRADE_CLASS[grade]}`} aria-hidden="true" />
                    {t.grades[grade]}
                </li>
            ))}
        </ul>
    );

    const { share, copied } = useShare(() => buildExpertShareText(state, challengeNumber, openingName, t.expertTag, contrast));
    const won = state.status === 'won';

    const panel = playing ? (
        <div className="card overflow-hidden flex flex-col animate-rise">
            <div className="px-5 py-3.5 bg-surface-2 border-b border-line flex items-center justify-between gap-2">
                <span className="eyebrow">{t.expertTitle}</span>
                <span className="text-xs font-semibold tabular-nums text-ink-muted">{fill(t.attempt, { n: attemptNumber, max: EXPERT_ATTEMPTS })}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                <p aria-live="polite" className="font-semibold">{statusText}</p>
                {state.attempts.length === 0 && <p className="text-sm text-ink-muted leading-relaxed">{t.expertIntro}</p>}
                {grid}
                {legend}
            </div>
            <div className="shrink-0 grid grid-cols-[auto_1fr] gap-2 p-4 border-t border-line bg-surface-2">
                <button onClick={takeBack} disabled={!playerMoves.length} className="btn btn-quiet px-4 py-2.5 text-sm" aria-label={t.takeBack} title={t.takeBack}>
                    <Undo2 size={16} aria-hidden="true" />
                </button>
                <button onClick={submit} disabled={!complete} className="btn btn-primary py-2.5 text-sm">
                    <Send size={16} aria-hidden="true" /> {t.submit}
                </button>
            </div>
        </div>
    ) : (
        <section aria-labelledby="expert-result" className="card flex flex-col overflow-hidden animate-rise">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
                <div className="text-center space-y-1">
                    <p className={`eyebrow ${won ? '' : 'text-bad'}`}>{t.expertTitle} · {fill(t.challengeNumber, { n: challengeNumber })}</p>
                    <h2 id="expert-result" className="font-display text-2xl font-semibold">{won ? t.expertWon : t.expertLost}</h2>
                    <p className="text-sm text-ink-muted">
                        {won ? fill(t.expertWonDesc, { n: state.attempts.length, max: EXPERT_ATTEMPTS }) : t.expertLostDesc}
                        {' · '}{formatClock(elapsedMs / 1000)}
                    </p>
                </div>
                {grid}
                {idea && (
                    <div className="rounded-xl border border-line p-4">
                        <h3 className="flex items-center gap-2 eyebrow mb-1.5">
                            <Lightbulb size={14} aria-hidden="true" /> {t.planTitle}
                        </h3>
                        <p className="text-sm leading-relaxed">{idea}</p>
                    </div>
                )}
                <NextTiles title={t.keepPlaying} items={next} />
            </div>
            <div className="shrink-0 space-y-2 p-4 border-t border-line bg-surface-2">
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={share} className={`btn py-2.5 text-sm ${copied ? 'bg-good text-white' : 'btn-primary'}`}>
                        {copied ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
                        {copied ? t.resultCopied : t.shareResult}
                    </button>
                    <button onClick={onStudy} className="btn btn-quiet py-2.5 text-sm">
                        <BookOpen size={16} aria-hidden="true" /> {t.studyLine}
                    </button>
                </div>
                <button onClick={onReplay} className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
                    <RotateCcw size={13} aria-hidden="true" /> {t.replay}
                </button>
            </div>
        </section>
    );

    const lastMove = pending[pending.length - 1];

    return (
        <Stage
            intro={intro}
            board={
                <div className="board-frame">
                    <div className="aspect-square">
                        <Board
                            id="expert"
                            fen={fen}
                            orientation={side === 'w' ? 'white' : 'black'}
                            lastMove={lastMove}
                            squareStyles={squareStyles}
                            onMove={play}
                            canDragPiece={square => playerTurn && ownsPiece(square)}
                            onSquareClick={handleSquareClick}
                            lang={lang}
                        />
                    </div>
                </div>
            }
            side={panel}
        />
    );
};

export default ExpertMode;
