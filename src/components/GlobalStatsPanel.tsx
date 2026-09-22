import React from 'react';
import { Users } from 'lucide-react';
import MiniBars from './MiniBars';
import { MAX_MISTAKES } from '../lib/challenge';
import { flawlessShare, type GlobalStats } from '../lib/stats-api';
import { plural, ui, type Lang } from '../i18n/ui';

interface GlobalStatsPanelProps {
    stats: GlobalStats;
    /** The player's own bucket (mistakes, or MAX_MISTAKES when lost), highlighted. */
    bucket: number;
    lang: Lang;
}

const LABELS = [...Array.from({ length: MAX_MISTAKES }, (_, i) => String(i)), '✕'];

/** Today's anonymous results from every player. */
const GlobalStatsPanel: React.FC<GlobalStatsPanelProps> = ({ stats, bucket, lang }) => {
    const t = ui[lang];
    const players = plural(lang, stats.players, t.globalPlayersOne, t.globalPlayersOther);
    return (
        <MiniBars
            title={<><Users size={13} aria-hidden="true" /> {t.globalStats}</>}
            subtitle={`${players} · ${t.globalFirstTry.replace('{p}', String(flawlessShare(stats)))}`}
            values={[...stats.distribution, stats.lost]}
            labels={LABELS}
            highlight={bucket}
        />
    );
};

export default GlobalStatsPanel;
