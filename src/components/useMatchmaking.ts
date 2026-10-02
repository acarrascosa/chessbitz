import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchClientMessage, MatchServerMessage, MatchSummary } from '../lib/matchmaking';

export interface QueueStatus {
    searching: number;
    playing: number;
    /** When a recorded rival comes if nobody turns up (server clock). */
    waitUntil: number;
    /** The end of the public match the wait is for, if it is. */
    waitingFor: number | null;
    /** A later match the player could choose to wait for. */
    canWaitFor: number | null;
}

export type SearchProblem = 'busy' | 'unavailable' | 'replaced';

export interface Matchmaking {
    status: QueueStatus | null;
    /** Table code once matched. */
    matched: string | null;
    problem: SearchProblem | null;
    send: (message: MatchClientMessage) => void;
    /** The server's clock, so the countdown matches its decisions. */
    serverNow: () => number;
}

const PING_MS = 25_000;

/**
 * Searching for a public match: a WebSocket to the queue while mounted (closing
 * it is cancelling). `path` is the queue's path for this host (web or Discord).
 */
export function useMatchmaking(path: string): Matchmaking {
    const [status, setStatus] = useState<QueueStatus | null>(null);
    const [matched, setMatched] = useState<string | null>(null);
    const [problem, setProblem] = useState<SearchProblem | null>(null);
    const socket = useRef<WebSocket | null>(null);
    const offset = useRef(0);

    useEffect(() => {
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${protocol}://${location.host}${path}`);
        socket.current = ws;
        let done = false;
        const ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS);
        ws.onmessage = event => {
            if (event.data === 'pong') return;
            let message: MatchServerMessage;
            try {
                message = JSON.parse(event.data);
            } catch {
                return;
            }
            offset.current = message.now - Date.now();
            if (message.t === 'status') {
                const { t: _t, now: _now, ...rest } = message;
                setStatus(rest);
            } else if (message.t === 'matched') {
                done = true;
                setMatched(message.code);
            } else {
                done = true;
                setProblem('busy');
            }
        };
        ws.onclose = event => {
            clearInterval(ping);
            if (done) return;
            setProblem(event.code === 4001 ? 'replaced' : 'unavailable');
        };
        return () => {
            done = true;
            clearInterval(ping);
            ws.close(1000);
        };
    }, [path]);

    const send = useCallback((message: MatchClientMessage) => {
        if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
    }, []);
    const serverNow = useCallback(() => Date.now() + offset.current, []);
    return { status, matched, problem, send, serverNow };
}

/** Public matches at a glance (people searching, playing, the last one), refreshed while mounted; null without a Worker. */
export function useMatchSummary(every = 15_000): MatchSummary | null {
    const [summary, setSummary] = useState<MatchSummary | null>(null);
    useEffect(() => {
        let stopped = false;
        const load = () => fetch('/api/match/status')
            .then(response => (response.ok && response.headers.get('Content-Type')?.includes('json') ? response.json() : null))
            .then(data => !stopped && setSummary(data as MatchSummary | null))
            .catch(() => !stopped && setSummary(null));
        load();
        const timer = setInterval(load, every);
        return () => {
            stopped = true;
            clearInterval(timer);
        };
    }, [every]);
    return summary;
}
