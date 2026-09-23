import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleError, ClientMessage, PublicRoom, ServerMessage } from '../lib/battle';

export type Connection = 'connecting' | 'open' | 'reconnecting';
/** Why the table can't be used: a server refusal, or a local reason. */
export type BattleProblem = BattleError | 'replaced' | 'offline';

const TOKEN_KEY = 'chessbitz-battle-token';
const NAME_KEY = 'chessbitz-battle-name';
/** The table this browser is sitting at, to sit back down after a reload. */
const SEAT_KEY = 'chessbitz-battle-seat';
/** Refusals that retrying won't fix. */
const FATAL: BattleProblem[] = ['full', 'started', 'notFound', 'taken', 'kicked', 'invalid'];
const PING_MS = 25_000;
const MAX_RETRIES = 8;

function storage<T>(read: (s: Storage) => T, fallback: T): T {
    try {
        return read(localStorage);
    } catch {
        return fallback;
    }
}

let memoryToken = '';
/** Random secret that lets this browser reclaim its seat after a reload. */
export function battleToken(): string {
    const saved = storage(s => s.getItem(TOKEN_KEY), null);
    if (saved) return saved;
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const token = memoryToken || btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    memoryToken = token;
    storage(s => s.setItem(TOKEN_KEY, token), undefined);
    return token;
}

export const savedName = () => storage(s => s.getItem(NAME_KEY) ?? '', '');
export const saveName = (name: string) => storage(s => s.setItem(NAME_KEY, name), undefined);
export const savedSeat = () => storage(s => s.getItem(SEAT_KEY) ?? '', '');
export const saveSeat = (code: string | null) =>
    storage(s => (code ? s.setItem(SEAT_KEY, code) : s.removeItem(SEAT_KEY)), undefined);

export interface BattleConnection {
    room: PublicRoom | null;
    /** The player's public id. */
    you: string;
    connection: Connection;
    problem: BattleProblem | null;
    /** Transient refusal of the last action (e.g. "not the host"). */
    notice: BattleError | null;
    send: (message: ClientMessage) => void;
    /** The server's clock, so every player sees the same countdowns. */
    serverNow: () => number;
}

/** WebSocket URL of a table on chessbitz.com; `create` claims a new table only on the first connection. */
export function tableUrl(code: string, name: string, create: boolean) {
    return (joined: boolean) => {
        const params = new URLSearchParams({ token: battleToken(), name });
        if (create && !joined) params.set('create', '1');
        return `/api/battle/${code}?${params}`;
    };
}

/**
 * Keeps a WebSocket to a battle table open, reconnecting with backoff when the
 * connection drops (the seat is kept thanks to the token or Discord session).
 * `path` gives the socket's path, knowing whether we had already joined; a new
 * `key` opens a new connection.
 */
export function useBattle(key: string, path: (joined: boolean) => string): BattleConnection {
    const [room, setRoom] = useState<PublicRoom | null>(null);
    const [you, setYou] = useState('');
    const [connection, setConnection] = useState<Connection>('connecting');
    const [problem, setProblem] = useState<BattleProblem | null>(null);
    const [notice, setNotice] = useState<BattleError | null>(null);
    const socket = useRef<WebSocket | null>(null);
    const offset = useRef(0);
    const pathRef = useRef(path);
    pathRef.current = path;

    useEffect(() => {
        let stopped = false;
        let retries = 0;
        let joined = false;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let pingTimer: ReturnType<typeof setInterval> | undefined;

        const connect = () => {
            const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
            const ws = new WebSocket(`${protocol}://${location.host}${pathRef.current(joined)}`);
            socket.current = ws;

            ws.onopen = () => {
                pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS);
            };
            ws.onmessage = event => {
                if (event.data === 'pong') return;
                let message: ServerMessage;
                try {
                    message = JSON.parse(event.data);
                } catch {
                    return;
                }
                offset.current = message.now - Date.now();
                if (message.t === 'room') {
                    joined = true;
                    retries = 0;
                    setRoom(message.room);
                    setYou(message.you);
                    setConnection('open');
                    setProblem(null);
                } else if (FATAL.includes(message.error) && (!joined || message.error === 'kicked')) {
                    stopped = true;
                    setProblem(message.error);
                } else {
                    setNotice(message.error);
                }
            };
            ws.onclose = event => {
                clearInterval(pingTimer);
                if (stopped) return;
                if (event.code === 4001) {
                    stopped = true;
                    setProblem('replaced');
                    return;
                }
                if (retries >= MAX_RETRIES) {
                    setProblem('offline');
                    return;
                }
                setConnection(joined ? 'reconnecting' : 'connecting');
                retryTimer = setTimeout(connect, Math.min(8_000, 500 * 2 ** retries++));
            };
        };

        connect();
        // Coming back to a backgrounded tab: reconnect straight away instead of waiting for the backoff.
        const onVisible = () => {
            if (document.visibilityState !== 'visible' || stopped) return;
            if (socket.current?.readyState === WebSocket.CLOSED) {
                clearTimeout(retryTimer);
                retries = 0;
                connect();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            stopped = true;
            clearTimeout(retryTimer);
            clearInterval(pingTimer);
            document.removeEventListener('visibilitychange', onVisible);
            socket.current?.close(1000);
        };
    }, [key]);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 4_000);
        return () => clearTimeout(timer);
    }, [notice]);

    const send = useCallback((message: ClientMessage) => {
        if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
    }, []);
    const serverNow = useCallback(() => Date.now() + offset.current, []);

    return { room, you, connection, problem, notice, send, serverNow };
}

/** Re-renders every `ms` while `active`, for clocks. */
export function useTicker(active: boolean, ms = 200) {
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => setTick(t => t + 1), ms);
        return () => clearInterval(timer);
    }, [active, ms]);
}
