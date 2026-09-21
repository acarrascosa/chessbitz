import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, Cpu, Code2, Box, Palette, Crown, Cloud } from 'lucide-react';
import { ui, defaultLang, type Lang } from '../i18n/ui';

interface AboutModalProps {
    lang?: Lang;
}

const TechBadge = ({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>, label: string }) => (
    <div className="flex items-center gap-2 bg-surface-2 px-3 py-2 rounded-lg text-xs font-semibold border border-line">
        <Icon size={14} className="text-accent" />
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
            <button onClick={() => setIsOpen(true)} className="icon-btn" title={t.aboutTitle} aria-label={t.aboutTitle}>
                <HelpCircle size={18} />
            </button>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
                    <div role="dialog" aria-modal="true" aria-labelledby="about-title" className="card relative z-10 max-w-lg w-full p-6 md:p-8 animate-rise">
                        <button onClick={() => setIsOpen(false)} aria-label={t.close} className="absolute top-4 right-4 icon-btn w-9 h-9">
                            <X size={18} />
                        </button>

                        <div className="space-y-6">
                            <h3 id="about-title" className="font-display text-2xl font-semibold pr-10">{t.aboutTitle}</h3>
                            <p className="text-ink-muted leading-relaxed">{t.aboutDesc}</p>
                            <div className="space-y-3">
                                <h4 className="eyebrow">{t.techStack}</h4>
                                <div className="flex flex-wrap gap-2">
                                    <TechBadge icon={Cpu} label="Astro 5" />
                                    <TechBadge icon={Code2} label="React 19 + TypeScript" />
                                    <TechBadge icon={Palette} label="Tailwind CSS 4" />
                                    <TechBadge icon={Box} label="Three.js (R3F)" />
                                    <TechBadge icon={Crown} label="chess.js" />
                                    <TechBadge icon={Cloud} label="Cloudflare Workers + D1" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default AboutModal;
