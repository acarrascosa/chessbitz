import React, { useState } from 'react';
import { HelpCircle, X, Cpu, Code2, Box, Palette } from 'lucide-react';
import { ui, defaultLang } from '../i18n/ui';

interface AboutModalProps {
    lang?: keyof typeof ui;
}

const TechBadge = ({ icon: Icon, label }: { icon: any, label: string }) => (
    <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-800 px-3 py-2 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
        <Icon size={14} className="text-amber-600 dark:text-amber-500" />
        {label}
    </div>
);

const AboutModal: React.FC<AboutModalProps> = ({ lang = defaultLang }) => {
    const [isOpen, setIsOpen] = useState(false);
    const t = ui[lang];

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="p-2 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                title={t.aboutTitle}
            >
                <HelpCircle size={20} />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Modal */}
                    <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl p-6 md:p-8 max-w-lg w-full relative z-10 border border-stone-200 dark:border-stone-700 animate-[scaleIn_0.3s_ease-out] overflow-hidden">

                        {/* Decorative header */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 to-amber-700" />

                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-full text-amber-600 dark:text-amber-500">
                                    <Code2 size={28} />
                                </div>
                                <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
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
                </div>
            )}
        </>
    );
};

export default AboutModal;
