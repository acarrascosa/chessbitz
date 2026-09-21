import React, { useMemo } from 'react';
import { getDailyOpening } from '../lib/openings';
import ChessBoardWrapper from './ChessBoardWrapper';
import { defaultLang, type Lang } from '../i18n/ui';

interface DailyManagerProps {
    lang?: Lang;
}

const DailyManager: React.FC<DailyManagerProps> = ({ lang = defaultLang }) => {
    // Rendered client-only: the daily opening depends on the viewer's local date.
    const opening = useMemo(() => getDailyOpening(new Date()), []);
    const content = opening.content[lang];

    return (
        <div className="w-full flex flex-col items-center">
            <header className="text-center space-y-4 mb-8">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-stone-800 dark:text-stone-100 drop-shadow-sm">
                    {content.name}
                </h1>
                <p className="text-lg md:text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed border-l-4 border-amber-500 pl-4 py-1 bg-stone-400/10 dark:bg-stone-800/20 italic">
                    {content.description}
                </p>
            </header>

            <ChessBoardWrapper
                pgn={opening.pgn}
                explanations={content.explanations}
                openingName={content.name}
                lang={lang}
            />
        </div>
    );
};

export default DailyManager;
