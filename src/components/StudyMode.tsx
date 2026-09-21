import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import Board from './Board';
import { fenAt, pairMoves, type Ply } from '../lib/line';
import { ui, defaultLang, type Lang } from '../i18n/ui';

interface StudyModeProps {
    plies: Ply[];
    orientation?: 'white' | 'black';
    explanations?: string[];
    lang?: Lang;
    /** Ply shown on mount; defaults to auto-playing from the start. */
    initialPly?: number;
}

const AUTOPLAY_DELAY_MS = 1000;

const StudyMode: React.FC<StudyModeProps> = ({ plies, orientation = 'white', explanations = [], lang = defaultLang, initialPly }) => {
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

    const navButtonClass = 'p-3 text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-30 disabled:hover:text-stone-700 dark:disabled:hover:text-stone-300 transition-colors rounded-lg focus-visible:outline-2 focus-visible:outline-amber-500';
    const moveCellClass = (index: number) =>
        `w-full text-left py-1 px-2 rounded transition-colors font-medium focus-visible:outline-2 focus-visible:outline-amber-500 ${currentMoveIndex === index
            ? 'bg-amber-500 text-white shadow-sm'
            : 'text-stone-800 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400'}`;

    return (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start justify-center w-full relative">
            {/* Board & controls */}
            <div className="flex flex-col items-center gap-6 w-full lg:w-auto flex-shrink-0">
                <div className="w-full max-w-[450px] lg:w-[450px] aspect-square shadow-2xl rounded-sm overflow-hidden border-4 border-stone-800/80 dark:border-stone-900/50">
                    <Board id="study" fen={fenAt(plies, currentMoveIndex)} orientation={orientation} lastMove={currentPly} />
                </div>

                <div className="w-full max-w-[450px]">
                    <div className="flex justify-center items-center gap-2 bg-stone-200/50 dark:bg-stone-800/50 backdrop-blur-sm p-2 rounded-2xl shadow-lg border border-stone-300 dark:border-stone-700">
                        <button onClick={() => goTo(-1)} disabled={currentMoveIndex === -1} className={navButtonClass} aria-label={t.start} title={t.start}>
                            <ChevronFirst size={28} />
                        </button>
                        <button onClick={() => goTo(currentMoveIndex - 1)} disabled={currentMoveIndex === -1} className={navButtonClass} aria-label={t.prev} title={t.prev}>
                            <ChevronLeft size={32} />
                        </button>
                        <button onClick={() => goTo(currentMoveIndex + 1)} disabled={currentMoveIndex === lastIndex} className={navButtonClass} aria-label={t.next} title={t.next}>
                            <ChevronRight size={32} />
                        </button>
                        <button onClick={() => goTo(lastIndex)} disabled={currentMoveIndex === lastIndex} className={navButtonClass} aria-label={t.end} title={t.end}>
                            <ChevronLast size={28} />
                        </button>
                    </div>
                    <p className="hidden md:block mt-2 text-center text-xs text-stone-500 dark:text-stone-400">{t.boardHint}</p>
                </div>
            </div>

            {/* Move list & explanation */}
            <div className="w-full lg:w-80 flex flex-col gap-4">
                <div className="bg-stone-100/80 dark:bg-stone-900/80 rounded-xl shadow-xl border border-stone-300 dark:border-stone-700 overflow-hidden flex flex-col max-h-[500px] lg:h-[500px]">
                    <div className="bg-stone-200 dark:bg-stone-800 p-4 border-b border-stone-300 dark:border-stone-700">
                        <h3 className="text-stone-800 dark:text-stone-100 font-bold text-sm uppercase tracking-wider">{t.moveList}</h3>
                    </div>

                    <ol className="flex-grow overflow-y-auto p-2 text-sm">
                        {moveList.map(pair => (
                            <li key={pair.number} className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-1 py-1 border-b border-stone-200 dark:border-stone-800 last:border-0">
                                <span className="px-2 text-stone-500 font-mono">{pair.number}.</span>
                                {[pair.white, pair.black].map((ply, side) => ply
                                    ? <button key={side} onClick={() => goTo(ply.index)} aria-current={currentMoveIndex === ply.index ? 'step' : undefined} className={moveCellClass(ply.index)}>{ply.san}</button>
                                    : <span key={side} />)}
                            </li>
                        ))}
                    </ol>

                    <div className="bg-stone-200/50 dark:bg-stone-800/50 border-t border-stone-300 dark:border-stone-700 p-4" aria-live="polite">
                        <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
                            <Info size={16} aria-hidden="true" />
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {t.analysis}{currentPly && ` · ${Math.floor(currentPly.index / 2) + 1}${currentPly.color === 'w' ? '.' : '...'} ${currentPly.san}`}
                            </span>
                        </div>
                        <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed italic min-h-[2.5rem]">
                            {currentExplanation ?? '—'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudyMode;
