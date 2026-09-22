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
