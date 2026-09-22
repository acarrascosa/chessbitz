import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Lightbulb } from 'lucide-react';
import { useStore } from '@nanostores/react';
import Modal from './Modal';
import { KNIGHT_PATH } from './knight-path';
import { contrastStore } from '../store/theme';
import { fill, guidePath, ui, type Lang } from '../i18n/ui';

interface HowToModalProps {
    open: boolean;
    onClose: () => void;
    lang: Lang;
}

/** Step 1: a knight jumping to its square, like the first move of a line. */
function BoardIllustration() {
    const squares = Array.from({ length: 16 }, (_, i) => i);
    return (
        <div className="relative mx-auto w-40 aspect-square rounded-lg overflow-hidden board-frame p-1.5" aria-hidden="true">
            <div className="grid grid-cols-4 grid-rows-4 w-full h-full rounded-sm overflow-hidden">
                {squares.map(i => (
                    <span
                        key={i}
                        className="flex items-center justify-center text-2xl leading-none"
                        style={{ background: (Math.floor(i / 4) + i) % 2 ? 'var(--board-dark)' : 'var(--board-light)' }}
                    >
                        {i === 13 ? (
                            <svg viewBox="0 0 140 200" className="w-[62%] h-[75%]"><path fill="#1d2621" d={KNIGHT_PATH} /></svg>
                        ) : null}
                        {i === 6 ? <span className="w-3 h-3 rounded-full bg-[rgba(31,40,35,0.38)]" /> : null}
                    </span>
                ))}
            </div>
            <svg viewBox="0 0 100 100" className="absolute inset-1.5 w-[calc(100%-0.75rem)] h-[calc(100%-0.75rem)]">
                <path d="M37.5 87.5 L37.5 37.5 L52 37.5" fill="none" stroke="var(--hint)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                <path d="M51 28.5 L63 37.5 L51 46.5 Z" fill="var(--hint)" opacity="0.9" />
            </svg>
        </div>
    );
}

/** Step 2: the mistake counter and the hint levels. */
function HintsIllustration({ lang }: { lang: Lang }) {
    const t = ui[lang];
    return (
        <div className="mx-auto max-w-xs rounded-xl border border-line bg-surface-2 p-4 space-y-3 text-left" aria-hidden="true">
            <div className="flex items-center justify-between">
                <span className="eyebrow">{t.mistakes}</span>
                <span className="flex gap-1.5">
                    {Array.from({ length: 5 }, (_, i) => <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < 2 ? 'bg-bad' : 'bg-line'}`} />)}
                </span>
            </div>
            <span className="btn btn-quiet w-full py-2 text-sm border border-line">
                <Lightbulb size={16} /> {t.hint} · 2/3
            </span>
            <ul className="text-sm text-hint space-y-0.5">
                <li>{fill(t.hintPiece, { piece: t.pieces.n })}</li>
                <li>{fill(t.hintSquare, { square: 'g1' })}</li>
            </ul>
        </div>
    );
}

/** Step 3: the colour legend of the result grid. */
function LegendIllustration({ lang }: { lang: Lang }) {
    const t = ui[lang];
    const contrast = useStore(contrastStore);
    const rows: [string, string][] = contrast
        ? [['🟦', t.legendPerfect], ['🟧', t.legendAssisted], ['⬛', t.legendRevealed]]
        : [['🟩', t.legendPerfect], ['🟨', t.legendAssisted], ['🟥', t.legendRevealed]];
    return (
        <div className="mx-auto max-w-xs space-y-3">
            <p className="text-3xl tracking-[0.2em]" aria-hidden="true">{rows.map(([emoji]) => emoji).join('')}{rows[0][0]}</p>
            <ul className="w-fit mx-auto space-y-1.5 text-sm text-left">
                {rows.map(([emoji, label]) => (
                    <li key={label} className="flex items-center gap-2.5">
                        <span aria-hidden="true">{emoji}</span> {label}
                    </li>
                ))}
            </ul>
        </div>
    );
}

const HowToModal: React.FC<HowToModalProps> = ({ open, onClose, lang }) => {
    const t = ui[lang];
    const [step, setStep] = useState(0);
    const steps = t.howSteps;
    const current = steps[step];
    const last = step === steps.length - 1;

    const close = () => {
        onClose();
        setStep(0);
    };

    const illustrations = [<BoardIllustration key="board" />, <HintsIllustration key="hints" lang={lang} />, <LegendIllustration key="legend" lang={lang} />];

    return (
        <Modal
            open={open}
            onClose={close}
            title={t.navHelp}
            eyebrow={fill(t.howStep, { n: step + 1, total: steps.length })}
            closeLabel={t.close}
            footer={
                <div className="flex items-center justify-between gap-3">
                    <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="btn btn-quiet px-4 py-2.5 text-sm">
                        <ArrowLeft size={16} aria-hidden="true" /> {t.howBack}
                    </button>
                    <span className="flex gap-1.5" aria-hidden="true">
                        {steps.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-brand' : 'w-3 bg-line'}`} />)}
                    </span>
                    <button onClick={() => (last ? close() : setStep(s => s + 1))} className="btn btn-primary px-4 py-2.5 text-sm">
                        {last ? t.howPlay : t.howNext} <ArrowRight size={16} aria-hidden="true" />
                    </button>
                </div>
            }
        >
            <div className="text-center space-y-4 py-2" aria-live="polite">
                <p className="eyebrow">{current.eyebrow}</p>
                <h3 className="font-display text-2xl font-semibold text-balance">{current.title}</h3>
                <div className="py-2">{illustrations[step]}</div>
                <p className="text-ink-muted leading-relaxed text-balance">{current.text}</p>
                {last && (
                    <a href={guidePath(lang)} className="inline-flex text-sm font-semibold text-accent hover:underline underline-offset-4">{t.howMore}</a>
                )}
            </div>
        </Modal>
    );
};

export default HowToModal;
