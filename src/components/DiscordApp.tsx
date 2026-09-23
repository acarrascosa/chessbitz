import { useEffect, useMemo, useState } from 'react';
import { DiscordSDK, DiscordSDKMock } from '@discord/embedded-app-sdk';
import { LogIn, Swords } from 'lucide-react';
import { BattleScreens } from './BattleApp';
import { BattleHostContext, type BattleHost } from './battleHost';
import { useBattle, type BattleProblem } from './useBattle';
import { discordLang, isDiscordLaunch } from '../lib/discord';
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
    sdk._updateCommandMocks({ authorize: async () => ({ code: `mock:${id}:${name}` }) });
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
        scope: ['identify'],
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
    const host = useMemo<BattleHost>(() => ({
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
    return (
        <BattleHostContext.Provider value={host}>
            <InstanceTable key={round} instanceId={sdk.instanceId} session={session} lang={lang} onAway={reason => setAway(reason ?? 'left')} />
        </BattleHostContext.Provider>
    );
}

function InstanceTable({ instanceId, session, lang, onAway }: { instanceId: string; session: string; lang: Lang; onAway: (reason: BattleProblem | null) => void }) {
    const params = new URLSearchParams({ session, lang }).toString();
    const battle = useBattle(instanceId, () => `/api/discord/battle/${encodeURIComponent(instanceId)}?${params}`);
    return <BattleScreens battle={battle} lang={lang} onLeave={onAway} />;
}
