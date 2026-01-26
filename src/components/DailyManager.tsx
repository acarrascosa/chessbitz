import React, { useState, useEffect } from 'react';
import { getDailyOpening } from '../utils/dailyOpening';
import ChessBoardWrapper from './ChessBoardWrapper';
import { ui, defaultLang } from '../i18n/ui';

interface DailyManagerProps {
    lang?: keyof typeof ui;
}

const DailyManager: React.FC<DailyManagerProps> = ({ lang = defaultLang }) => {
    // We use state to ensure this calculation happens on the client and triggers a render
    // Initial state matching server logic or just null to show loading?
    // Since we use client:only, we can just init.
    const [opening, setOpening] = useState(() => getDailyOpening(new Date()));
    const t = ui[lang];

    useEffect(() => {
        // Double check on mount, though useState initializer should handle it.
        // This effect is mostly useful if we wanted to auto-update at midnight without refresh,
        // but for now, simple mount logic is enough.
        setOpening(getDailyOpening(new Date()));
    }, []);

    // Get localized content (fallback to 'es' if not found, though types enforce structure)
    // Structure: opening.content.es or opening.content.en
    // Given the current structure in dailyOpening.ts/openings.json, we have content.es and content.en
    // We'll cast to 'es' | 'en' roughly or just use 'es' as safe default if lang is weird
    const content = opening.content[lang === 'en' ? 'en' : 'es'];

    return (
        <div className="w-full flex flex-col items-center">
            <header className="text-center space-y-4 mb-8">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-stone-800 dark:text-stone-100 drop-shadow-sm transition-all duration-300">
                    {content.name}
                </h1>
                <p className="text-lg md:text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed border-l-4 border-amber-500 pl-4 py-1 bg-stone-400/10 dark:bg-stone-800/20 italic transition-all duration-300">
                    "{content.description}"
                </p>
            </header>

            <div className="w-full">
                <ChessBoardWrapper
                    pgn={opening.pgn}
                    // @ts-ignore - 'explanations' might technically be missing in interface but logic handles it
                    explanations={content.explanations || []}
                    openingName={content.name}
                    lang={lang}
                />
            </div>
        </div>
    );
};

export default DailyManager;
