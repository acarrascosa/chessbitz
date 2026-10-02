import { Hourglass, Play, Search, X } from 'lucide-react';
import { useTicker } from './useBattle';
import type { Matchmaking } from './useMatchmaking';
import { fill, formatClock, ui, type Lang } from '../i18n/ui';

interface MatchSearchProps {
    search: Matchmaking;
    lang: Lang;
    onCancel: () => void;
}

/**
 * Looking for a public match: how long until a recorded rival steps in (said up
 * front), and the choice to play now or to wait
 * for a match that's about to free its players.
 */
export default function MatchSearch({ search, lang, onCancel }: MatchSearchProps) {
    const t = ui[lang].battle.match;
    const { status, matched, problem, send, serverNow } = search;
    useTicker(Boolean(status) && !matched, 250);
    const now = serverNow();
    const left = status ? Math.max(0, (status.waitUntil - now) / 1000) : null;

    return (
        <section className="w-full max-w-md mx-auto card p-6 space-y-5 text-center animate-rise" aria-labelledby="search-title" data-testid="match-search">
            <div className="mx-auto w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center" aria-hidden="true">
                {matched ? <Play size={26} /> : <Search size={26} className="motion-safe:animate-pulse" />}
            </div>
            <h1 id="search-title" className="font-display text-3xl font-semibold" aria-live="polite">{matched ? t.found : t.searching}</h1>

            {problem && <p role="alert" className="text-sm font-semibold text-bad">{t[problem === 'busy' ? 'busy' : 'unavailable']}</p>}

            {status && !matched && (
                <>
                    {status.waitingFor !== null && (
                        <p className="text-sm flex items-center justify-center gap-1.5">
                            <Hourglass size={14} aria-hidden="true" /> {fill(t.endsSoon, { time: formatClock((status.waitingFor - now) / 1000) })}
                        </p>
                    )}
                    <p className="text-sm text-ink-muted" role="timer" data-testid="ghost-notice">
                        {fill(t.ghostNotice, { time: formatClock(left ?? 0) })}
                    </p>
                    <div className="grid gap-2">
                        <button onClick={() => send({ t: 'ghost' })} className="btn btn-primary w-full py-3">
                            <Play size={18} aria-hidden="true" /> {t.playNow}
                        </button>
                        {status.canWaitFor !== null && (
                            <button onClick={() => send({ t: 'wait' })} className="btn btn-quiet w-full py-2.5 text-sm">
                                <Hourglass size={16} aria-hidden="true" /> {fill(t.waitFor, { time: formatClock((status.canWaitFor - now) / 1000) })}
                            </button>
                        )}
                    </div>
                </>
            )}

            {!matched && (
                <button onClick={onCancel} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-bad">
                    <X size={14} aria-hidden="true" /> {t.cancel}
                </button>
            )}
        </section>
    );
}
