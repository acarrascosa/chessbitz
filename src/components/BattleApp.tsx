import React, { useEffect, useState } from 'react';
import { LogIn, Plus, Swords, WifiOff } from 'lucide-react';
import BattleLobby from './BattleLobby';
import BattleMatch from './BattleMatch';
import BattleResults from './BattleResults';
import { savedName, saveName, savedSeat, saveSeat, tableUrl, useBattle, type BattleConnection, type BattleProblem } from './useBattle';
import { CODE_LENGTH, MAX_NAME_LENGTH, cleanName, isRoomCode, randomCode } from '../lib/battle';
import { battlePath, ui, type Lang } from '../i18n/ui';

interface BattleAppProps {
    lang: Lang;
}

interface Seat {
    code: string;
    name: string;
    create: boolean;
}

const readCode = () => new URLSearchParams(location.search).get('mesa')?.toUpperCase() ?? '';

function setUrlCode(lang: Lang, code: string | null) {
    history.replaceState(null, '', code ? `${battlePath(lang)}?mesa=${code}` : battlePath(lang));
}

/**
 * Tactic battles. Without a table code: create a table or join one. With a code
 * in the URL (?mesa=ABCD, the invite link): confirm the name and sit down.
 */
const BattleApp: React.FC<BattleAppProps> = ({ lang }) => {
    const [seat, setSeat] = useState<Seat | null>(null);
    const [invite, setInvite] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [problem, setProblem] = useState<BattleProblem | null>(null);

    useEffect(() => {
        const saved = savedName();
        setName(saved);
        const code = readCode();
        if (!isRoomCode(code)) return;
        // Reloading the page at a table we're sitting at: straight back to the seat.
        if (code === savedSeat()) setSeat({ code, name: saved, create: false });
        else setInvite(code);
    }, []);

    const sit = (code: string, create: boolean) => {
        const clean = cleanName(name);
        if (clean) saveName(clean);
        setProblem(null);
        setInvite(null);
        setUrlCode(lang, code);
        saveSeat(code);
        setSeat({ code, name: clean, create });
    };

    const leave = (reason: BattleProblem | null) => {
        // Someone else owns that code: pick another one silently.
        if (reason === 'taken' && seat?.create) {
            sit(randomCode(), true);
            return;
        }
        setSeat(null);
        saveSeat(null);
        setProblem(reason);
        setUrlCode(lang, null);
    };

    if (seat) return <BattleTable key={seat.code} seat={seat} lang={lang} onLeave={leave} />;
    return <BattleEntry lang={lang} name={name} onName={setName} invite={invite} problem={problem} onSit={sit} onDismissInvite={() => {
        setInvite(null);
        setUrlCode(lang, null);
    }} />;
};

interface BattleEntryProps {
    lang: Lang;
    name: string;
    onName: (name: string) => void;
    invite: string | null;
    problem: BattleProblem | null;
    onSit: (code: string, create: boolean) => void;
    onDismissInvite: () => void;
}

function BattleEntry({ lang, name, onName, invite, problem, onSit, onDismissInvite }: BattleEntryProps) {
    const t = ui[lang].battle;
    const [code, setCode] = useState('');
    const validCode = isRoomCode(code);

    const nameField = (
        <label className="block text-left space-y-1.5">
            <span className="eyebrow">{t.yourName}</span>
            <input
                value={name}
                onChange={e => onName(e.target.value)}
                maxLength={MAX_NAME_LENGTH}
                placeholder={t.namePlaceholder}
                autoComplete="nickname"
                className="w-full h-11 px-3.5 rounded-xl bg-surface-2 border border-line text-base placeholder:text-ink-muted"
            />
        </label>
    );

    return (
        <section className="w-full max-w-lg mx-auto space-y-6 animate-rise py-4 lg:py-8" aria-labelledby="battle-title">
            <header className="text-center space-y-3">
                <p className="eyebrow">{t.eyebrow}</p>
                <h1 id="battle-title" className="font-display text-4xl md:text-5xl font-semibold tracking-tight">{t.title}</h1>
                <p className="font-display italic text-lg text-ink-muted text-balance">{t.intro}</p>
            </header>

            {problem && (
                <p role="alert" className="card px-4 py-3 text-sm font-semibold text-bad flex items-center gap-2">
                    {problem === 'offline' && <WifiOff size={16} aria-hidden="true" />}
                    {t.errors[problem]}
                </p>
            )}

            {invite ? (
                <form className="card p-5 space-y-4" onSubmit={e => {
                    e.preventDefault();
                    onSit(invite, false);
                }}>
                    <h2 className="font-display text-2xl font-semibold text-center">{t.invited.replace('{code}', invite)}</h2>
                    {nameField}
                    <button type="submit" className="btn btn-primary w-full py-3">
                        <LogIn size={18} aria-hidden="true" /> {t.sitDown}
                    </button>
                    <button type="button" onClick={onDismissInvite} className="w-full text-sm font-semibold text-ink-muted hover:text-accent">
                        {t.otherTable}
                    </button>
                </form>
            ) : (
                <div className="card p-5 space-y-5">
                    {nameField}
                    <button onClick={() => onSit(randomCode(), true)} className="btn btn-primary w-full py-3">
                        <Plus size={18} aria-hidden="true" /> {t.create}
                    </button>
                    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                        <span className="h-px flex-1 bg-line" /> {t.orJoin} <span className="h-px flex-1 bg-line" />
                    </div>
                    <form className="flex gap-2" onSubmit={e => {
                        e.preventDefault();
                        if (validCode) onSit(code, false);
                    }}>
                        <label className="flex-1">
                            <span className="sr-only">{t.codeLabel}</span>
                            <input
                                value={code}
                                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
                                placeholder={t.codeLabel}
                                autoCapitalize="characters"
                                autoComplete="off"
                                spellCheck={false}
                                className="w-full h-11 px-3.5 rounded-xl bg-surface-2 border border-line font-mono text-lg tracking-[0.3em] uppercase placeholder:font-sans placeholder:text-base placeholder:tracking-normal placeholder:normal-case placeholder:text-ink-muted"
                            />
                        </label>
                        <button type="submit" disabled={!validCode} className="btn btn-quiet px-5">
                            <Swords size={16} aria-hidden="true" /> {t.join}
                        </button>
                    </form>
                </div>
            )}

            <div className="card p-5 space-y-2">
                <h2 className="eyebrow">{t.rulesTitle}</h2>
                <ul className="text-sm text-ink-muted space-y-1.5 list-disc pl-5">
                    {t.rules.map(rule => <li key={rule}>{rule}</li>)}
                </ul>
            </div>
        </section>
    );
}

function BattleTable({ seat, lang, onLeave }: { seat: Seat; lang: Lang; onLeave: (reason: BattleProblem | null) => void }) {
    const battle = useBattle(seat.code, tableUrl(seat.code, seat.name, seat.create));
    return <BattleScreens battle={battle} lang={lang} onLeave={onLeave} />;
}

/** Lobby, match or podium for a connected table; shared with the Discord Activity. */
export function BattleScreens({ battle, lang, onLeave }: { battle: BattleConnection; lang: Lang; onLeave: (reason: BattleProblem | null) => void }) {
    const t = ui[lang].battle;
    const { room, connection, problem } = battle;

    useEffect(() => {
        if (problem) onLeave(problem);
    }, [problem, onLeave]);

    const leave = () => {
        battle.send({ t: 'leave' });
        onLeave(null);
    };

    const banner = connection === 'reconnecting' && (
        <p role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 card px-4 py-2 text-sm font-semibold flex items-center gap-2 shadow-lg">
            <WifiOff size={16} aria-hidden="true" /> {t.reconnecting}
        </p>
    );

    if (!room) {
        return <p role="status" className="py-24 text-center text-ink-muted animate-pulse">{t.connecting}</p>;
    }

    const screen = room.status === 'lobby'
        ? <BattleLobby battle={battle} room={room} lang={lang} onLeave={leave} />
        : room.status === 'playing'
            ? <BattleMatch key={room.round} battle={battle} room={room} lang={lang} onLeave={leave} />
            : <BattleResults battle={battle} room={room} lang={lang} onLeave={leave} />;

    return (
        <>
            {screen}
            {banner}
        </>
    );
}

export default BattleApp;
