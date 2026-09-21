import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Chessboard, type Arrow } from 'react-chessboard';
import type { Square } from 'chess.js';
import { ui, defaultLang, type Lang } from '../i18n/ui';

export type SquareStyles = Partial<Record<Square, React.CSSProperties>>;

interface BoardProps {
    id: string;
    fen: string;
    orientation?: 'white' | 'black';
    lastMove?: { from: Square; to: Square };
    squareStyles?: SquareStyles;
    arrows?: Arrow[];
    /** Enables drag-and-drop for pieces accepted by `canDragPiece`. Return true to keep the drop. */
    onMove?: (from: Square, to: Square) => boolean;
    canDragPiece?: (square: Square) => boolean;
    onSquareClick?: (square: Square) => void;
    lang?: Lang;
}

const LAST_MOVE_STYLE = { boxShadow: 'inset 0 0 0 100vmax rgba(214, 170, 60, 0.42)' };
const NOTATION = { fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '0.7rem' };

/**
 * react-chessboard measures square DOM nodes to animate pieces and throws
 * ("Square width not found") when a move is animated while the board has no
 * layout yet (hidden tab, first paint, zero-width container). Animations are
 * therefore only enabled once the board has a real size.
 */
function useCanAnimate(ref: React.RefObject<HTMLElement | null>) {
    const [hasSize, setHasSize] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(([entry]) => setHasSize(entry.contentRect.width > 0));
        observer.observe(el);

        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const syncMotion = () => setReducedMotion(media.matches);
        syncMotion();
        media.addEventListener('change', syncMotion);

        return () => {
            observer.disconnect();
            media.removeEventListener('change', syncMotion);
        };
    }, [ref]);

    return hasSize && !reducedMotion;
}

/** Last line of defence: if the board still throws, re-render it without animations. */
class BoardErrorBoundary extends Component<{ children: (failed: boolean) => ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.props.children(this.state.failed);
    }
}

/**
 * react-chessboard renders each piece inside an unnamed role="button" drag
 * handle; name them ("black knight, g8") so screen readers can use the board.
 */
function useAccessiblePieceNames(ref: React.RefObject<HTMLDivElement | null>, lang: Lang) {
    useEffect(() => {
        const root = ref.current;
        if (!root) return;
        const names = ui[lang].pieceNames;
        const label = () => {
            root.querySelectorAll<HTMLElement>('[data-piece]').forEach(piece => {
                const handle = piece.closest('[aria-roledescription]');
                const text = `${names[piece.dataset.piece ?? ''] ?? ''}, ${piece.id.split('-').pop()}`;
                if (handle && handle.getAttribute('aria-label') !== text) handle.setAttribute('aria-label', text);
            });
        };
        label();
        // The library re-renders pieces on its own (e.g. after animations).
        const observer = new MutationObserver(label);
        observer.observe(root, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [ref, lang]);
}

export default function Board({ id, fen, orientation = 'white', lastMove, squareStyles = {}, arrows = [], onMove, canDragPiece, onSquareClick, lang = defaultLang }: BoardProps) {
    const ref = useRef<HTMLDivElement>(null);
    const canAnimate = useCanAnimate(ref);
    useAccessiblePieceNames(ref, lang);

    const styles = {
        ...(lastMove ? { [lastMove.from]: LAST_MOVE_STYLE, [lastMove.to]: LAST_MOVE_STYLE } : {}),
        ...squareStyles,
    };

    return (
        <div ref={ref} className="w-full h-full">
            <BoardErrorBoundary>
                {(failed) => (
                    <Chessboard
                        options={{
                            id,
                            position: fen,
                            boardOrientation: orientation,
                            allowDragging: Boolean(onMove),
                            allowDrawingArrows: false,
                            arrows,
                            showAnimations: canAnimate && !failed,
                            animationDurationInMs: 200,
                            squareStyles: styles,
                            canDragPiece: canDragPiece && (({ square }) => square !== null && canDragPiece(square as Square)),
                            onPieceDrop: onMove && (({ sourceSquare, targetSquare }) =>
                                targetSquare !== null && targetSquare !== sourceSquare && onMove(sourceSquare as Square, targetSquare as Square)),
                            onSquareClick: onSquareClick && (({ square }) => onSquareClick(square as Square)),
                            darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
                            lightSquareStyle: { backgroundColor: 'var(--board-light)' },
                            darkSquareNotationStyle: { ...NOTATION, color: 'var(--board-light)' },
                            lightSquareNotationStyle: { ...NOTATION, color: 'var(--board-dark)' },
                        }}
                    />
                )}
            </BoardErrorBoundary>
        </div>
    );
}
