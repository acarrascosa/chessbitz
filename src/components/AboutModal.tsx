import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, Cpu, Code2, Box, Palette } from 'lucide-react';
import { ui, defaultLang, type Lang } from '../i18n/ui';

interface AboutModalProps {
    lang?: Lang;
}

const TechBadge = ({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>, label: string }) => (
    <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-800 px-3 py-2 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
        <Icon size={14} className="text-amber-600 dark:text-amber-500" />
        {label}
    </div>
);

const AboutModal: React.FC<AboutModalProps> = ({ lang = defaultLang }) => {
    const [isOpen, setIsOpen] = useState(false);
    const t = ui[lang];

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen]);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="p-2 rounded-full bg-stone-200/50 dark:bg-stone-800/50 hover:bg-stone-300 dark:hover:bg-stone-700 backdrop-blur-sm transition-colors border border-stone-300 dark:border-stone-600 text-stone-800 dark:text-amber-400 cursor-pointer"
                title={t.aboutTitle}
                aria-label={t.aboutTitle}
            >
                <HelpCircle size={20} />
            </button>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Modal */}
                    <div role="dialog" aria-modal="true" aria-labelledby="about-title" className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl p-6 md:p-8 max-w-lg w-full relative z-10 border border-stone-200 dark:border-stone-700 animate-[scaleIn_0.3s_ease-out] overflow-hidden">

                        {/* Decorative header */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-amber-700" />

                        <button
                            onClick={() => setIsOpen(false)}
                            aria-label={t.close}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-full text-amber-600 dark:text-amber-500">
                                    <Code2 size={28} />
                                </div>
                                <h3 id="about-title" className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                                    {t.aboutTitle}
                                </h3>
                            </div>

                            <p className="text-stone-600 dark:text-stone-400 leading-relaxed text-sm md:text-base">
                                {t.aboutDesc}
                            </p>

                            <div className="space-y-3">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-500">
                                    {t.techStack}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    <TechBadge icon={Cpu} label="Astro 5.0" />
                                    <TechBadge icon={Code2} label="React 19" />
                                    <TechBadge icon={Box} label="Three.js (R3F)" />
                                    <TechBadge icon={Palette} label="Tailwind CSS 4" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-5 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm"
                            >
                                {t.close}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default AboutModal;
