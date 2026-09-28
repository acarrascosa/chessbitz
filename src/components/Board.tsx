import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Chessboard, type Arrow } from 'react-chessboard';
import { Chess, type Square } from 'chess.js';
import { fill, ui, defaultLang, type Lang } from '../i18n/ui';

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
    /** Tap-to-move. Also what Enter does on the keyboard cursor, which makes the board playable without a mouse. */
    onSquareClick?: (square: Square) => void;
    /** The square picked for tap-to-move, announced to screen readers. */
    selected?: Square | null;
    lang?: Lang;
}

const LAST_MOVE_STYLE = { boxShadow: 'inset 0 0 0 100vmax rgba(214, 170, 60, 0.42)' };
const NOTATION = { fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '0.7rem' };
/** Keyboard cursor: a dark and a light ring, visible on both square colours and over pieces. */
const CURSOR_RING = 'inset 0 0 0 3px #10160f, inset 0 0 0 5px rgba(255, 255, 255, 0.85)';
const FILES = 'abcdefgh';

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
 * react-chessboard renders each piece inside an unnamed, focusable role="button"
 * drag handle (dnd-kit) and announces drags in English. Name the pieces
 * ("black knight, g8") so screen readers can read the board, take them out of the
 * tab order (the board itself is the keyboard control) and silence dnd-kit's
 * English announcements.
 */
function usePieceAccessibility(ref: React.RefObject<HTMLDivElement | null>, lang: Lang) {
    useEffect(() => {
        const root = ref.current;
        if (!root) return;
        const names = ui[lang].pieceNames;
        const patch = () => {
            root.querySelectorAll<HTMLElement>('[data-piece]').forEach(piece => {
                const handle = piece.closest('[aria-roledescription]');
                if (!handle) return;
                const text = `${names[piece.dataset.piece ?? ''] ?? ''}, ${piece.id.split('-').pop()}`;
                if (handle.getAttribute('aria-label') !== text) handle.setAttribute('aria-label', text);
                if (handle.hasAttribute('tabindex')) handle.removeAttribute('tabindex');
                if (handle.hasAttribute('aria-describedby')) handle.removeAttribute('aria-describedby');
            });
            document.querySelectorAll('[id^="DndLiveRegion-"]').forEach(region => region.setAttribute('aria-hidden', 'true'));
        };
        patch();
        // The library re-renders pieces on its own (e.g. after animations).
        const observer = new MutationObserver(patch);
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['tabindex', 'aria-describedby'] });
        return () => observer.disconnect();
    }, [ref, lang]);
}

/** The square one step away in screen directions, seen from the player's side. */
function step(square: Square, key: string, orientation: 'white' | 'black'): Square {
    const forward = orientation === 'white' ? 1 : -1;
    const file = FILES.indexOf(square[0]) + (key === 'ArrowRight' ? forward : key === 'ArrowLeft' ? -forward : 0);
    const rank = Number(square[1]) + (key === 'ArrowUp' ? forward : key === 'ArrowDown' ? -forward : 0);
    return `${FILES[Math.min(7, Math.max(0, file))]}${Math.min(8, Math.max(1, rank))}` as Square;
}

export default function Board({ id, fen, orientation = 'white', lastMove, squareStyles = {}, arrows = [], onMove, canDragPiece, onSquareClick, selected = null, lang = defaultLang }: BoardProps) {
    const t = ui[lang];
    const ref = useRef<HTMLDivElement>(null);
    const canAnimate = useCanAnimate(ref);
    usePieceAccessibility(ref, lang);

    // Keyboard play: arrows move a cursor over the squares, Enter/Space "taps" the square under it.
    const [cursor, setCursor] = useState<Square | null>(null);
    const [keyboard, setKeyboard] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    const position = useMemo(() => {
        try {
            return new Chess(fen);
        } catch {
            return null;
        }
    }, [fen]);
    const targets = useMemo(
        () => new Set<string>(selected && position ? position.moves({ square: selected, verbose: true }).map(move => move.to) : []),
        [position, selected],
    );
    const pieceName = (square: Square) => {
        const piece = position?.get(square);
        return piece ? t.pieceNames[`${piece.color}${piece.type.toUpperCase()}`] : null;
    };
    const describe = (square: Square) =>
        [square, pieceName(square) ?? t.boardKeys.empty, ...(targets.has(square) ? [t.boardKeys.canMoveHere] : [])].join(', ');
    const home = lastMove?.to ?? (orientation === 'white' ? 'e2' : 'e7');

    // Only a new pick is announced here; the game's own status line says what a move did.
    useEffect(() => {
        const piece = selected && pieceName(selected);
        if (selected && piece) setAnnouncement(fill(t.boardKeys.picked, { piece, square: selected }));
    }, [selected]);

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (!onSquareClick) return;
        const current = cursor ?? home;
        if (event.key.startsWith('Arrow')) {
            const next = step(current, event.key, orientation);
            setCursor(next);
            setAnnouncement(describe(next));
        } else if (event.key === 'Enter' || event.key === ' ') {
            setCursor(current);
            onSquareClick(current);
        } else {
            return;
        }
        setKeyboard(true);
        event.preventDefault();
        event.stopPropagation();
    };

    const onFocus = (event: React.FocusEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget || !event.currentTarget.matches(':focus-visible')) return;
        setKeyboard(true);
        setAnnouncement(describe(cursor ?? home));
    };

    const styles: SquareStyles = {
        ...(lastMove ? { [lastMove.from]: LAST_MOVE_STYLE, [lastMove.to]: LAST_MOVE_STYLE } : {}),
        ...squareStyles,
    };
    if (onSquareClick && keyboard) {
        const square = cursor ?? home;
        const below = styles[square]?.boxShadow;
        styles[square] = { ...styles[square], boxShadow: below ? `${CURSOR_RING}, ${below}` : CURSOR_RING };
    }

    return (
        <div
            ref={ref}
            className="w-full h-full focus-visible:outline-offset-[-3px]"
            {...(onSquareClick && {
                role: 'application',
                tabIndex: 0,
                'aria-label': t.boardKeys.label,
                onKeyDown,
                onFocus,
                onBlur: () => setKeyboard(false),
            })}
        >
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
                            darkSquareNotationStyle: { ...NOTATION, color: 'var(--board-coord-on-dark)' },
                            lightSquareNotationStyle: { ...NOTATION, color: 'var(--board-coord-on-light)' },
                        }}
                    />
                )}
            </BoardErrorBoundary>
            {onSquareClick && <p className="sr-only" aria-live="polite" data-testid="board-announcer">{announcement}</p>}
        </div>
    );
}
