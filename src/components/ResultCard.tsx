import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Share2 } from 'lucide-react';
import { MAX_MISTAKES, resultGrid, type ChallengeState } from '../lib/challenge';
import { buildShareText } from '../lib/share';
import type { Ply } from '../lib/line';
import type { Stats } from '../lib/progress';
import { ui, type Lang } from '../i18n/ui';

interface ResultCardProps {
    state: ChallengeState;
    plies: Ply[];
    stats: Stats;
    challengeNumber: number;
    openingName: string;
    lang: Lang;
    onStudy: () => void;
    /** Optional block with today's global statistics. */
    global?: React.ReactNode;
}

function msUntilLocalMidnight(now = new Date()) {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return midnight.getTime() - now.getTime();
}

function formatDuration(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return [total / 3600, (total % 3600) / 60, total % 60].map(n => String(Math.floor(n)).padStart(2, '0')).join(':');
}

/** Time left until the next daily opening; reloads the page when it arrives. */
function useCountdown() {
    const [remaining, setRemaining] = useState(msUntilLocalMidnight);
    useEffect(() => {
        const timer = setInterval(() => {
            const next = msUntilLocalMidnight();
            if (next > remaining) window.location.reload();
            setRemaining(next);
        }, 1000);
        return () => clearInterval(timer);
    }, [remaining]);
    return formatDuration(remaining);
}

const ResultCard: React.FC<ResultCardProps> = ({ state, plies, stats, challengeNumber, openingName, lang, onStudy, global }) => {
    const t = ui[lang];
    const countdown = useCountdown();
    const [copied, setCopied] = useState(false);
    const won = state.status === 'won';
    const maxWins = Math.max(1, ...stats.distribution);
    const winRate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;

    const share = async () => {
        const text = buildShareText(state, plies, stats.currentStreak, challengeNumber, openingName);
        const canNativeShare = typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;
        try {
            if (canNativeShare) {
                await navigator.share({ text });
            } else {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch {
            // Share sheet dismissed or clipboard blocked: nothing to do.
        }
    };

    return (
        <section aria-labelledby="result-title" className="card p-6 flex flex-col gap-6 lg:min-h-[496px] animate-rise">
            <div className="text-center space-y-2">
                <h2 id="result-title" className="font-display text-2xl font-semibold">{won ? t.won : t.lost}</h2>
                <p className="text-sm text-ink-muted">
                    {won ? t.wonDesc.replace('{mistakes}', String(state.mistakes)).replace('{max}', String(MAX_MISTAKES)) : t.lostDesc}
                </p>
                <p className="text-2xl tracking-[0.2em] pt-1" aria-hidden="true">{resultGrid(state, plies)}</p>
            </div>

            <dl className="grid grid-cols-4 gap-2 text-center">
                {[
                    [t.played, stats.played],
                    [t.winRate, winRate],
                    [t.streak, stats.currentStreak],
                    [t.maxStreak, stats.maxStreak],
                ].map(([label, value]) => (
                    <div key={label} className="flex flex-col-reverse gap-1">
                        <dt className="text-[0.65rem] leading-tight text-ink-muted">{label}</dt>
                        <dd className="font-display text-3xl font-semibold tabular-nums">{value}</dd>
                    </div>
                ))}
            </dl>

            <div>
                <h3 className="eyebrow mb-3">{t.distribution}</h3>
                <ol className="space-y-1.5">
                    {stats.distribution.map((count, mistakes) => (
                        <li key={mistakes} className="flex items-center gap-2 text-xs">
                            <span className="w-3 text-ink-muted tabular-nums">{mistakes}</span>
                            <span
                                className={`h-5 rounded flex items-center justify-end px-1.5 font-semibold min-w-[1.5rem] transition-[width] duration-700 ${won && mistakes === state.mistakes ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-ink-muted'}`}
                                style={{ width: `${(count / maxWins) * 100}%` }}
                            >
                                {count}
                            </span>
                        </li>
                    ))}
                </ol>
            </div>

            {global}

            <div className="mt-auto space-y-3">
                <button onClick={share} className={`btn w-full py-3 ${copied ? 'bg-good text-white' : 'btn-primary'}`}>
                    {copied ? <Check size={18} aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}
                    {copied ? t.resultCopied : t.shareResult}
                </button>
                <button onClick={onStudy} className="btn btn-quiet w-full py-2.5">
                    <BookOpen size={18} aria-hidden="true" />
                    {t.studyLine}
                </button>
                <p className="text-center text-xs text-ink-muted">
                    {t.nextIn} <span className="font-semibold text-ink tabular-nums">{countdown}</span>
                </p>
            </div>
        </section>
    );
};

export default ResultCard;
