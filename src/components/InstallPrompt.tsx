import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { isAppleMobile } from '../lib/install';
import { ui, type Lang } from '../i18n/ui';

/** Chrome's install event (not in the DOM typings). */
interface InstallEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Kept from the first version so a dismissal isn't forgotten. */
const DISMISSED_KEY = 'install-prompt-dismissed';
const INSTALLABLE_EVENT = 'chessbitz:installable';

let deferred: InstallEvent | null = null;

// The browser offers installation once, early: keep it for the result card, and tell
// a card that is already open.
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferred = event as InstallEvent;
        window.dispatchEvent(new Event(INSTALLABLE_EVENT));
    });
}

function wasDismissed(): boolean {
    try {
        return localStorage.getItem(DISMISSED_KEY) !== null;
    } catch {
        // Storage unavailable: don't nag on every result either.
        return true;
    }
}

/** Under the daily result: add Chessbitz to the home screen, with the install button or iOS's manual steps. */
export default function InstallPrompt({ lang }: { lang: Lang }) {
    const t = ui[lang];
    const [ios, setIos] = useState(false);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
        if (standalone || wasDismissed()) return;
        const apple = isAppleMobile(navigator.userAgent, navigator.maxTouchPoints);
        setIos(apple);
        if (apple || deferred) {
            setShow(true);
            return;
        }
        const onInstallable = () => setShow(true);
        window.addEventListener(INSTALLABLE_EVENT, onInstallable);
        return () => window.removeEventListener(INSTALLABLE_EVENT, onInstallable);
    }, []);

    if (!show) return null;

    const dismiss = () => {
        try {
            localStorage.setItem(DISMISSED_KEY, '1');
        } catch {
            // Nothing to persist.
        }
        setShow(false);
    };

    const install = async () => {
        if (!deferred) return;
        const event = deferred;
        deferred = null;
        await event.prompt();
        const { outcome } = await event.userChoice;
        if (outcome === 'accepted') dismiss();
        else setShow(false);
    };

    return (
        <div className="rounded-xl border border-line bg-surface-2 p-3 mt-4 flex items-center justify-between gap-3 text-sm relative animate-fade-in">
            <button onClick={dismiss} className="absolute top-1.5 right-1.5 text-ink-muted hover:text-ink p-1" aria-label={t.close}>
                <X size={14} aria-hidden="true" />
            </button>
            <div className="flex-1 pr-6">
                <p className="font-semibold text-accent leading-tight mb-0.5">{t.installPrompt}</p>
                {ios && <p className="text-xs text-ink-muted leading-tight">{t.installPromptIOS}</p>}
            </div>
            {!ios && (
                <button onClick={install} className="shrink-0 btn btn-quiet px-2.5 py-1.5 text-xs h-8">
                    <Download size={14} aria-hidden="true" />
                    {t.installAction}
                </button>
            )}
        </div>
    );
}
