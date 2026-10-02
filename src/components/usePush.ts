import { useCallback, useEffect, useState } from 'react';
import { battleToken } from './useBattle';
import { PUSH_TOPICS, type PushTopic } from '../lib/push';
import type { Lang } from '../i18n/ui';

/** Topics this browser is subscribed to (the server has the truth; this is for the switches). */
const TOPICS_KEY = 'chessbitz-push-topics';
const TOPICS_EVENT = 'chessbitz:push-topics';

export type PushProblem = 'unsupported' | 'install' | 'denied' | 'failed';

function storedTopics(): PushTopic[] {
    try {
        const saved = JSON.parse(localStorage.getItem(TOPICS_KEY) ?? '[]') as unknown;
        return Array.isArray(saved) ? PUSH_TOPICS.filter(topic => saved.includes(topic)) : [];
    } catch {
        return [];
    }
}

function storeTopics(topics: PushTopic[]) {
    try {
        localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
    } catch {
        // The subscription still works; the switches just won't remember it.
    }
    window.dispatchEvent(new Event(TOPICS_EVENT));
}

/** Why notifications can't be turned on here, if they can't. */
export function pushProblem(): PushProblem | null {
    if (typeof window === 'undefined') return 'unsupported';
    const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    // iPhone and iPad get Web Push only from the home screen app.
    if (apple && !standalone) return 'install';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return null;
}

const fromBase64Url = (value: string) => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), c => c.charCodeAt(0));
};

/** The service worker, if it registers within a few seconds (it isn't registered in local development). */
async function serviceWorker(): Promise<ServiceWorkerRegistration | null> {
    return Promise.race([navigator.serviceWorker.ready, new Promise<null>(resolve => setTimeout(() => resolve(null), 5_000))]);
}

/** Subscribes this browser to `topics` (asking for permission), or unsubscribes it when there are none. */
async function saveTopics(topics: PushTopic[], lang: Lang): Promise<PushProblem | null> {
    const registration = await serviceWorker();
    if (!registration) return 'unsupported';
    const current = await registration.pushManager.getSubscription();
    if (!topics.length) {
        if (current) {
            await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: current.endpoint }) }).catch(() => {});
            await current.unsubscribe().catch(() => {});
        }
        return null;
    }
    if ((await Notification.requestPermission()) !== 'granted') return 'denied';
    const key = await fetch('/api/push/key').then(r => (r.ok ? r.json() as Promise<{ publicKey: string }> : null)).catch(() => null);
    if (!key) return 'failed';
    const subscription = current ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(key.publicKey) }).catch(() => null);
    if (!subscription) return 'failed';
    const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), topics, lang, token: battleToken() }),
    }).catch(() => null);
    return response?.ok ? null : 'failed';
}

/** The switches for notifications: which topics are on, and turning one on or off. */
export function usePush(lang: Lang) {
    const [topics, setTopics] = useState<PushTopic[]>([]);
    const [busy, setBusy] = useState(false);
    /** What went wrong with the last attempt. */
    const [problem, setProblem] = useState<PushProblem | null>(null);
    /** Why it can't work here at all, known before trying (for the settings panel). */
    const [blocked, setBlocked] = useState<PushProblem | null>(null);

    useEffect(() => {
        setTopics(storedTopics());
        setBlocked(pushProblem());
        const sync = () => setTopics(storedTopics());
        window.addEventListener(TOPICS_EVENT, sync);
        return () => window.removeEventListener(TOPICS_EVENT, sync);
    }, []);

    const set = useCallback(async (next: PushTopic[]) => {
        const blocked = pushProblem();
        if (blocked && next.length) {
            setProblem(blocked);
            return false;
        }
        setBusy(true);
        const result = await saveTopics(next, lang);
        setBusy(false);
        setProblem(result);
        if (result) return false;
        storeTopics(next);
        setTopics(next);
        return true;
    }, [lang]);

    const toggle = (topic: PushTopic) => set(topics.includes(topic) ? topics.filter(t => t !== topic) : [...topics, topic]);
    return { topics, busy, problem, blocked, set, toggle };
}
