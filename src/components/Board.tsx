import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';

interface BoardProps {
    id: string;
    fen: string;
    orientation?: 'white' | 'black';
    lastMove?: { from: Square; to: Square };
}

const LAST_MOVE_STYLE = { backgroundColor: 'rgba(245, 158, 11, 0.45)' };

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

export default function Board({ id, fen, orientation = 'white', lastMove }: BoardProps) {
    const ref = useRef<HTMLDivElement>(null);
    const canAnimate = useCanAnimate(ref);

    const squareStyles = lastMove ? { [lastMove.from]: LAST_MOVE_STYLE, [lastMove.to]: LAST_MOVE_STYLE } : {};

    return (
        <div ref={ref} className="w-full h-full">
            <BoardErrorBoundary>
                {(failed) => (
                    <Chessboard
                        options={{
                            id,
                            position: fen,
                            boardOrientation: orientation,
                            allowDragging: false,
                            allowDrawingArrows: false,
                            showAnimations: canAnimate && !failed,
                            animationDurationInMs: 200,
                            squareStyles,
                            darkSquareStyle: { backgroundColor: '#57534e' },
                            lightSquareStyle: { backgroundColor: '#d6d3d1' },
                        }}
                    />
                )}
            </BoardErrorBoundary>
        </div>
    );
}
