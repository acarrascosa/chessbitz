import React, { useEffect, useState } from 'react';
import { Coffee, X } from 'lucide-react';
import { GAME_FINISHED_EVENT } from './hooks';
import { markShown, markSupported, recordGame, recordView, shouldAsk } from '../lib/support';
import { ui, type Lang } from '../i18n/ui';

interface SupportPromptProps {
    lang: Lang;
    /** Pages without a game in progress, where the note can appear right on arrival. */
    idlePage: boolean;
}

export const COFFEE_URL = 'https://buymeacoffee.com/acarrascosa';
const SHOW_AFTER_GAME_MS = 3000;

/** A small, dismissible note asking for a coffee, shown only at natural pauses. */
const SupportPrompt: React.FC<SupportPromptProps> = ({ lang, idlePage }) => {
    const t = ui[lang];
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const show = (delay: number) => {
            clearTimeout(timer);
            timer = setTimeout(function attempt() {
                // Wait for other dialogs (the guide, settings) to close first.
                if (document.querySelector('[role="dialog"]')) {
                    timer = setTimeout(attempt, 2000);
                    return;
                }
                markShown();
                setVisible(true);
            }, delay);
        };

        const state = recordView();
        const isArchiveDay = new URLSearchParams(window.location.search).has('day');
        if (idlePage && !isArchiveDay && shouldAsk(state)) show(1500);

        const onFinished = () => {
            if (shouldAsk(recordGame())) show(SHOW_AFTER_GAME_MS);
        };
        window.addEventListener(GAME_FINISHED_EVENT, onFinished);
        return () => {
            clearTimeout(timer);
            window.removeEventListener(GAME_FINISHED_EVENT, onFinished);
        };
    }, [idlePage]);

    if (!visible) return null;

    return (
        <aside
            aria-labelledby="support-title"
            className="fixed z-[90] bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm card bg-surface p-5 animate-rise"
        >
            <div className="flex items-start gap-3">
                <span className="shrink-0 w-10 h-10 rounded-full bg-accent-soft text-ink flex items-center justify-center" aria-hidden="true">
                    <Coffee size={20} />
                </span>
                <div className="min-w-0 space-y-1.5">
                    <h2 id="support-title" className="font-display text-lg font-semibold leading-tight">{t.supportTitle}</h2>
                    <p className="text-sm text-ink-muted leading-relaxed">{t.supportText}</p>
                </div>
                <button onClick={() => setVisible(false)} aria-label={t.close} className="shrink-0 -m-1 p-1 rounded-full text-ink-muted hover:text-ink">
                    <X size={18} aria-hidden="true" />
                </button>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 mt-4">
                <a
                    href={COFFEE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                        markSupported();
                        setVisible(false);
                    }}
                    className="btn btn-primary py-2.5 text-sm"
                >
                    <Coffee size={16} aria-hidden="true" /> {t.buyMeCoffee}
                </a>
                <button onClick={() => setVisible(false)} className="btn btn-quiet px-4 py-2.5 text-sm">{t.supportLater}</button>
            </div>
        </aside>
    );
};

export default SupportPrompt;
