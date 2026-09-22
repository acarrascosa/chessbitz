import { useEffect, useRef, useState } from 'react';

/**
 * Playing time that only runs while `running` and the page is visible, so a
 * tab left open overnight doesn't count. Starts from `initialMs` (restored
 * progress) and reports every change through `onTick`.
 */
export function useElapsed(running: boolean, initialMs: number, onTick?: (ms: number) => void) {
    const [elapsed, setElapsed] = useState(initialMs);
    const current = useRef(initialMs);
    const tick = useRef(onTick);
    tick.current = onTick;

    useEffect(() => {
        if (!running) return;
        let last = performance.now();
        const timer = setInterval(() => {
            const now = performance.now();
            const delta = document.visibilityState === 'visible' ? now - last : 0;
            last = now;
            if (!delta) return;
            current.current += delta;
            setElapsed(current.current);
            tick.current?.(current.current);
        }, 1000);
        // Hidden tabs throttle timers; never count the time spent away.
        const onVisibility = () => {
            last = performance.now();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [running]);

    const reset = () => {
        current.current = 0;
        setElapsed(0);
    };

    return [elapsed, reset] as const;
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
export function useCountdown() {
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

/** Native share sheet on touch devices, clipboard elsewhere. */
export function useShare(getText: () => string) {
    const [copied, setCopied] = useState(false);
    const share = async () => {
        const text = getText();
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
    return { share, copied };
}

/** Header panels, opened from anywhere (e.g. "Your statistics" in the result card). */
export type Panel = 'stats' | 'help' | 'settings';
const PANEL_EVENT = 'chessbitz:panel';

export const openPanel = (panel: Panel) => window.dispatchEvent(new CustomEvent<Panel>(PANEL_EVENT, { detail: panel }));

export function usePanelRequests(onOpen: (panel: Panel) => void) {
    const handler = useRef(onOpen);
    handler.current = onOpen;
    useEffect(() => {
        const listener = (event: Event) => handler.current((event as CustomEvent<Panel>).detail);
        window.addEventListener(PANEL_EVENT, listener);
        return () => window.removeEventListener(PANEL_EVENT, listener);
    }, []);
}

/** Notifies listeners (the stats panel) that saved progress changed. */
const PROGRESS_EVENT = 'chessbitz:progress';
export const notifyProgress = () => window.dispatchEvent(new Event(PROGRESS_EVENT));
export function useProgressVersion() {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        const bump = () => setVersion(v => v + 1);
        window.addEventListener(PROGRESS_EVENT, bump);
        window.addEventListener('storage', bump);
        return () => {
            window.removeEventListener(PROGRESS_EVENT, bump);
            window.removeEventListener('storage', bump);
        };
    }, []);
    return version;
}
