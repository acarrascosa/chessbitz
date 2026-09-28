import React, { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Avatar } from './BattleLobby';
import { StepsModal } from './HowToModal';
import { POINTS } from '../lib/battle';
import { fill, ui, type Lang } from '../i18n/ui';

interface BattleGuideModalProps {
    open: boolean;
    onClose: () => void;
    lang: Lang;
    /** Inside the Discord Activity: the table is the Activity, there's no code to share. */
    discord?: boolean;
}

/** Step 1: a table with three seats taken and one free. */
function TableIllustration({ lang, discord }: { lang: Lang; discord: boolean }) {
    const t = ui[lang].battle;
    return (
        <div className="mx-auto max-w-xs rounded-xl border border-line bg-surface-2 p-4 space-y-3" aria-hidden="true">
            <p className="eyebrow">{discord ? 'Discord' : <>{t.table} <span className="font-mono tracking-[0.2em] text-accent">KQRB</span></>}</p>
            <div className="flex justify-center gap-3">
                {['Ana', 'Leo', 'Sara'].map((name, i) => <Avatar key={name} name={name} index={i} />)}
                <span className="w-9 h-9 rounded-full border-2 border-dashed border-line" />
            </div>
        </div>
    );
}

/** Step 2: one board's clock, mistakes and the hint that costs points. */
function BoardIllustration({ lang }: { lang: Lang }) {
    const t = ui[lang];
    return (
        <div className="mx-auto max-w-xs rounded-xl border border-line bg-surface-2 p-4 space-y-3 text-left" aria-hidden="true">
            <div className="flex items-center justify-between">
                <span className="eyebrow">{fill(t.battle.boardOf, { i: 2, n: 5 })}</span>
                <span className="flex gap-1.5">
                    {Array.from({ length: 5 }, (_, i) => <span key={i} className={`w-2.5 h-2.5 rounded-full ${i < 1 ? 'bg-bad' : 'bg-line'}`} />)}
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-line overflow-hidden">
                <div className="h-full w-3/5 rounded-full bg-brand" />
            </div>
            <span className="btn btn-quiet w-full py-2 text-sm border border-line">
                <Lightbulb size={16} /> {t.hint} <span className="font-normal text-ink-muted">· {fill(t.battle.hintCost, { points: POINTS.hint })}</span>
            </span>
        </div>
    );
}

/** Step 3: what a board is worth, from the scoring constants. */
function PointsIllustration({ lang }: { lang: Lang }) {
    const t = ui[lang].battle;
    const rows: [string, string, string][] = [
        [t.guide.points.solved, `+${POINTS.solved}`, 'text-good'],
        [t.guide.points.speed, `+${POINTS.speed}`, 'text-good'],
        [t.guide.points.mistake, `−${POINTS.mistake}`, 'text-bad'],
        [t.guide.points.hint, `−${POINTS.hint}`, 'text-bad'],
    ];
    return (
        <ul className="mx-auto max-w-xs rounded-xl border border-line bg-surface-2 divide-y divide-line text-sm text-left">
            {rows.map(([label, value, color]) => (
                <li key={label} className="px-4 py-2 flex items-center justify-between gap-3">
                    <span>{label}</span>
                    <span className={`font-semibold tabular-nums ${color}`}>{value} {t.pts}</span>
                </li>
            ))}
        </ul>
    );
}

/** How a tactics battle works, in three steps; on the web and in the Discord Activity. */
export default function BattleGuideModal({ open, onClose, lang, discord = false }: BattleGuideModalProps) {
    const t = ui[lang].battle;
    const illustrations = [
        <TableIllustration key="table" lang={lang} discord={discord} />,
        <BoardIllustration key="board" lang={lang} />,
        <PointsIllustration key="points" lang={lang} />,
    ];
    const steps = t.guide.steps.map((step, i) => ({
        ...step,
        text: discord && i === 0 ? t.guide.discordTable : step.text,
        illustration: illustrations[i],
    }));
    return <StepsModal open={open} onClose={onClose} lang={lang} title={t.guide.button} steps={steps} finish={t.guide.finish} />;
}

/** Set once the battle guide has been closed (HeaderActions uses it on the battle page). */
export const BATTLE_GUIDE_KEY = 'chessbitz-battle-guide';

/**
 * Open state for the battle guide: shown by itself on the first battle (after the
 * page has settled) and remembered once closed. Without storage it isn't forced.
 */
export function useBattleGuide(auto = true): { open: boolean; show: () => void; close: () => void } {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!auto) return;
        let seen = true;
        try {
            seen = localStorage.getItem(BATTLE_GUIDE_KEY) !== null;
        } catch {
            // Storage unavailable: skip the guide rather than showing it every visit.
        }
        if (seen) return;
        const timer = setTimeout(() => setOpen(true), 900);
        return () => clearTimeout(timer);
    }, [auto]);
    const close = () => {
        setOpen(false);
        try {
            localStorage.setItem(BATTLE_GUIDE_KEY, 'true');
        } catch {
            // Nothing to persist.
        }
    };
    return { open, show: () => setOpen(true), close };
}
