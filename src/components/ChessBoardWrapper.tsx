import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Info, Share2, Copy, Check, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import Board from './Board';
import { fenAt, parseLine, pairMoves, type Ply } from '../lib/line';
import { ui, defaultLang, type Lang } from '../i18n/ui';

interface ChessBoardWrapperProps {
    pgn: string;
    orientation?: 'white' | 'black';
    explanations?: string[];
    lang?: Lang;
    openingName?: string;
}

const SHARE_URL = 'https://chessbitz.com';
const AUTOPLAY_DELAY_MS = 1000;
const SHARE_MODAL_DELAY_MS = 1500;

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function celebrate() {
    if (prefersReducedMotion()) return;
    const end = Date.now() + 3000;
    const colors = ['#f59e0b', '#fbbf24', '#ffffff'];
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
    })();
}

const ChessBoardWrapper: React.FC<ChessBoardWrapperProps> = ({ pgn, orientation = 'white', explanations = [], lang = defaultLang, openingName = '' }) => {
    const t = ui[lang];
    const plies = useMemo<Ply[]>(() => {
        try {
            return parseLine(pgn);
        } catch (e) {
            console.error('Invalid PGN:', pgn, e);
            return [];
        }
    }, [pgn]);
    const moveList = useMemo(() => pairMoves(plies), [plies]);
    const lastIndex = plies.length - 1;

    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 = starting position
    const [showShareModal, setShowShareModal] = useState(false);
    const [hasCelebrated, setHasCelebrated] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // New line: reset and auto-play the first move so the board feels alive.
    useEffect(() => {
        setCurrentMoveIndex(-1);
        setHasCelebrated(false);
        setShowShareModal(false);
        if (plies.length === 0) return;
        const timer = setTimeout(() => setCurrentMoveIndex(0), AUTOPLAY_DELAY_MS);
        return () => clearTimeout(timer);
    }, [plies]);

    useEffect(() => {
        if (hasCelebrated || plies.length === 0 || currentMoveIndex !== lastIndex) return;
        setHasCelebrated(true);
        celebrate();
    }, [currentMoveIndex, lastIndex, plies.length, hasCelebrated]);

    useEffect(() => {
        if (!hasCelebrated) return;
        const timer = setTimeout(() => setShowShareModal(true), SHARE_MODAL_DELAY_MS);
        return () => clearTimeout(timer);
    }, [hasCelebrated]);

    const goTo = useCallback((index: number) => setCurrentMoveIndex(Math.max(-1, Math.min(lastIndex, index))), [lastIndex]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (showShareModal || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
    }, [goTo, lastIndex, showShareModal]);

    useEffect(() => {
        if (!showShareModal) return;
        const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setShowShareModal(false);
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showShareModal]);

    const currentPly = plies[currentMoveIndex];
    const currentExplanation = currentPly ? explanations[currentMoveIndex] : undefined;

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(SHARE_URL);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (e) {
            console.error('Clipboard unavailable:', e);
        }
    };

    const shareText = t.shareText.replace('{name}', openingName);
    const shareLinks = [
        {
            label: 'X (Twitter)',
            href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(SHARE_URL)}`,
            icon: <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>,
        },
        {
            label: 'WhatsApp',
            href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${SHARE_URL}`)}`,
            icon: <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /></svg>,
        },
        {
            label: 'Facebook',
            href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}&quote=${encodeURIComponent(shareText)}`,
            icon: <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>,
        },
        {
            label: 'LinkedIn',
            href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SHARE_URL)}`,
            icon: <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>,
        },
    ];

    const navButtonClass = 'p-3 text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-30 disabled:hover:text-stone-700 dark:disabled:hover:text-stone-300 transition-colors rounded-lg focus-visible:outline-2 focus-visible:outline-amber-500';
    const moveCellClass = (index: number) =>
        `w-full text-left py-1 px-2 rounded transition-colors font-medium focus-visible:outline-2 focus-visible:outline-amber-500 ${currentMoveIndex === index
            ? 'bg-amber-500 text-white shadow-sm'
            : 'text-stone-800 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400'}`;

    return (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start justify-center w-full relative">
            {showShareModal && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
                    <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full relative z-10 border border-stone-200 dark:border-stone-700">
                        <button onClick={() => setShowShareModal(false)} aria-label={t.close} className="absolute top-4 right-4 p-1 rounded-full text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
                            <X size={20} />
                        </button>
                        <div className="text-center space-y-6">
                            <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                                <Share2 size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 id="share-title" className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t.shareTitle}</h3>
                                <p className="text-stone-600 dark:text-stone-400 text-sm">{t.shareDesc}</p>
                            </div>
                            <div className="space-y-4">
                                <button
                                    onClick={handleCopyLink}
                                    className={`w-full flex items-center justify-center gap-2 font-semibold py-3 px-4 rounded-xl transition-all duration-300 ${isCopied
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100'}`}
                                >
                                    {isCopied ? <Check size={20} /> : <Copy size={20} />}
                                    {isCopied ? t.copied : t.copyLink}
                                </button>
                                <div className="flex justify-center gap-4 pt-2">
                                    {shareLinks.map(link => (
                                        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label}
                                            className="p-3 bg-stone-900 dark:bg-stone-100 hover:bg-stone-700 dark:hover:bg-stone-300 text-white dark:text-black rounded-full transition-transform hover:scale-110 shadow-sm">
                                            {link.icon}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Board & controls */}
            <div className="flex flex-col items-center gap-6 w-full lg:w-auto flex-shrink-0">
                <div className="w-full max-w-[450px] lg:w-[450px] aspect-square shadow-2xl rounded-sm overflow-hidden border-4 border-stone-800/80 dark:border-stone-900/50">
                    <Board id="daily" fen={fenAt(plies, currentMoveIndex)} orientation={orientation} lastMove={currentPly} />
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

export default ChessBoardWrapper;
