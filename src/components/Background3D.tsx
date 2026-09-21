import { Suspense, lazy, useEffect, useState } from 'react';

// Three.js is ~280 KB gzipped: keep it out of the critical path entirely.
const KingScene = lazy(() => import('./KingScene'));

const WAKE_EVENTS = ['pointermove', 'pointerdown', 'scroll', 'keydown'] as const;
const IDLE_DELAY_MS = 4000;

/**
 * Decorative 3D king. Loads on the first interaction or after a few idle
 * seconds, so it never competes with the board for the main thread.
 */
const Background3D = () => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const wake = () => setReady(true);
        const timer = window.setTimeout(wake, IDLE_DELAY_MS);
        WAKE_EVENTS.forEach(event => window.addEventListener(event, wake, { once: true, passive: true }));
        return () => {
            window.clearTimeout(timer);
            WAKE_EVENTS.forEach(event => window.removeEventListener(event, wake));
        };
    }, []);

    if (!ready) return null;
    return (
        <Suspense fallback={null}>
            <KingScene />
        </Suspense>
    );
};

export default Background3D;
