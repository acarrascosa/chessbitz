import React, { useEffect, useMemo, useState } from 'react';
import OpeningGame from './OpeningGame';
import { GameSkeleton } from './Stage';
import { dailyDataUrl, fetchOpening, getDailySlot, type Opening } from '../lib/openings';
import { getRotationIndex } from '../lib/daily';
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
        const request = preload?.index === slot.index ? preload.promise : fetchOpening(slot.index);
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

    // With the service worker active, fetching tomorrow's opening now caches it for offline play.
    useEffect(() => {
        if (load.status !== 'ready' || !navigator.serviceWorker?.controller) return;
        fetch(dailyDataUrl(getRotationIndex(slot.day + 1, count))).catch(() => {});
    }, [load.status, slot.day, count]);

    if (load.status === 'error') {
        return <p role="alert" className="py-24 text-center text-ink-muted">{t.loadError}</p>;
    }
    if (load.status === 'loading') return <GameSkeleton label={t.loading} />;
    return <OpeningGame day={slot.day} opening={load.opening} lang={lang} variant="daily" />;
};

export default DailyManager;
