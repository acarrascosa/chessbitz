import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { ui, type Lang } from '../i18n/ui';

// Store the global event so it persists across renders
let deferredPrompt: any = null;

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
    });
}

export default function InstallPrompt({ lang }: { lang: Lang }) {
    const [show, setShow] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Don't show if already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
            || (window.navigator as any).standalone === true;
        
        // Don't show if dismissed before
        const dismissed = localStorage.getItem('install-prompt-dismissed');
        
        if (isStandalone || dismissed) return;

        // Detect iOS to show manual instructions instead of a button
        const ua = window.navigator.userAgent;
        const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
        setIsIOS(isIOSDevice);

        // We show the prompt if it's iOS (since it has no event), or if we captured the event
        if (isIOSDevice || deferredPrompt) {
            setShow(true);
        } else {
            // Event might fire late, wait a bit
            const check = setInterval(() => {
                if (deferredPrompt) {
                    setShow(true);
                    clearInterval(check);
                }
            }, 500);
            return () => clearInterval(check);
        }
    }, []);

    if (!show) return null;

    const t = ui[lang];

    const dismiss = () => {
        localStorage.setItem('install-prompt-dismissed', '1');
        setShow(false);
    };

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            dismiss();
        }
        deferredPrompt = null;
    };

    return (
        <div className="rounded-xl border border-line bg-surface-2 p-3 mt-4 flex items-center justify-between gap-3 text-sm relative animate-fade-in">
            <button 
                onClick={dismiss} 
                className="absolute top-1.5 right-1.5 text-ink-muted hover:text-ink p-1"
                aria-label="Cerrar"
            >
                <X size={14} aria-hidden="true" />
            </button>
            <div className="flex-1 pr-6">
                <p className="font-semibold text-accent leading-tight mb-0.5">{t.installPrompt}</p>
                {isIOS && <p className="text-xs text-ink-muted leading-tight">{t.installPromptIOS}</p>}
            </div>
            {!isIOS && (
                <button onClick={handleInstall} className="shrink-0 btn btn-quiet px-2.5 py-1.5 text-xs h-8">
                    <Download size={14} aria-hidden="true" />
                    {t.installAction}
                </button>
            )}
        </div>
    );
}
