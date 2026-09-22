import React, { useEffect, useState } from 'react';
import { fetchSummary, type Summary } from '../lib/stats-api';
import type { Lang } from '../i18n/ui';

interface SummaryStatsProps {
    lang: Lang;
    labels: { plays: string; days: string };
}

/** Live all-time totals from the Worker; hidden when the API isn't there (local dev). */
const SummaryStats: React.FC<SummaryStatsProps> = ({ lang, labels }) => {
    const [summary, setSummary] = useState<Summary | null>(null);
    useEffect(() => {
        fetchSummary().then(setSummary);
    }, []);
    if (!summary?.plays) return null;
    return (
        <>
            {([[summary.plays, labels.plays], [summary.days, labels.days]] as const).map(([value, label]) => (
                <div key={label} className="rounded-xl border border-line bg-surface p-4 text-center flex flex-col-reverse gap-1">
                    <p className="text-xs uppercase tracking-[0.14em] font-bold text-ink-muted">{label}</p>
                    <p className="font-display text-3xl font-semibold tabular-nums">{value.toLocaleString(lang)}</p>
                </div>
            ))}
        </>
    );
};

export default SummaryStats;
