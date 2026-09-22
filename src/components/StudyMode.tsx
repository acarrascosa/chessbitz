import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Info, Lightbulb } from 'lucide-react';
import Board from './Board';
import Stage from './Stage';
import { fenAt, moveLabel, pairMoves, type Ply } from '../lib/line';
import { ui, defaultLang, type Lang } from '../i18n/ui';

interface StudyModeProps {
    plies: Ply[];
    orientation?: 'white' | 'black';
    explanations?: string[];
    lang?: Lang;
    /** Ply shown on mount; defaults to auto-playing from the start. */
    initialPly?: number;
    intro: React.ReactNode;
    /** Strategic ideas of the opening. */
    idea?: string;
}

const AUTOPLAY_DELAY_MS = 1000;

const StudyMode: React.FC<StudyModeProps> = ({ plies, orientation = 'white', explanations = [], lang = defaultLang, initialPly, intro, idea }) => {
    const t = ui[lang];
    const moveList = useMemo(() => pairMoves(plies), [plies]);
    const lastIndex = plies.length - 1;
    const [currentMoveIndex, setCurrentMoveIndex] = useState(initialPly ?? -1); // -1 = starting position

    // Auto-play the first move so the board feels alive.
    useEffect(() => {
        if (initialPly !== undefined || plies.length === 0) return;
        const timer = setTimeout(() => setCurrentMoveIndex(i => Math.max(i, 0)), AUTOPLAY_DELAY_MS);
        return () => clearTimeout(timer);
    }, [plies, initialPly]);

    const goTo = useCallback((index: number) => setCurrentMoveIndex(Math.max(-1, Math.min(lastIndex, index))), [lastIndex]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const actions: Record<string, () => void> = {
                ArrowLeft: () => setCurrentMoveIndex(i => Math.max(-1, i - 1)),
                ArrowRight: () => setCurrentMoveIndex(i => Math.min(lastIndex, i + 1)),
                Home: () => goTo(-1),
                End: () => goTo(lastIndex),
            };
            const action = actions[e.key];
            if (!action) return;
            e.preventDefault();
            action();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [goTo, lastIndex]);

    const currentPly = plies[currentMoveIndex];
    const currentExplanation = currentPly ? explanations[currentMoveIndex] : undefined;

    const navButtonClass = 'icon-btn w-9 h-9 disabled:opacity-35 disabled:hover:text-ink disabled:hover:bg-surface';
    const moveCellClass = (index: number) =>
        `w-full text-left py-1 px-2 rounded-md font-medium tabular-nums transition-colors ${currentMoveIndex === index
            ? 'bg-brand text-brand-ink'
            : 'text-ink hover:bg-surface-2'}`;

    const panel = (
        <div className="card overflow-hidden flex flex-col animate-rise">
            <div className="px-4 py-2.5 bg-surface-2 border-b border-line flex items-center justify-between gap-2">
                <h3 className="eyebrow">{t.moveList}</h3>
                <div className="flex items-center gap-1" title={t.boardHint}>
                    <button onClick={() => goTo(-1)} disabled={currentMoveIndex === -1} className={navButtonClass} aria-label={t.start} title={t.start}>
                        <ChevronFirst size={18} />
                    </button>
                    <button onClick={() => goTo(currentMoveIndex - 1)} disabled={currentMoveIndex === -1} className={navButtonClass} aria-label={t.prev} title={t.prev}>
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={() => goTo(currentMoveIndex + 1)} disabled={currentMoveIndex === lastIndex} className={navButtonClass} aria-label={t.next} title={t.next}>
                        <ChevronRight size={20} />
                    </button>
                    <button onClick={() => goTo(lastIndex)} disabled={currentMoveIndex === lastIndex} className={navButtonClass} aria-label={t.end} title={t.end}>
                        <ChevronLast size={18} />
                    </button>
                </div>
            </div>

            <ol className="flex-grow min-h-0 overflow-y-auto p-3 text-sm max-h-64 lg:max-h-none">
                {moveList.map(pair => (
                    <li key={pair.number} className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1 py-0.5">
                        <span className="px-2 text-ink-muted tabular-nums">{pair.number}.</span>
                        {[pair.white, pair.black].map((ply, side) => ply
                            ? <button key={side} onClick={() => goTo(ply.index)} aria-current={currentMoveIndex === ply.index ? 'step' : undefined} className={moveCellClass(ply.index)}>{ply.san}</button>
                            : <span key={side} />)}
                    </li>
                ))}
            </ol>

            <div className="bg-surface-2 border-t border-line p-5 space-y-4">
                <div aria-live="polite">
                    <div className="flex items-center gap-2 mb-2 eyebrow">
                        <Info size={14} aria-hidden="true" />
                        {t.analysis}{currentPly && <span className="normal-case tracking-normal"> · {moveLabel(currentPly)}</span>}
                    </div>
                    <p className="text-sm text-ink leading-relaxed min-h-[2.5rem]">{currentExplanation ?? '—'}</p>
                </div>
                {idea && (
                    <div className="pt-4 border-t border-line">
                        <h4 className="flex items-center gap-2 mb-2 eyebrow">
                            <Lightbulb size={14} aria-hidden="true" /> {t.planTitle}
                        </h4>
                        <p className="text-sm text-ink leading-relaxed">{idea}</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Stage
            intro={intro}
            board={
                <div className="board-frame">
                    <div className="aspect-square">
                        <Board id="study" fen={fenAt(plies, currentMoveIndex)} orientation={orientation} lastMove={currentPly} lang={lang} />
                    </div>
                </div>
            }
            side={panel}
        />
    );
};

export default StudyMode;
