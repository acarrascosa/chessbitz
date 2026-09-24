import React from 'react';
import confetti from 'canvas-confetti';
import { ExternalLink, LogOut, RotateCcw, Trophy } from 'lucide-react';
import { Avatar } from './BattleLobby';
import { useBattleHost } from './battleHost';
import type { BattleConnection } from './useBattle';
import { outcomeEmoji, rankPlayers, type PublicRoom } from '../lib/battle';
import { lichessPuzzleUrl, puzzleGoal } from '../lib/puzzle';
import { fill, formatClock, formatDecimal, ui, type Lang } from '../i18n/ui';

interface BattleResultsProps {
    battle: BattleConnection;
    room: PublicRoom;
    lang: Lang;
    onLeave: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** Final podium, every player's boards, and the rematch button for the host. */
export default function BattleResults({ battle, room, lang, onLeave }: BattleResultsProps) {
    const t = ui[lang];
    const tb = t.battle;
    const { discord } = useBattleHost();
    const { you, send, notice } = battle;
    const ranking = rankPlayers(room.players.map(p => ({ ...p, token: '' })));
    const winner = ranking[0];
    const isHost = room.hostId === you;

    React.useEffect(() => {
        if (winner?.id !== you || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.3 } });
    }, [winner?.id, you]);

    return (
        <section className="w-full max-w-3xl mx-auto space-y-5 animate-rise lg:py-4" aria-labelledby="results-title">
            <header className="text-center space-y-2">
                <p className="eyebrow">{tb.results} · {tb.formats[room.format].name}</p>
                <h1 id="results-title" className="font-display text-4xl md:text-5xl font-semibold tracking-tight inline-flex items-center gap-3">
                    <Trophy size={36} className="text-accent" aria-hidden="true" />
                    {winner?.id === you ? tb.youWon : fill(tb.winner, { name: winner?.name ?? '' })}
                </h1>
            </header>

            <div className="card overflow-x-auto">
                <table className="w-full text-sm" data-testid="results-table">
                    <thead className="bg-surface-2 border-b border-line">
                        <tr className="text-left text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
                            <th className="px-4 py-3 font-bold" scope="col"><span className="sr-only">#</span></th>
                            <th className="py-3 font-bold" scope="col"><span className="sr-only">{tb.yourName}</span></th>
                            <th className="px-3 py-3 font-bold text-right" scope="col">{tb.colPoints}</th>
                            <th className="px-3 py-3 font-bold text-right" scope="col">{tb.colSolved}</th>
                            <th className="px-3 py-3 font-bold text-right hidden sm:table-cell" scope="col">{tb.colMistakes}</th>
                            <th className="px-4 py-3 font-bold text-right hidden sm:table-cell" scope="col">{tb.colTime}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {ranking.map((s, rank) => {
                            const player = room.players.find(p => p.id === s.id)!;
                            return (
                                <tr key={s.id} className={s.id === you ? 'bg-accent-soft/30' : ''}>
                                    <td className="px-4 py-3 text-xl w-10">{MEDALS[rank] ?? rank + 1}</td>
                                    <td className="py-3">
                                        <span className="flex items-center gap-2.5 min-w-0">
                                            <Avatar name={s.name} index={room.players.indexOf(player)} />
                                            <span className="min-w-0">
                                                <span className="block font-semibold truncate">
                                                    {s.name}{s.id === you && <span className="font-normal text-ink-muted"> ({tb.you})</span>}
                                                    {player.left && <span className="font-normal text-ink-muted"> · {tb.leftMatch}</span>}
                                                </span>
                                                <span className="block tracking-[0.1em]" aria-hidden="true">{player.results.map(outcomeEmoji).join('')}</span>
                                            </span>
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-right font-display text-xl font-semibold tabular-nums">{s.points}</td>
                                    <td className="px-3 py-3 text-right tabular-nums">{s.solved}/{room.boards.length}</td>
                                    <td className="px-3 py-3 text-right tabular-nums hidden sm:table-cell">{formatDecimal(lang, s.errors)}</td>
                                    <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{formatClock(s.ms / 1000)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <p className="px-4 py-2.5 text-xs text-ink-muted border-t border-line">{tb.boardsLegend}</p>
            </div>

            <div className="card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
                <p className="text-sm text-ink-muted">{[discord && tb.discord.posted, !isHost && tb.waitingRematch].filter(Boolean).join(' ')}</p>
                {notice && <p role="alert" className="text-sm text-bad">{tb.errors[notice]}</p>}
                <div className="flex gap-2 shrink-0">
                    {!discord && (
                        <button onClick={onLeave} className="btn btn-quiet px-4 py-2.5 text-sm">
                            <LogOut size={16} aria-hidden="true" /> {tb.leave}
                        </button>
                    )}
                    {isHost && (
                        <button onClick={() => send({ t: 'lobby' })} className="btn btn-primary px-5 py-2.5 text-sm">
                            <RotateCcw size={16} aria-hidden="true" /> {tb.rematch}
                        </button>
                    )}
                </div>
            </div>

            <details className="card overflow-hidden">
                <summary className="px-5 py-3.5 cursor-pointer eyebrow">{tb.boardsReview}</summary>
                <ol className="divide-y divide-line border-t border-line">
                    {room.boards.map((board, i) => (
                        <li key={board.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                            <span className="w-5 text-ink-muted tabular-nums">{i + 1}</span>
                            <span className="flex-1">{t.goals[puzzleGoal(board)]} <span className="text-ink-muted">· Elo {board.rating} · {formatClock(board.limit)}</span></span>
                            <a
                                href={lichessPuzzleUrl(board.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                // Discord's iframe can't open links itself: the SDK asks the client to.
                                onClick={discord ? e => {
                                    e.preventDefault();
                                    discord.openExternal(lichessPuzzleUrl(board.id));
                                } : undefined}
                                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline underline-offset-4">
                                {tb.viewPuzzle} <ExternalLink size={13} aria-hidden="true" />
                            </a>
                        </li>
                    ))}
                </ol>
            </details>
        </section>
    );
}
