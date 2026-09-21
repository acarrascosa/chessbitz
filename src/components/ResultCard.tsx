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

const ResultCard: React.FC<ResultCardProps> = ({ state, plies, stats, challengeNumber, openingName, lang, onStudy }) => {
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
        <section aria-labelledby="result-title" className="bg-stone-100/80 dark:bg-stone-900/80 rounded-xl shadow-xl border border-stone-300 dark:border-stone-700 p-5 flex flex-col gap-5 lg:min-h-[500px]">
            <div className="text-center space-y-1">
                <h2 id="result-title" className="text-xl font-black text-stone-900 dark:text-stone-100">{won ? t.won : t.lost}</h2>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                    {won ? t.wonDesc.replace('{mistakes}', String(state.mistakes)).replace('{max}', String(MAX_MISTAKES)) : t.lostDesc}
                </p>
                <p className="text-2xl tracking-widest pt-2" aria-hidden="true">{resultGrid(state, plies)}</p>
            </div>

            <dl className="grid grid-cols-4 gap-2 text-center">
                {[
                    [t.played, stats.played],
                    [t.winRate, winRate],
                    [t.streak, stats.currentStreak],
                    [t.maxStreak, stats.maxStreak],
                ].map(([label, value]) => (
                    <div key={label} className="flex flex-col-reverse">
                        <dt className="text-[0.65rem] leading-tight text-stone-500 dark:text-stone-400">{label}</dt>
                        <dd className="text-2xl font-bold text-stone-900 dark:text-stone-100">{value}</dd>
                    </div>
                ))}
            </dl>

            <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">{t.distribution}</h3>
                <ol className="space-y-1">
                    {stats.distribution.map((count, mistakes) => (
                        <li key={mistakes} className="flex items-center gap-2 text-xs">
                            <span className="w-3 font-mono text-stone-500">{mistakes}</span>
                            <span
                                className={`h-5 rounded flex items-center justify-end px-1.5 font-bold text-white min-w-[1.5rem] ${won && mistakes === state.mistakes ? 'bg-amber-500' : 'bg-stone-400 dark:bg-stone-600'}`}
                                style={{ width: `${(count / maxWins) * 100}%` }}
                            >
                                {count}
                            </span>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="mt-auto space-y-3">
                <button onClick={share} className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                    {copied ? <Check size={18} aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}
                    {copied ? t.resultCopied : t.shareResult}
                </button>
                <button onClick={onStudy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 transition-colors">
                    <BookOpen size={18} aria-hidden="true" />
                    {t.studyLine}
                </button>
                <p className="text-center text-xs text-stone-500 dark:text-stone-400">
                    {t.nextIn} <span className="font-mono font-bold text-stone-700 dark:text-stone-300">{countdown}</span>
                </p>
            </div>
        </section>
    );
};

export default ResultCard;
