import type { ReactNode } from 'react';

interface StageProps {
    /** Title, description and mode tabs. */
    intro: ReactNode;
    board: ReactNode;
    /** The panel next to the board (challenge, study or result). */
    side: ReactNode;
}

/**
 * Shared page layout. Mobile: a single column (intro, board, panel). Desktop:
 * the board is sized from the viewport height and the intro plus panel share
 * the column beside it, so the whole app — and the footer — fits on screen.
 */
export default function Stage({ intro, board, side }: StageProps) {
    return (
        <div className="stage">
            <div className="stage-intro">{intro}</div>
            <div className="stage-board">{board}</div>
            <div className="stage-side">{side}</div>
        </div>
    );
}

/** Placeholder with the final layout, so nothing jumps when the game loads. */
export function GameSkeleton({ label }: { label: string }) {
    return (
        <div className="w-full animate-pulse" aria-busy="true" aria-label={label}>
            <Stage
                intro={
                    <div className="flex flex-col items-center lg:items-start gap-3">
                        <div className="h-3 w-32 rounded bg-surface-2" />
                        <div className="h-10 w-3/4 rounded bg-surface-2" />
                        <div className="h-5 w-2/3 rounded bg-surface-2" />
                        <div className="h-11 w-48 rounded-full bg-surface-2 mt-2" />
                    </div>
                }
                board={<div className="aspect-square rounded-xl bg-surface-2" />}
                side={<div className="card min-h-72" />}
            />
        </div>
    );
}
