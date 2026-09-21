import React, { useEffect, useMemo, useState } from 'react';
import DailyChallenge from './DailyChallenge';
import { dailyDataUrl, getDailySlot, type Opening } from '../lib/openings';
import { ui, defaultLang, type Lang } from '../i18n/ui';

interface DailyManagerProps {
    /** Number of openings in the rotation, known at build time. */
    count: number;
    lang?: Lang;
}

type Load = { status: 'loading' } | { status: 'ready'; opening: Opening } | { status: 'error' };

/**
 * Rendered client-only: the daily opening depends on the viewer's local date,
 * so only today's opening is fetched instead of shipping the whole catalog.
 */
const DailyManager: React.FC<DailyManagerProps> = ({ count, lang = defaultLang }) => {
    const t = ui[lang];
    const slot = useMemo(() => getDailySlot(count), [count]);
    const [load, setLoad] = useState<Load>({ status: 'loading' });

    useEffect(() => {
        const controller = new AbortController();
        fetch(dailyDataUrl(slot.index), { signal: controller.signal })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<Opening>;
            })
            .then(opening => setLoad({ status: 'ready', opening }))
            .catch(error => {
                if (controller.signal.aborted) return;
                console.error('Could not load the daily opening:', error);
                setLoad({ status: 'error' });
            });
        return () => controller.abort();
    }, [slot.index]);

    if (load.status === 'error') {
        return <p role="alert" className="py-24 text-center text-stone-600 dark:text-stone-400">{t.loadError}</p>;
    }
    if (load.status === 'loading') {
        return (
            <div className="w-full flex flex-col items-center gap-6 py-6 animate-pulse" aria-busy="true" aria-label={t.loading}>
                <div className="h-4 w-40 rounded bg-stone-300/60 dark:bg-stone-700/60" />
                <div className="h-10 w-2/3 max-w-md rounded bg-stone-300/60 dark:bg-stone-700/60" />
                <div className="w-full max-w-[450px] aspect-square rounded bg-stone-300/60 dark:bg-stone-700/60" />
            </div>
        );
    }
    return <DailyChallenge day={slot.day} opening={load.opening} lang={lang} />;
};

export default DailyManager;
