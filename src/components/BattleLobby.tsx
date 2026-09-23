import { useState } from 'react';
import { Check, Copy, Crown, LogOut, Pencil, Play, Share2, UserPlus, UserX } from 'lucide-react';
import { useBattleHost } from './battleHost';
import type { BattleConnection } from './useBattle';
import { saveName } from './useBattle';
import { FORMATS_ORDER, MAX_NAME_LENGTH, MAX_PLAYERS, canStart, cleanName, type PublicPlayer, type PublicRoom } from '../lib/battle';
import { battlePath, fill, ui, type Lang } from '../i18n/ui';

interface BattleLobbyProps {
    battle: BattleConnection;
    room: PublicRoom;
    lang: Lang;
    onLeave: () => void;
}

/** Seats, format picker and the ready / start buttons. */
export default function BattleLobby({ battle, room, lang, onLeave }: BattleLobbyProps) {
    const t = ui[lang].battle;
    const { discord } = useBattleHost();
    const { send, you, notice } = battle;
    const isHost = room.hostId === you;
    const me = room.players.find(p => p.id === you);
    // canStart only reads fields every client has.
    const blocked = canStart({ ...room, players: room.players.map(p => ({ ...p, token: '' })) });
    const status = blocked === 'tooFew' ? t.needPlayers
        : blocked === 'notReady' ? t.needReady
            : isHost ? t.hostReady : t.waitingHost;

    return (
        // On phones the columns dissolve (display: contents) so the ready button can sit right under the players.
        <section className="w-full max-w-4xl mx-auto flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start animate-rise lg:py-4" aria-labelledby="lobby-title">
            <div className="contents lg:block lg:space-y-5">
                {discord ? <DiscordInvite lang={lang} onInvite={discord.invite} /> : <Invite code={room.code} lang={lang} />}

                <div className="card overflow-hidden order-2 lg:order-none">
                    <div className="px-5 py-3.5 bg-surface-2 border-b border-line flex items-center justify-between">
                        <h2 className="eyebrow">{fill(t.players, { n: room.players.length, max: MAX_PLAYERS })}</h2>
                    </div>
                    <ul className="divide-y divide-line">
                        {room.players.map(player => (
                            <PlayerRow key={player.id} player={player} room={room} you={you} lang={lang} onKick={() => send({ t: 'kick', id: player.id })} onRename={name => {
                                saveName(name);
                                send({ t: 'rename', name });
                            }} />
                        ))}
                        {Array.from({ length: MAX_PLAYERS - room.players.length }, (_, i) => (
                            <li key={`empty-${i}`} className="px-5 py-3.5 flex items-center gap-3 text-ink-muted">
                                <span className="w-9 h-9 rounded-full border-2 border-dashed border-line" aria-hidden="true" />
                                <span className="text-sm">{t.emptySeat}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="contents lg:block lg:space-y-5">
                <fieldset className="card p-4 space-y-2 order-4 lg:order-none" disabled={!isHost}>
                    <legend className="eyebrow float-left mb-1">{t.formatTitle}</legend>
                    <div className="clear-left grid gap-2" role="radiogroup">
                        {FORMATS_ORDER.map(format => {
                            const selected = room.format === format;
                            return (
                                <button
                                    key={format}
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => send({ t: 'format', format })}
                                    className={`text-left rounded-xl border px-4 py-3 transition-colors ${selected ? 'border-brand bg-accent-soft/60' : 'border-line hover:bg-surface-2'} ${isHost ? '' : 'cursor-default'}`}
                                >
                                    <span className="flex items-center justify-between font-semibold">
                                        {t.formats[format].name}
                                        {selected && <Check size={16} aria-hidden="true" />}
                                    </span>
                                    <span className="block text-xs text-ink-muted mt-0.5">{t.formats[format].desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </fieldset>

                <div className="card p-4 space-y-3 order-3 lg:order-none">
                    <p role="status" className="text-sm font-semibold text-center">{status}</p>
                    {notice && <p role="alert" className="text-sm text-bad text-center">{t.errors[notice]}</p>}
                    {isHost ? (
                        <button onClick={() => send({ t: 'start' })} disabled={blocked !== null} className="btn btn-primary w-full py-3">
                            <Play size={18} aria-hidden="true" /> {t.start}
                        </button>
                    ) : (
                        <button onClick={() => send({ t: 'ready', ready: !me?.ready })} className={`btn w-full py-3 ${me?.ready ? 'btn-quiet' : 'btn-primary'}`}>
                            <Check size={18} aria-hidden="true" /> {me?.ready ? t.unready : t.imReady}
                        </button>
                    )}
                    {/* In Discord, closing the activity is how you leave. */}
                    {!discord && (
                        <button onClick={onLeave} className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-bad">
                            <LogOut size={14} aria-hidden="true" /> {t.leave}
                        </button>
                    )}
                </div>

                <div className="card p-4 space-y-2 order-5 lg:order-none">
                    <h2 className="eyebrow">{t.rulesTitle}</h2>
                    <ul className="text-sm text-ink-muted space-y-1.5 list-disc pl-5">
                        {t.rules.map(rule => <li key={rule}>{rule}</li>)}
                    </ul>
                </div>
            </div>
        </section>
    );
}

function DiscordInvite({ lang, onInvite }: { lang: Lang; onInvite: () => void }) {
    const t = ui[lang].battle;
    return (
        <header className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between order-1 lg:order-none">
            <div className="space-y-1 text-center sm:text-left">
                <p className="eyebrow">Discord</p>
                <h1 id="lobby-title" className="font-display text-3xl font-semibold">{t.title}</h1>
                <p className="text-sm text-ink-muted">{t.discord.inviteHint}</p>
            </div>
            <button onClick={onInvite} className="btn btn-primary px-4 py-2.5 text-sm shrink-0">
                <UserPlus size={16} aria-hidden="true" /> {t.discord.invite}
            </button>
        </header>
    );
}

function Invite({ code, lang }: { code: string; lang: Lang }) {
    const t = ui[lang].battle;
    const [copied, setCopied] = useState(false);
    const link = `${location.origin}${battlePath(lang)}?mesa=${code}`;
    const canShare = typeof navigator.share === 'function';

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2_000);
        } catch {
            // Clipboard blocked: the code is on screen anyway.
        }
    };

    return (
        <header className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between order-1 lg:order-none">
            <div className="space-y-1 text-center sm:text-left">
                <p className="eyebrow">{ui[lang].battle.title}</p>
                <h1 id="lobby-title" className="font-display text-3xl font-semibold">
                    {t.table}{' '}
                    <span className="font-mono tracking-[0.2em] text-accent" data-testid="table-code">{code}</span>
                </h1>
                <p className="text-sm text-ink-muted">{t.inviteHint}</p>
            </div>
            <div className="flex gap-2 justify-center shrink-0">
                <button onClick={copy} className="btn btn-quiet px-4 py-2.5 text-sm" aria-live="polite">
                    {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                    {copied ? t.copied : t.copyLink}
                </button>
                {canShare && (
                    <button onClick={() => navigator.share({ title: t.title, url: link }).catch(() => {})} className="icon-btn" aria-label={t.copyLink}>
                        <Share2 size={16} aria-hidden="true" />
                    </button>
                )}
            </div>
        </header>
    );
}

interface PlayerRowProps {
    player: PublicPlayer;
    room: PublicRoom;
    you: string;
    lang: Lang;
    onKick: () => void;
    onRename: (name: string) => void;
}

export function Avatar({ name, index }: { name: string; index: number }) {
    // Fixed tones rather than theme tokens, so seats stay distinct in both themes.
    const colors = ['bg-[#b8863b]', 'bg-[#2f7d6d]', 'bg-[#4a6fa5]', 'bg-[#a4506a]'];
    return (
        <span className={`w-9 h-9 shrink-0 rounded-full inline-flex items-center justify-center font-display font-semibold text-white ${colors[index % colors.length]}`} aria-hidden="true">
            {Array.from(name)[0]?.toUpperCase() ?? '?'}
        </span>
    );
}

function PlayerRow({ player, room, you, lang, onKick, onRename }: PlayerRowProps) {
    const t = ui[lang].battle;
    const { discord } = useBattleHost();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(player.name);
    const isYou = player.id === you;
    const isHost = player.id === room.hostId;
    const index = room.players.findIndex(p => p.id === player.id);

    const badge = !player.online
        ? <span className="text-xs font-semibold text-ink-muted">{t.offline}</span>
        : isHost
            ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent"><Crown size={13} aria-hidden="true" />{t.host}</span>
            : player.ready
                ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-good"><Check size={13} aria-hidden="true" />{t.ready}</span>
                : <span className="text-xs font-semibold text-ink-muted">{t.notReady}</span>;

    return (
        <li className={`px-5 py-3 flex items-center gap-3 ${player.online ? '' : 'opacity-60'}`} data-testid="lobby-player">
            <Avatar name={player.name} index={index} />
            {editing ? (
                <form className="flex-1 flex gap-2" onSubmit={e => {
                    e.preventDefault();
                    const clean = cleanName(draft);
                    if (clean) onRename(clean);
                    setEditing(false);
                }}>
                    <input
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        maxLength={MAX_NAME_LENGTH}
                        autoFocus
                        aria-label={t.yourName}
                        className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-surface-2 border border-line text-sm"
                    />
                    <button type="submit" className="btn btn-quiet px-3 text-sm">{t.save}</button>
                </form>
            ) : (
                <span className="flex-1 min-w-0 font-semibold truncate">
                    {player.name}
                    {isYou && <span className="font-normal text-ink-muted"> ({t.you})</span>}
                </span>
            )}
            {!editing && badge}
            {isYou && !editing && !discord && (
                <button onClick={() => {
                    setDraft(player.name);
                    setEditing(true);
                }} className="p-1.5 rounded-lg text-ink-muted hover:text-accent" aria-label={t.rename} title={t.rename}>
                    <Pencil size={14} aria-hidden="true" />
                </button>
            )}
            {room.hostId === you && !isYou && (
                <button onClick={onKick} className="p-1.5 rounded-lg text-ink-muted hover:text-bad" aria-label={fill(t.kick, { name: player.name })} title={fill(t.kick, { name: player.name })}>
                    <UserX size={14} aria-hidden="true" />
                </button>
            )}
        </li>
    );
}
