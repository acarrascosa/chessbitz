import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Lightbulb, Share2 } from 'lucide-react';
import MiniBars from './MiniBars';
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
    /** Strategic ideas of the opening, revealed once the challenge is over. */
    idea?: string;
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

const ResultCard: React.FC<ResultCardProps> = ({ state, plies, stats, challengeNumber, openingName, lang, onStudy, global, idea }) => {
    const t = ui[lang];
    const countdown = useCountdown();
    const [copied, setCopied] = useState(false);
    const won = state.status === 'won';
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
        <section aria-labelledby="result-title" className="card flex flex-col overflow-hidden animate-rise">
            {/* Only the details scroll on short screens; the actions below always stay visible. */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
            <div className="text-center space-y-1">
                <h2 id="result-title" className="font-display text-2xl font-semibold">{won ? t.won : t.lost}</h2>
                <p className="text-sm text-ink-muted">
                    {won ? t.wonDesc.replace('{mistakes}', String(state.mistakes)).replace('{max}', String(MAX_MISTAKES)) : t.lostDesc}
                </p>
                <p className="text-2xl tracking-[0.2em] pt-1" aria-hidden="true">{resultGrid(state, plies)}</p>
            </div>

            <dl className="grid grid-cols-4 gap-2 text-center">
                {[
                    [t.played, String(stats.played)],
                    [t.winRate, `${winRate}%`],
                    [t.streak, String(stats.currentStreak)],
                    [t.maxStreak, String(stats.maxStreak)],
                ].map(([label, value]) => (
                    <div key={label} className="flex flex-col-reverse gap-0.5">
                        <dt className="text-[0.65rem] leading-tight text-ink-muted">{label}</dt>
                        <dd className="font-display text-2xl font-semibold tabular-nums">{value}</dd>
                    </div>
                ))}
            </dl>

            <div className={`grid gap-3 ${global ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <MiniBars
                    title={t.distribution}
                    values={stats.distribution}
                    labels={stats.distribution.map((_, i) => String(i))}
                    highlight={won ? state.mistakes : undefined}
                />
                {global}
            </div>

            {idea && (
                <div className="rounded-xl border border-line p-4">
                    <h3 className="flex items-center gap-2 eyebrow mb-1.5">
                        <Lightbulb size={14} aria-hidden="true" /> {t.planTitle}
                    </h3>
                    <p className="text-sm leading-relaxed">{idea}</p>
                </div>
            )}

            </div>

            <div className="shrink-0 space-y-2 p-4 border-t border-line bg-surface-2">
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={share} className={`btn py-2.5 text-sm ${copied ? 'bg-good text-white' : 'btn-primary'}`}>
                        {copied ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
                        {copied ? t.resultCopied : t.shareResult}
                    </button>
                    <button onClick={onStudy} className="btn btn-quiet py-2.5 text-sm">
                        <BookOpen size={16} aria-hidden="true" />
                        {t.studyLine}
                    </button>
                </div>
                <p className="text-center text-xs text-ink-muted">
                    {t.nextIn} <span className="font-semibold text-ink tabular-nums">{countdown}</span>
                </p>
            </div>
        </section>
    );
};

export default ResultCard;
