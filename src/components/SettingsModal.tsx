import React, { useRef, useState } from 'react';
import { Box, Check, Cloud, Code2, Copy, Cpu, Crown, Download, ExternalLink, Palette, Upload } from 'lucide-react';
import { useStore } from '@nanostores/react';
import Modal from './Modal';
import { notifyProgress } from './hooks';
import { exportProgress, importProgress } from '../lib/progress';
import { contrastStore, themeStore, type Theme } from '../store/theme';
import { fill, ui, type Lang } from '../i18n/ui';

interface SettingsModalProps {
    open: boolean;
    onClose: () => void;
    lang: Lang;
    /** The current page in the other language. */
    alternateHref: string;
}

const TECH = [
    [Cpu, 'Astro 5'], [Code2, 'React 19 + TypeScript'], [Palette, 'Tailwind CSS 4'],
    [Box, 'Three.js (R3F)'], [Crown, 'chess.js'], [Cloud, 'Cloudflare Workers + D1'],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2.5">
            <h3 className="eyebrow">{title}</h3>
            {children}
        </section>
    );
}

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose, lang, alternateHref }) => {
    const t = ui[lang];
    const theme = useStore(themeStore);
    const contrast = useStore(contrastStore);
    const [code, setCode] = useState('');
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const file = useRef<HTMLInputElement>(null);

    const segment = (active: boolean) =>
        `flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`;

    const runImport = (text: string) => {
        const result = importProgress(text);
        setMessage(result.ok ? { ok: true, text: fill(t.importOk, { n: result.days }) } : { ok: false, text: t.importError });
        if (result.ok) {
            setCode('');
            notifyProgress();
            // The game on screen reads its progress on load.
            setTimeout(() => window.location.reload(), 1200);
        }
    };

    const download = () => {
        const blob = new Blob([exportProgress()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `chessbitz-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(exportProgress());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard blocked: the download still works.
        }
    };

    return (
        <Modal open={open} onClose={onClose} title={t.settingsTitle} closeLabel={t.close}>
            <div className="space-y-6">
                <Section title={t.theme}>
                    <div className="flex gap-1 p-1 rounded-xl bg-surface-2 border border-line" role="radiogroup" aria-label={t.theme}>
                        {([['light', t.themeLight], ['dark', t.themeDark], ['system', t.themeSystem]] as [Theme, string][]).map(([value, label]) => (
                            <button key={value} role="radio" aria-checked={theme === value} onClick={() => themeStore.set(value)} className={segment(theme === value)}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <label className="flex items-start justify-between gap-4 rounded-xl border border-line p-3 cursor-pointer">
                        <span>
                            <span className="block font-semibold text-sm">{t.contrast}</span>
                            <span className="block text-xs text-ink-muted mt-0.5">{t.contrastDesc}</span>
                        </span>
                        <button
                            role="switch"
                            aria-checked={contrast}
                            aria-label={t.contrast}
                            onClick={() => contrastStore.set(!contrast)}
                            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${contrast ? 'bg-brand' : 'bg-line'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow transition-transform ${contrast ? 'translate-x-5' : ''}`} />
                        </button>
                    </label>
                </Section>

                <Section title={t.language}>
                    <div className="flex gap-1 p-1 rounded-xl bg-surface-2 border border-line">
                        <span className={segment(true)} aria-current="true">{lang === 'es' ? 'Español' : 'English'}</span>
                        <a href={alternateHref} hrefLang={lang === 'es' ? 'en' : 'es'} className={`${segment(false)} text-center`}>
                            {lang === 'es' ? 'English' : 'Español'}
                        </a>
                    </div>
                </Section>

                <Section title={t.progressTitle}>
                    <p className="text-sm text-ink-muted leading-relaxed">{t.progressDesc}</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={download} className="btn btn-quiet py-2.5 text-sm border border-line">
                            <Download size={16} aria-hidden="true" /> {t.exportFile}
                        </button>
                        <button onClick={copy} className="btn btn-quiet py-2.5 text-sm border border-line">
                            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? t.copied : t.copyCode}
                        </button>
                    </div>
                    <label className="block">
                        <span className="sr-only">{t.importLabel}</span>
                        <textarea
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            placeholder={t.importLabel}
                            rows={2}
                            className="w-full rounded-xl bg-surface-2 border border-line px-3 py-2 text-xs font-mono placeholder:font-sans placeholder:text-ink-muted resize-none"
                        />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => file.current?.click()} className="btn btn-quiet py-2.5 text-sm border border-line">
                            <Upload size={16} aria-hidden="true" /> {t.importFile}
                        </button>
                        <button onClick={() => runImport(code)} disabled={!code.trim()} className="btn btn-primary py-2.5 text-sm">
                            {t.importButton}
                        </button>
                    </div>
                    <input
                        ref={file}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={async e => {
                            const selected = e.target.files?.[0];
                            if (selected) runImport(await selected.text());
                            e.target.value = '';
                        }}
                    />
                    {message && <p role="status" className={`text-sm font-semibold ${message.ok ? 'text-good' : 'text-bad'}`}>{message.text}</p>}
                </Section>

                <Section title={t.about}>
                    <p className="text-sm text-ink-muted leading-relaxed">{t.aboutDesc}</p>
                    <ul className="flex flex-wrap gap-2" aria-label={t.techStack}>
                        {TECH.map(([Icon, label]) => (
                            <li key={label} className="flex items-center gap-2 bg-surface-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-line">
                                <Icon size={14} className="text-accent" aria-hidden="true" /> {label}
                            </li>
                        ))}
                    </ul>
                    <a href="https://github.com/acarrascosa/chessbitz" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline underline-offset-4">
                        {t.sourceCode} <ExternalLink size={14} aria-hidden="true" />
                    </a>
                </Section>
            </div>
        </Modal>
    );
};

export default SettingsModal;
