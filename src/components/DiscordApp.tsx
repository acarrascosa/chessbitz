import { useEffect, useMemo, useRef, useState } from 'react';
import { DiscordSDK, DiscordSDKMock } from '@discord/embedded-app-sdk';
import { LogIn, Swords } from 'lucide-react';
import { BattleScreens, Searching } from './BattleApp';
import BattleGuideModal, { useBattleGuide } from './BattleGuideModal';
import { usePanelRequests } from './hooks';
import { BattleHostContext, type BattleHost } from './battleHost';
import { savedLevel, useBattle, type BattleProblem } from './useBattle';
import { discordLang, isDiscordLaunch } from '../lib/discord';
import { battlePresence, searchingPresence, type PresenceActivity } from '../lib/presence';
import type { PublicRoom } from '../lib/battle';
import { battlePath, ui, type Lang } from '../i18n/ui';

type Sdk = DiscordSDK | DiscordSDKMock;

interface Connected {
    sdk: Sdk;
    /** Our signed session (see worker/discord.ts), sent when opening the table's socket. */
    session: string;
    /** Language set in the player's Discord settings, when Discord reports it. */
    locale: string | null;
}

type Phase = { kind: 'loading' } | { kind: 'outside' } | { kind: 'error'; detail: string } | ({ kind: 'ready' } & Connected);

/** Which step of the handshake failed and why, shown small under the error so players can report it. */
class HandshakeError extends Error {
    constructor(step: string, cause: unknown) {
        const reason = cause instanceof Error ? cause.message : typeof cause === 'object' ? JSON.stringify(cause) : String(cause);
        super(`${step}: ${reason}`);
    }
}

async function step<T>(name: string, run: () => Promise<T>): Promise<T> {
    try {
        return await run();
    } catch (error) {
        throw new HandshakeError(name, error);
    }
}

/**
 * Local testing without Discord (DISCORD_MOCK=1 in .dev.vars): the SDK's mock
 * with a fixed Activity instance, and a player given by ?mock_user=Name.
 */
function mockSdk(clientId: string): DiscordSDKMock {
    const sdk = new DiscordSDKMock(clientId, '100000000000000002', '100000000000000001', null);
    let id = '';
    try {
        id = localStorage.getItem('chessbitz-discord-mock-id') ?? '';
        if (!id) localStorage.setItem('chessbitz-discord-mock-id', (id = String(Math.floor(1e16 + Math.random() * 9e16))));
    } catch {
        id = String(Math.floor(1e16 + Math.random() * 9e16));
    }
    const name = new URLSearchParams(location.search).get('mock_user') || 'Tester';
    sdk._updateCommandMocks({
        authorize: async () => ({ code: `mock:${id}:${name}` }),
        // Exposed so tests (and a curious developer) can see what the profile would show.
        setActivity: async ({ activity }) => {
            (window as unknown as { chessbitzPresence?: unknown }).chessbitzPresence = activity;
            return activity as never;
        },
    });
    return sdk;
}

/** Discord's handshake: ready → authorize (code) → our Worker swaps it for a token → authenticate. */
async function connectToDiscord(): Promise<Connected | 'outside'> {
    const config = await step('config', async () => {
        const response = await fetch('/api/discord/config');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ clientId: string; mock: boolean }>;
    });
    if (!config.mock && !isDiscordLaunch(location.search)) return 'outside';

    const sdk = config.mock ? mockSdk(config.clientId) : new DiscordSDK(config.clientId);
    await step('ready', () => sdk.ready());
    const { code } = await step('authorize', () => sdk.commands.authorize({
        client_id: config.clientId,
        response_type: 'code',
        state: '',
        prompt: 'none',
        // rpc.activities.write: the player's profile shows the battle (Rich Presence).
        scope: ['identify', 'rpc.activities.write'],
    }));
    const { access_token, session, locale } = await step('token', async () => {
        const response = await fetch('/api/discord/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} ${await response.text()}`);
        return response.json() as Promise<{ access_token: string; session: string; locale?: string | null }>;
    });
    await step('authenticate', () => sdk.commands.authenticate({ access_token }));
    return { sdk, session, locale: locale ?? null };
}

/** Chessbitz inside Discord: only the tactics battle, one table per Activity instance. */
export default function DiscordApp() {
    const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
    // Spanish for any Spanish Discord locale (es-ES, es-419), English otherwise. Until Discord
    // reports it, the browser's language (the OS's) is the best guess.
    const lang: Lang = discordLang((phase.kind === 'ready' && phase.locale) || navigator.language);
    const t = ui[lang].battle;

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    useEffect(() => {
        let cancelled = false;
        connectToDiscord()
            .then(result => !cancelled && setPhase(result === 'outside' ? { kind: 'outside' } : { kind: 'ready', ...result }))
            .catch(error => {
                console.error(error);
                if (!cancelled) setPhase({ kind: 'error', detail: error instanceof Error ? error.message : String(error) });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (phase.kind === 'loading') return <p role="status" className="py-24 text-center text-ink-muted animate-pulse">{t.discord.loading}</p>;
    if (phase.kind === 'error') {
        return (
            <Notice text={t.discord.error}>
                <p className="text-xs text-ink-muted font-mono break-words" data-testid="discord-error-detail">{phase.detail}</p>
            </Notice>
        );
    }
    if (phase.kind === 'outside') {
        return (
            <Notice text={t.discord.outside}>
                <a href={battlePath(lang)} className="btn btn-primary px-5 py-2.5 text-sm"><Swords size={16} aria-hidden="true" /> {t.discord.playOnWeb}</a>
            </Notice>
        );
    }
    return <DiscordTable sdk={phase.sdk} session={phase.session} lang={lang} />;
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
    return (
        <section className="w-full max-w-md mx-auto card p-6 mt-16 text-center space-y-4 animate-rise">
            <p className="font-semibold">{text}</p>
            {children}
        </section>
    );
}

function DiscordTable({ sdk, session, lang }: Omit<Connected, 'locale'> & { lang: Lang }) {
    const t = ui[lang].battle;
    const [round, setRound] = useState(0);
    const [away, setAway] = useState<BattleProblem | 'left' | null>(null);
    // The Activity's own table, the public queue, or a public table from it.
    const [place, setPlace] = useState<'instance' | 'search' | { code: string }>('instance');
    const backToInstance = () => {
        setPlace('instance');
        setRound(r => r + 1);
    };
    // No header in the Activity: the guide opens by itself the first time and from the lobby's button.
    const guide = useBattleGuide();
    usePanelRequests(panel => panel === 'help' && guide.show());
    const guideModal = <BattleGuideModal open={guide.open} onClose={guide.close} lang={lang} discord />;
    const host = useMemo<BattleHost>(() => ({
        search: () => setPlace('search'),
        discord: {
            invite: () => void sdk.commands.openInviteDialog().catch(() => {}),
            openExternal: url => void sdk.commands.openExternalLink({ url }).catch(() => {}),
        },
    }), [sdk]);

    if (away) {
        return (
            <Notice text={away === 'left' ? t.discord.left : t.errors[away]}>
                <button onClick={() => {
                    setAway(null);
                    setRound(r => r + 1);
                }} className="btn btn-primary px-5 py-2.5 text-sm">
                    <LogIn size={16} aria-hidden="true" /> {t.discord.rejoin}
                </button>
            </Notice>
        );
    }
    const level = savedLevel();
    const queue = `/api/discord/match?${new URLSearchParams({ session, ...(level === undefined ? {} : { level: String(level) }) })}`;
    return (
        <BattleHostContext.Provider value={host}>
            {place === 'instance' && <InstanceTable key={round} sdk={sdk} session={session} lang={lang} onAway={reason => setAway(reason ?? 'left')} />}
            {place === 'search' && (
                <>
                    <Searching lang={lang} path={queue} onCancel={backToInstance} onMatched={code => setPlace({ code })} />
                    <SearchPresence sdk={sdk} lang={lang} />
                </>
            )}
            {typeof place === 'object' && <PublicTable key={place.code} code={place.code} sdk={sdk} session={session} lang={lang} onLeave={backToInstance} />}
            {guideModal}
        </BattleHostContext.Provider>
    );
}

/** "Looking for a match" on the player's profile while in the queue (nothing if they didn't allow it). */
function SearchPresence({ sdk, lang }: { sdk: Sdk; lang: Lang }) {
    useEffect(() => {
        sdk.commands.setActivity({ activity: searchingPresence(lang) }).catch(() => {});
    }, [sdk, lang]);
    return null;
}

/** A public table matchmaking found for this Discord player (not the Activity's own table). */
function PublicTable({ code, sdk, session, lang, onLeave }: { code: string; sdk: Sdk; session: string; lang: Lang; onLeave: () => void }) {
    const params = new URLSearchParams({ session }).toString();
    const battle = useBattle(code, () => `/api/discord/public/${code}?${params}`);
    usePresence(sdk, battle.room, battle.you, lang);
    return <BattleScreens battle={battle} lang={lang} onLeave={onLeave} />;
}

function InstanceTable({ sdk, session, lang, onAway }: { sdk: Sdk; session: string; lang: Lang; onAway: (reason: BattleProblem | null) => void }) {
    const { instanceId } = sdk;
    const params = new URLSearchParams({ session, lang }).toString();
    const battle = useBattle(instanceId, () => `/api/discord/battle/${encodeURIComponent(instanceId)}?${params}`);
    usePresence(sdk, battle.room, battle.you, lang);
    return <BattleScreens battle={battle} lang={lang} onLeave={onAway} />;
}

/** Discord accepts a few presence updates per 20 s: send the latest at most this often. */
const PRESENCE_INTERVAL_MS = 5_000;

/**
 * Keeps the player's Rich Presence in step with the table: sent only when what it
 * says changes (phase, board, place), throttled, and dropped for good if the player
 * didn't grant rpc.activities.write (the battle works the same without it).
 */
function usePresence(sdk: Sdk, room: PublicRoom | null, you: string, lang: Lang) {
    const activity = useMemo(() => (room && you ? battlePresence(room, you, lang) : null), [room, you, lang]);
    const key = activity ? JSON.stringify(activity) : '';
    const state = useRef({ sent: '', lastAt: 0, disabled: false, timer: undefined as ReturnType<typeof setTimeout> | undefined, latest: null as PresenceActivity | null });

    useEffect(() => {
        const s = state.current;
        s.latest = activity;
        if (!activity || s.disabled || key === s.sent) return;
        const send = () => {
            s.timer = undefined;
            const latest = s.latest;
            const latestKey = latest ? JSON.stringify(latest) : '';
            if (!latest || s.disabled || latestKey === s.sent) return;
            s.sent = latestKey;
            s.lastAt = Date.now();
            sdk.commands.setActivity({ activity: latest }).catch(error => {
                console.warn('Rich Presence unavailable', error);
                s.disabled = true;
            });
        };
        if (s.timer) return;
        const wait = s.lastAt + PRESENCE_INTERVAL_MS - Date.now();
        if (wait <= 0) send();
        else s.timer = setTimeout(send, wait);
    }, [key, activity, sdk]);

    useEffect(() => () => clearTimeout(state.current.timer), []);
}
