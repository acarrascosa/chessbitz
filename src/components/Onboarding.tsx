
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ui } from '../i18n/ui';

interface Props {
    lang?: keyof typeof ui;
}

const Onboarding: React.FC<Props> = ({ lang = 'es' }) => {
    const [isVisible, setIsVisible] = useState(false);

    // Check local storage on mount
    useEffect(() => {
        const hasOnboarded = localStorage.getItem('chessbitz-onboarded');
        if (!hasOnboarded) {
            // Delay slightly for smooth entrance
            const timer = setTimeout(() => setIsVisible(true), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('chessbitz-onboarded', 'true');
    };

    if (!isVisible) return null;

    // Portal to body to ensure it's on top of everything
    if (typeof document === 'undefined') return null;

    const t = ui[lang];

    return createPortal(
        <div className="fixed bottom-6 right-6 z-[90] max-w-sm w-[90%] md:w-auto animate-[slideInUp_0.5s_ease-out]">
            <div className="bg-white/90 dark:bg-stone-800/90 backdrop-blur-md border border-stone-200 dark:border-stone-700 shadow-2xl rounded-2xl p-6 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/20 rounded-full blur-xl animate-pulse"></div>

                <div className="relative z-10 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                        <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-lg text-amber-600 dark:text-amber-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    </div>

                    <div>
                        <h4 className="font-bold text-stone-900 dark:text-stone-100 text-lg mb-1">
                            {lang === 'es' ? '¡Bienvenido a Chessbitz!' : 'Welcome to Chessbitz!'}
                        </h4>
                        <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                            {lang === 'es'
                                ? 'Cada día encontrarás una nueva apertura de ajedrez diferente. ¡Vuelve mañana para seguir aprendiendo!'
                                : 'You will find a different chess opening every day here. Come back tomorrow to keep learning!'}
                        </p>
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="mt-2 w-full py-2 bg-stone-900 dark:bg-stone-100 hover:bg-black dark:hover:bg-white text-white dark:text-stone-900 rounded-lg font-bold text-sm transition-all active:scale-95 shadow-lg"
                    >
                        {lang === 'es' ? '¡Entendido!' : 'Got it!'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Onboarding;
