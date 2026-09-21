import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ui, defaultLang, type Lang } from '../i18n/ui';

interface Props {
    lang?: Lang;
}

const STORAGE_KEY = 'chessbitz-onboarded';

const Onboarding: React.FC<Props> = ({ lang = defaultLang }) => {
    const [isVisible, setIsVisible] = useState(false);
    const t = ui[lang];

    useEffect(() => {
        let seen = true;
        try {
            seen = localStorage.getItem(STORAGE_KEY) !== null;
        } catch {
            // Storage unavailable: skip the welcome message rather than showing it every visit.
        }
        if (seen) return;
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        try {
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch {
            // Nothing to persist.
        }
    };

    if (!isVisible) return null;

    return createPortal(
        <div className="fixed top-4 inset-x-4 md:inset-x-auto md:top-auto md:bottom-6 md:right-6 z-[90] md:max-w-sm animate-rise">
            <div role="status" className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                    <h2 className="font-display text-xl font-semibold">{t.onboardingTitle}</h2>
                    <button onClick={handleDismiss} aria-label={t.close} className="text-ink-muted hover:text-ink p-1 -m-1 rounded-full">
                        <X size={18} />
                    </button>
                </div>
                <p className="text-sm text-ink-muted leading-relaxed">{t.onboardingText}</p>
                <button onClick={handleDismiss} className="btn btn-primary mt-1 py-2.5 text-sm">
                    {t.onboardingCta}
                </button>
            </div>
        </div>,
        document.body
    );
};

export default Onboarding;
