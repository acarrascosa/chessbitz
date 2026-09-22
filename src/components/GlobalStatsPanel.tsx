import React from 'react';
import { Users } from 'lucide-react';
import MiniBars from './MiniBars';
import { MAX_MISTAKES } from '../lib/challenge';
import { flawlessShare, type GlobalStats } from '../lib/stats-api';
import { fill, plural, ui, type Lang } from '../i18n/ui';

interface GlobalStatsPanelProps {
    stats: GlobalStats;
    /** The player's own bucket (mistakes, or MAX_MISTAKES when lost), highlighted. */
    bucket: number;
    lang: Lang;
    title: string;
}

const LABELS = [...Array.from({ length: MAX_MISTAKES }, (_, i) => String(i)), '✕'];

/** Everyone's anonymous results for the day, with the player's own column highlighted. */
const GlobalStatsPanel: React.FC<GlobalStatsPanelProps> = ({ stats, bucket, lang, title }) => {
    const t = ui[lang];
    const players = plural(lang, stats.players, t.globalPlayersOne, t.globalPlayersOther);
    return (
        <MiniBars
            title={<><Users size={13} aria-hidden="true" /> {title}</>}
            subtitle={`${players} · ${fill(t.globalFirstTry, { p: flawlessShare(stats) })}`}
            values={[...stats.distribution, stats.lost]}
            labels={LABELS}
            names={LABELS.map((label, i) => (i === MAX_MISTAKES ? t.lostBucket : `${label} ${t.statMistakes.toLowerCase()}`))}
            highlight={bucket}
        />
    );
};

export default GlobalStatsPanel;
