import React, { useEffect, useMemo, useState } from 'react';
import DailyChallenge from './DailyChallenge';
import Stage from './Stage';
import { dailyDataUrl, getDailySlot, type Opening } from '../lib/openings';
import { ui, defaultLang, type Lang } from '../i18n/ui';

interface DailyManagerProps {
    /** Number of openings in the rotation, known at build time. */
    count: number;
    lang?: Lang;
}

declare global {
    interface Window {
        __dailyOpening?: { index: number; promise: Promise<Opening> };
    }
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
        let cancelled = false;
        // HomePage.astro starts this request in <head>; reuse it when it matches.
        const preload = window.__dailyOpening;
        const request = preload?.index === slot.index
            ? preload.promise
            : fetch(dailyDataUrl(slot.index)).then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<Opening>;
            });
        request
            .then(opening => !cancelled && setLoad({ status: 'ready', opening }))
            .catch(error => {
                if (cancelled) return;
                console.error('Could not load the daily opening:', error);
                setLoad({ status: 'error' });
            });
        return () => {
            cancelled = true;
        };
    }, [slot.index]);

    if (load.status === 'error') {
        return <p role="alert" className="py-24 text-center text-ink-muted">{t.loadError}</p>;
    }
    if (load.status === 'loading') {
        return (
            <div className="w-full animate-pulse" aria-busy="true" aria-label={t.loading}>
                <Stage
                    intro={
                        <div className="flex flex-col items-center lg:items-start gap-3">
                            <div className="h-3 w-32 rounded bg-surface-2" />
                            <div className="h-10 w-3/4 rounded bg-surface-2" />
                            <div className="h-5 w-2/3 rounded bg-surface-2" />
                            <div className="h-11 w-48 rounded-full bg-surface-2 mt-2" />
                        </div>
                    }
                    board={<div className="aspect-square rounded-xl bg-surface-2" />}
                    side={<div className="card min-h-72" />}
                />
            </div>
        );
    }
    return <DailyChallenge day={slot.day} opening={load.opening} lang={lang} />;
};

export default DailyManager;
