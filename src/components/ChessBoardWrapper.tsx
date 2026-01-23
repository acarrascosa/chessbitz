import React, { useState, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { ChevronLeft, ChevronRight, Info, Share2, Copy, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ui, defaultLang } from '../i18n/ui';

interface ChessBoardWrapperProps {
    pgn: string;
    orientation?: 'white' | 'black';
    explanations?: string[];
    lang?: keyof typeof ui;
    openingName?: string;
}

const ChessBoardWrapper: React.FC<ChessBoardWrapperProps> = ({ pgn, orientation = 'white', explanations = [], lang = defaultLang, openingName = "" }) => {
    const [game, setGame] = useState(new Chess());
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 means start position
    const [history, setHistory] = useState<string[]>([]);
    // Removed local uiVisible state as we now use global View Background feature in Layout
    const [showShareModal, setShowShareModal] = useState(false);
    const [hasCelebrated, setHasCelebrated] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const t = ui[lang];

    // Load PGN on mount or change
    useEffect(() => {
        try {
            const newGame = new Chess();
            newGame.loadPgn(pgn);
            setGame(newGame);

            // Get history of FENs
            const historyObjects = newGame.history({ verbose: true });
            const fenHistory = historyObjects.map(move => move.after);
            setHistory(fenHistory);

            // Reset
            setCurrentMoveIndex(-1);
            setHasCelebrated(false);
            setShowShareModal(false);

            // Auto-play first move after 1s
            if (fenHistory.length > 0) {
                const timer = setTimeout(() => {
                    setCurrentMoveIndex(0);
                }, 1000);
                return () => clearTimeout(timer);
            }

        } catch (e) {
            console.error('Invalid PGN:', e);
        }
    }, [pgn]);

    // Check for completion
    useEffect(() => {
        if (history.length > 0 && currentMoveIndex === history.length - 1 && !hasCelebrated) {
            setHasCelebrated(true);
            // Fire confetti
            const duration = 3000;
            const end = Date.now() + duration;

            (function frame() {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#f59e0b', '#fbbf24', '#ffffff']
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#f59e0b', '#fbbf24', '#ffffff']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());

            // Show modal after a small delay
            setTimeout(() => setShowShareModal(true), 1500);
        }
    }, [currentMoveIndex, history, hasCelebrated]);

    // Derive FEN directly from state to guarantee synchronization
    const currentFen = useMemo(() => {
        if (currentMoveIndex === -1 || !history[currentMoveIndex]) {
            return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        }
        return history[currentMoveIndex];
    }, [currentMoveIndex, history]);

    const goBack = () => setCurrentMoveIndex(prev => Math.max(-1, prev - 1));
    const goForward = () => setCurrentMoveIndex(prev => Math.min(history.length - 1, prev + 1));

    // Move List Generation (Memoized to avoid unnecessary recalcs)
    const moveListPairs = useMemo(() => {
        const moves = game.history({ verbose: true });
        const pairs = [];
        for (let i = 0; i < moves.length; i += 2) {
            pairs.push({
                number: Math.floor(i / 2) + 1,
                white: moves[i],
                black: moves[i + 1]
            });
        }
        return pairs;
    }, [game]);

    // Current explanation
    const currentExplanation = currentMoveIndex >= 0 && explanations && explanations[currentMoveIndex]
        ? explanations[currentMoveIndex]
        : ui[lang].analysis; // Fallback or general text

    const handleCopyLink = () => {
        navigator.clipboard.writeText("https://chessbitz.com");
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const shareText = `¡He aprendido la apertura ${openingName} gracias a Chessbitz!`;
    const shareUrl = "https://chessbitz.com";

    return (
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start justify-center w-full relative">

            {/* Celebration Modal Overlay */}
            {showShareModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
                    <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full relative z-10 border border-stone-200 dark:border-stone-700 animate-[fadeIn_0.5s_ease-out]">
                        <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
                            ✕
                        </button>
                        <div className="text-center space-y-6">
                            <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                                <Share2 size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{t.shareTitle}</h3>
                                <p className="text-stone-600 dark:text-stone-400 text-sm">
                                    {t.shareDesc}
                                </p>
                            </div>

                            <div className="space-y-4">
                                {/* Copy Link Button */}
                                <button
                                    onClick={handleCopyLink}
                                    className={`w-full flex items-center justify-center gap-2 font-semibold py-3 px-4 rounded-xl transition-all duration-300 ${isCopied
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100'
                                        }`}
                                >
                                    {isCopied ? <Check size={20} /> : <Copy size={20} />}
                                    {isCopied ? t.copied : t.copyLink}
                                </button>

                                {/* Minimalist Social Icons */}
                                <div className="flex justify-center gap-4 pt-2">
                                    {/* Twitter/X */}
                                    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-stone-900 dark:bg-stone-100 hover:bg-stone-700 dark:hover:bg-stone-300 text-white dark:text-black rounded-full transition-transform hover:scale-110 shadow-sm" title="X (Twitter)">
                                        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                                    </a>
                                    {/* WhatsApp */}
                                    <a href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-stone-900 dark:bg-stone-100 hover:bg-stone-700 dark:hover:bg-stone-300 text-white dark:text-black rounded-full transition-transform hover:scale-110 shadow-sm" title="WhatsApp">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /></svg>
                                    </a>
                                    {/* Facebook */}
                                    <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-stone-900 dark:bg-stone-100 hover:bg-stone-700 dark:hover:bg-stone-300 text-white dark:text-black rounded-full transition-transform hover:scale-110 shadow-sm" title="Facebook">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                                    </a>
                                    {/* LinkedIn */}
                                    <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-stone-900 dark:bg-stone-100 hover:bg-stone-700 dark:hover:bg-stone-300 text-white dark:text-black rounded-full transition-transform hover:scale-110 shadow-sm" title="LinkedIn">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
                                    </a>
                                    {/* Instagram */}
                                    <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="p-3 bg-stone-900 dark:bg-stone-100 hover:bg-stone-700 dark:hover:bg-stone-300 text-white dark:text-black rounded-full transition-transform hover:scale-110 shadow-sm" title="Instagram">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Board & Controls Container */}
            <div className="flex flex-col items-center gap-6 w-full lg:w-auto flex-shrink-0">
                <div className="w-full max-w-[450px] aspect-square shadow-2xl rounded-sm overflow-hidden border-4 border-stone-800/80 dark:border-stone-900/50 relative group">
                    <Chessboard
                        options={{
                            position: currentFen,
                            boardOrientation: orientation,
                            allowDragging: false,
                            darkSquareStyle: { backgroundColor: '#57534e' },
                            lightSquareStyle: { backgroundColor: '#d6d3d1' },
                            animationDurationInMs: 200
                        }}
                    />
                    {/* Removed Zen button (EyeOff) here */}
                </div>

                {/* Controls Only */}
                <div className={`w-full max-w-[450px] transition-all duration-300 opacity-100`}>
                    <div className="flex justify-center items-center gap-6 bg-stone-200/50 dark:bg-stone-800/50 backdrop-blur-sm p-3 rounded-2xl shadow-lg border border-stone-300 dark:border-stone-700">
                        <button onClick={goBack} disabled={currentMoveIndex === -1} className="p-3 text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-30 disabled:hover:text-stone-700 transition-colors" title={t.prev}>
                            <ChevronLeft size={32} />
                        </button>
                        <button onClick={goForward} disabled={currentMoveIndex === history.length - 1} className="p-3 text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-30 disabled:hover:text-stone-700 transition-colors" title={t.next}>
                            <ChevronRight size={32} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Side Panel (Move List & Explanation) */}
            <div className={`w-full lg:w-80 flex flex-col gap-4 transition-all duration-500 opacity-100`}>
                <div className={`bg-stone-100/80 dark:bg-stone-900/80 rounded-xl shadow-xl border border-stone-300 dark:border-stone-700 overflow-hidden flex flex-col h-[500px]`}>
                    <div className="bg-stone-200 dark:bg-stone-800 p-4 border-b border-stone-300 dark:border-stone-700">
                        <h3 className="text-stone-800 dark:text-stone-100 font-bold text-sm uppercase tracking-wider">{t.moveList}</h3>
                    </div>

                    {/* List */}
                    <div className="flex-grow overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-stone-400 dark:scrollbar-thumb-stone-600 scrollbar-track-transparent">
                        <table className="w-full text-sm text-left border-collapse">
                            <tbody>
                                {moveListPairs.map((pair, idx) => (
                                    <tr key={idx} className="border-b border-stone-200 dark:border-stone-800 last:border-0 hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors">
                                        <td className="py-2 px-3 text-stone-500 font-mono w-10">{pair.number}.</td>
                                        <td className={`py-2 px-3 cursor-pointer rounded transition-colors font-medium ${currentMoveIndex === (idx * 2) ? 'bg-amber-500 text-white shadow-sm' : 'text-stone-800 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400'}`}
                                            onClick={() => setCurrentMoveIndex(idx * 2)}
                                        >
                                            {pair.white.san}
                                        </td>
                                        {pair.black && (
                                            <td className={`py-2 px-3 cursor-pointer rounded transition-colors font-medium ${currentMoveIndex === (idx * 2) + 1 ? 'bg-amber-500 text-white shadow-sm' : 'text-stone-800 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400'}`}
                                                onClick={() => setCurrentMoveIndex((idx * 2) + 1)}
                                            >
                                                {pair.black.san}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Explanation Section (Fixed bottom) */}
                    <div className="bg-stone-200/50 dark:bg-stone-800/50 border-t border-stone-300 dark:border-stone-700 p-4">
                        <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
                            <Info size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">{t.analysis}</span>
                        </div>
                        <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed italic">
                            "{currentExplanation}"
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ChessBoardWrapper;
