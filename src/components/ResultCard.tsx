import React from 'react';
import { BarChart3, BookOpen, Check, Flame, Lightbulb, RotateCcw, Share2 } from 'lucide-react';
import { useStore } from '@nanostores/react';
import GlobalStatsPanel from './GlobalStatsPanel';
import { openPanel, useCountdown, useShare } from './hooks';
import { MAX_MISTAKES, hintsUsed, resultBucket, resultGrid, type ChallengeState } from '../lib/challenge';
import { buildShareText } from '../lib/share';
import { averageMistakes, type GlobalStats } from '../lib/stats-api';
import type { Ply } from '../lib/line';
import { contrastStore } from '../store/theme';
import { fill, formatClock, formatDecimal, plural, ui, type Lang } from '../i18n/ui';

export interface NextItem {
    icon: React.ReactNode;
    label: string;
    description: string;
    onClick?: () => void;
    href?: string;
}

interface ResultCardProps {
    state: ChallengeState;
    plies: Ply[];
    challengeNumber: number;
    /** ECO code shown next to the challenge number. */
    eco: string;
    openingName: string;
    lang: Lang;
    elapsedMs: number;
    /** Daily results keep a streak and a countdown; archive replays can be played again. */
    variant: 'daily' | 'archive';
    streak?: number;
    global?: GlobalStats | null;
    /** Strategic ideas of the opening, revealed once the challenge is over. */
    idea?: string;
    onStudy: () => void;
    onReplay?: () => void;
    next?: NextItem[];
}

interface Comparison {
    label: string;
    value: string;
    average?: string;
}

function StatTile({ label, value, average, lang }: Comparison & { lang: Lang }) {
    return (
        <div className="flex-1 rounded-xl border border-line bg-surface-2/60 px-2 py-2.5 text-center flex flex-col gap-0.5 min-w-0">
            <span className="font-display text-2xl font-semibold tabular-nums leading-none">{value}</span>
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-muted mt-1">{label}</span>
            {average !== undefined && (
                <span className="text-[0.7rem] text-ink-muted tabular-nums">{fill(ui[lang].averageOf, { v: average })}</span>
            )}
        </div>
    );
}

export function NextTiles({ title, items }: { title: string; items: NextItem[] }) {
    if (!items.length) return null;
    const tileClass = 'rounded-xl border border-line bg-surface hover:bg-surface-2 hover:border-accent/50 transition-colors p-2.5 flex flex-col items-center gap-1 text-center min-w-0';
    return (
        <nav aria-label={title}>
            <h3 className="eyebrow text-center mb-2">{title}</h3>
            <ul className={`grid gap-2 ${items.length === 3 || items.length > 4 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {items.map(item => {
                    const content = (
                        <>
                            <span className="text-accent" aria-hidden="true">{item.icon}</span>
                            <span className="text-sm font-semibold leading-tight">{item.label}</span>
                            <span className="text-[0.7rem] text-ink-muted leading-tight">{item.description}</span>
                        </>
                    );
                    return (
                        <li key={item.label} className="flex">
                            {item.href
                                ? <a href={item.href} className={`${tileClass} w-full`}>{content}</a>
                                : <button onClick={item.onClick} className={`${tileClass} w-full`}>{content}</button>}
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

const ResultCard: React.FC<ResultCardProps> = ({
    state, plies, challengeNumber, eco, openingName, lang, elapsedMs, variant, streak = 0, global, idea, onStudy, onReplay, next = [],
}) => {
    const t = ui[lang];
    const contrast = useStore(contrastStore);
    const daily = variant === 'daily';
    const won = state.status === 'won';
    const hints = hintsUsed(state);
    const seconds = elapsedMs / 1000;
    const { share, copied } = useShare(() =>
        buildShareText(state, plies, challengeNumber, openingName, { streak: daily ? streak : 0, tag: daily ? undefined : t.archiveTag, contrast }));

    const comparisons: Comparison[] = [
        {
            label: t.statMistakes,
            value: won ? `${state.mistakes}/${MAX_MISTAKES}` : `✕`,
            average: global ? formatDecimal(lang, averageMistakes(global)) : undefined,
        },
        {
            label: t.statHints,
            value: String(hints),
            average: global?.averageHints != null ? formatDecimal(lang, global.averageHints) : undefined,
        },
        {
            label: t.statTime,
            value: formatClock(seconds),
            average: global?.averageSeconds != null ? formatClock(global.averageSeconds) : undefined,
        },
    ];

    return (
        <section aria-labelledby="result-title" className="card flex flex-col overflow-hidden animate-rise">
            {/* Only the details scroll on short screens; the actions below always stay visible. */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
                <div className="text-center space-y-1">
                    <p className={`eyebrow ${won ? '' : 'text-bad'}`}>
                        {daily ? '' : `${t.archiveTitle} · `}{fill(t.challengeNumber, { n: challengeNumber })} · {eco}
                    </p>
                    <h2 id="result-title" className="font-display text-2xl font-semibold">{won ? t.won : t.lost}</h2>
                    {!won && <p className="text-sm text-ink-muted">{t.lostDesc}</p>}
                    <p className="text-2xl tracking-[0.2em] pt-1" aria-hidden="true">{resultGrid(state, plies, contrast)}</p>
                </div>

                <section aria-label={t.yourGame}>
                    <h3 className="eyebrow mb-2 text-center">{t.yourGame}</h3>
                    <ul className="grid grid-cols-3 gap-2">
                        {comparisons.map(item => (
                            <li key={item.label} className="flex flex-col">
                                <StatTile {...item} lang={lang} />
                            </li>
                        ))}
                    </ul>
                </section>

                {global && (
                    <GlobalStatsPanel stats={global} bucket={resultBucket(state)} lang={lang} title={daily ? t.globalToday : t.globalThatDay} />
                )}

                {daily && (
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
                        {won && streak > 0 ? (
                            <p className="flex items-center gap-1.5">
                                <Flame size={16} className="text-accent" aria-hidden="true" />
                                <strong className="font-semibold">{plural(lang, streak, t.streakOne, t.streakOther)}</strong>
                                <span className="text-ink-muted">{fill(t.streakNext, { n: streak + 1 })}</span>
                            </p>
                        ) : (
                            <p className="text-ink-muted">{t.streakBroken}</p>
                        )}
                        <button onClick={() => openPanel('stats')} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline underline-offset-4">
                            <BarChart3 size={14} aria-hidden="true" /> {t.viewStats}
                        </button>
                    </div>
                )}

                {idea && (
                    <div className="rounded-xl border border-line p-4">
                        <h3 className="flex items-center gap-2 eyebrow mb-1.5">
                            <Lightbulb size={14} aria-hidden="true" /> {t.planTitle}
                        </h3>
                        <p className="text-sm leading-relaxed">{idea}</p>
                    </div>
                )}

                <NextTiles title={t.keepPlaying} items={next} />
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
                {daily ? <Countdown lang={lang} /> : onReplay && (
                    <button onClick={onReplay} className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
                        <RotateCcw size={13} aria-hidden="true" /> {t.replay}
                    </button>
                )}
            </div>
        </section>
    );
};

function Countdown({ lang }: { lang: Lang }) {
    const countdown = useCountdown();
    return (
        <p className="text-center text-xs text-ink-muted">
            {ui[lang].nextIn} <span className="font-semibold text-ink tabular-nums">{countdown}</span>
        </p>
    );
}

export default ResultCard;
