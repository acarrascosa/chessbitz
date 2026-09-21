import React from 'react';
import { Users } from 'lucide-react';
import { MAX_MISTAKES } from '../lib/challenge';
import { flawlessShare, type GlobalStats } from '../lib/stats-api';
import { ui, type Lang } from '../i18n/ui';

interface GlobalStatsPanelProps {
    stats: GlobalStats;
    /** The player's own bucket (mistakes, or MAX_MISTAKES when lost), highlighted. */
    bucket: number;
    lang: Lang;
}

/** Today's anonymous results from every player, as a compact column chart. */
const GlobalStatsPanel: React.FC<GlobalStatsPanelProps> = ({ stats, bucket, lang }) => {
    const t = ui[lang];
    const buckets = [...stats.distribution, stats.lost];
    const max = Math.max(1, ...buckets);

    return (
        <div className="rounded-xl bg-surface-2 border border-line p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="eyebrow flex items-center gap-1.5">
                    <Users size={14} aria-hidden="true" /> {t.globalStats}
                </h3>
                <p className="text-xs text-ink-muted">
                    {t.globalPlayers.replace('{n}', stats.players.toLocaleString(lang))} · {t.globalFirstTry.replace('{p}', String(flawlessShare(stats)))}
                </p>
            </div>
            <ol className="grid grid-cols-6 gap-1.5 items-end h-16" aria-label={t.globalStats}>
                {buckets.map((count, index) => (
                    <li key={index} className="flex flex-col items-center gap-1 h-full justify-end">
                        <span
                            className={`w-full rounded-t ${index === bucket ? 'bg-brand' : 'bg-line'}`}
                            style={{ height: `${Math.max(6, (count / max) * 100)}%` }}
                            title={String(count)}
                        />
                        <span className="text-[0.65rem] text-ink-muted tabular-nums">{index === MAX_MISTAKES ? '✕' : index}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
};

export default GlobalStatsPanel;
