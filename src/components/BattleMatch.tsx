import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { CheckCircle2, Clock, Flag, Hourglass, Swords, XCircle } from 'lucide-react';
import ChallengeMode from './ChallengeMode';
import { Avatar } from './BattleLobby';
import { useTicker, type BattleConnection } from './useBattle';
import {
    MAX_HINT_LEVEL, challengeReducer, createChallenge, type ChallengeAction, type ChallengeState,
} from '../lib/challenge';
import { POINTS, outcomeEmoji, rankPlayers, type BattleBoard, type BoardResult, type PublicPlayer, type PublicRoom } from '../lib/battle';
import { puzzleGoal, puzzlePlies, puzzleSide } from '../lib/puzzle';
import { fill, formatClock, ui, type Lang } from '../i18n/ui';

interface BattleMatchProps {
    battle: BattleConnection;
    room: PublicRoom;
    lang: Lang;
    onLeave: () => void;
}

function ForfeitButton({ lang, onLeave }: { lang: Lang; onLeave: () => void }) {
    const t = ui[lang].battle;
    return (
        <button
            onClick={() => window.confirm(t.forfeitConfirm) && onLeave()}
            className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-bad"
        >
            <Flag size={13} aria-hidden="true" /> {t.forfeit}
        </button>
    );
}

/** Re-renders once the server clock passes `at`, for phase changes (countdown, transitions, deadlines). */
function useReachedAt(at: number, serverNow: () => number): boolean {
    const [, force] = useState(0);
    const reached = serverNow() >= at;
    useEffect(() => {
        if (reached) return;
        const timer = setTimeout(() => force(n => n + 1), Math.max(0, at - serverNow()) + 20);
        return () => clearTimeout(timer);
    }, [at, reached, serverNow]);
    return reached;
}

const PIP: Record<string, string> = { clean: 'bg-good', mistakes: 'bg-warn', lost: 'bg-bad', timeout: 'bg-bad/60' };
const pipClass = (r: BoardResult) => PIP[r.outcome === 'won' ? (r.mistakes || r.hints ? 'mistakes' : 'clean') : r.outcome];

/** Live standings: points and a pip per board. */
export function Standings({ room, you, lang }: { room: PublicRoom; you: string; lang: Lang }) {
    const t = ui[lang].battle;
    const ranking = rankPlayers(room.players.map(p => ({ ...p, token: '' })));
    return (
        <div className="space-y-2" data-testid="standings">
            <h2 className="eyebrow">{t.race}</h2>
            <ol className="space-y-1.5">
                {ranking.map((s, rank) => {
                    const player = room.players.find(p => p.id === s.id)!;
                    const index = room.players.indexOf(player);
                    return (
                        <li key={s.id} className={`flex items-center gap-2 text-sm ${player.left ? 'opacity-50' : ''}`}>
                            <span className="w-4 text-ink-muted tabular-nums text-xs">{rank + 1}</span>
                            <span className="scale-75 -mx-1"><Avatar name={s.name} index={index} /></span>
                            <span className={`flex-1 min-w-0 truncate ${s.id === you ? 'font-bold' : 'font-medium'}`}>
                                {s.name}
                                {player.left && <span className="text-xs text-ink-muted"> · {t.leftMatch}</span>}
                                {!player.left && !player.online && <span className="text-xs text-ink-muted"> · {t.offline}</span>}
                            </span>
                            <span className="flex gap-0.5" aria-hidden="true">
                                {room.boards.map((_, i) => {
                                    const result = player.results[i];
                                    const current = i === player.board;
                                    return (
                                        <span
                                            key={i}
                                            className={`w-1.5 rounded-full ${result ? `h-3 ${pipClass(result)}` : current ? 'h-3 bg-ink animate-pulse' : 'h-2 self-center bg-line'}`}
                                        />
                                    );
                                })}
                            </span>
                            <span className="w-14 text-right font-semibold tabular-nums">{s.points} <span className="text-xs font-normal text-ink-muted">{t.pts}</span></span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

/** Seconds left on the current board, with a bar that empties. */
function BoardClock({ deadline, limit, serverNow, lang }: { deadline: number; limit: number; serverNow: () => number; lang: Lang }) {
    useTicker(true, 250);
    const left = Math.max(0, deadline - serverNow()) / 1000;
    const urgent = left <= 10;
    return (
        <div className="space-y-1.5" role="timer" aria-label={ui[lang].battle.timeLeft}>
            <div className={`flex items-center justify-center lg:justify-start gap-2 font-display text-3xl font-semibold tabular-nums ${urgent ? 'text-bad' : ''}`}>
                <Clock size={22} aria-hidden="true" />
                <span data-testid="board-clock">{formatClock(Math.ceil(left))}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className={`h-full rounded-full transition-[width] duration-300 ease-linear ${urgent ? 'bg-bad' : 'bg-brand'}`} style={{ width: `${(left / limit) * 100}%` }} />
            </div>
        </div>
    );
}

function Countdown({ startsAt, serverNow, lang }: { startsAt: number; serverNow: () => number; lang: Lang }) {
    useTicker(true, 100);
    const seconds = Math.max(1, Math.ceil((startsAt - serverNow()) / 1000));
    return (
        <div className="py-16 text-center space-y-4 animate-rise" role="timer" aria-live="assertive">
            <p className="eyebrow">{ui[lang].battle.getReady}</p>
            <p key={seconds} className="font-display text-8xl font-semibold text-accent animate-rise tabular-nums">{seconds}</p>
        </div>
    );
}

export default function BattleMatch({ battle, room, lang, onLeave }: BattleMatchProps) {
    const t = ui[lang].battle;
    const { you, serverNow } = battle;
    const me = room.players.find(p => p.id === you);
    const started = useReachedAt(room.startsAt, serverNow);
    const transitionOver = useReachedAt(me?.boardStartedAt ?? 0, serverNow);

    if (!me) return null;
    if (!started) {
        return (
            <section className="w-full max-w-md mx-auto card p-5 space-y-2">
                <Countdown startsAt={room.startsAt} serverNow={serverNow} lang={lang} />
                <Standings room={room} you={you} lang={lang} />
            </section>
        );
    }

    // Between boards the finished one stays on screen with its result.
    const shown = transitionOver || me.board === 0 ? me.board : me.board - 1;
    const board = room.boards[shown];
    if (!board || me.left) {
        return (
            <section className="w-full max-w-md mx-auto card p-5 space-y-5 text-center animate-rise" aria-live="polite">
                <Hourglass size={28} className="mx-auto text-accent" aria-hidden="true" />
                <h1 className="font-display text-2xl font-semibold">{t.waitingOthers}</h1>
                <p className="text-3xl tracking-[0.15em]" aria-hidden="true">{me.results.map(outcomeEmoji).join('')}</p>
                <div className="text-left"><Standings room={room} you={you} lang={lang} /></div>
            </section>
        );
    }

    return (
        <BoardPlay
            key={shown}
            battle={battle}
            room={room}
            me={me}
            index={shown}
            board={board}
            result={me.results[shown]}
            lang={lang}
            onLeave={onLeave}
        />
    );
}

interface BoardPlayProps {
    battle: BattleConnection;
    room: PublicRoom;
    me: PublicPlayer;
    index: number;
    board: BattleBoard;
    /** Set by the server once the board is over. */
    result?: BoardResult;
    lang: Lang;
    onLeave: () => void;
}

function BoardPlay({ battle, room, me, index, board, result, lang, onLeave }: BoardPlayProps) {
    const t = ui[lang];
    const tb = t.battle;
    const { send, serverNow, you } = battle;
    const plies = useMemo(() => puzzlePlies(board), [board]);
    const reducer = useMemo(() => challengeReducer(plies), [plies]);
    // Fresh boards replay the opponent's setup move; after a reload, resume the server's progress.
    const [state, localDispatch] = useReducer(reducer, undefined, (): ChallengeState => {
        const server = me.board === index ? me.state : null;
        return server && (server.cursor > 1 || server.mistakes > 0) ? server : createChallenge(plies, puzzleSide(plies));
    });
    const deadline = me.board === index ? me.boardStartedAt + board.limit * 1000 : 0;
    const expired = useReachedAt(deadline, serverNow);

    const dispatch = useCallback((action: ChallengeAction) => {
        localDispatch(action);
        if (action.type === 'attempt') send({ t: 'move', board: index, from: action.from, to: action.to });
        if (action.type === 'hint') send({ t: 'hint', board: index });
    }, [send, index]);

    const over = result ?? (state.status !== 'playing' ? { outcome: state.status, mistakes: state.mistakes } : expired ? { outcome: 'timeout' as const, mistakes: state.mistakes } : null);
    // Out of time: freeze the board even before the server confirms.
    const shownState: ChallengeState = over && state.status === 'playing' ? { ...state, status: 'lost' } : state;
    const isLast = index === room.boards.length - 1;

    const intro = (
        <header className="text-center lg:text-left space-y-2 animate-rise">
            <p className="eyebrow">{fill(tb.boardOf, { i: index + 1, n: room.boards.length })} · Elo {board.rating}</p>
            <h1 className="font-display text-3xl md:text-4xl lg:text-[clamp(1.5rem,4svh,2.3rem)] leading-[1.05] font-semibold tracking-tight">
                {t.goals[puzzleGoal(board)]}
            </h1>
            {deadline > 0 && !over
                ? <BoardClock deadline={deadline} limit={board.limit} serverNow={serverNow} lang={lang} />
                : <div className="h-[3.1rem]" aria-hidden="true" />}
        </header>
    );

    const summary = over && (
        <section className="card flex flex-col overflow-hidden animate-rise" aria-live="polite">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
                <div className="text-center space-y-2">
                    {over.outcome === 'won'
                        ? <CheckCircle2 size={32} className="mx-auto text-good" aria-hidden="true" />
                        : over.outcome === 'timeout'
                            ? <Clock size={32} className="mx-auto text-bad" aria-hidden="true" />
                            : <XCircle size={32} className="mx-auto text-bad" aria-hidden="true" />}
                    <h2 className="font-display text-2xl font-semibold" data-testid="board-result">
                        {over.outcome === 'won'
                            ? result ? fill(tb.solved, { points: result.points }) : t.correctMove
                            : over.outcome === 'timeout' ? tb.timeout : tb.failed}
                    </h2>
                    <p className="text-sm text-ink-muted inline-flex items-center gap-1.5">
                        <Swords size={14} aria-hidden="true" /> {isLast ? tb.lastBoard : tb.nextBoard}
                    </p>
                </div>
                <Standings room={room} you={you} lang={lang} />
            </div>
        </section>
    );

    return (
        <ChallengeMode
            plies={plies}
            state={shownState}
            dispatch={dispatch}
            lang={lang}
            intro={intro}
            result={summary || undefined}
            boardId="battle"
            hintCost={s => (s.hintLevel < MAX_HINT_LEVEL ? fill(tb.hintCost, { points: POINTS.hint }) : null)}
            aside={(
                <>
                    <Standings room={room} you={you} lang={lang} />
                    <ForfeitButton lang={lang} onLeave={onLeave} />
                </>
            )}
            texts={{ yourTurn: t.tacticYourTurn, wrong: t.tacticWrong }}
        />
    );
}
