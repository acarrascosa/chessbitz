-- Web Push subscriptions (worker/push.ts): what the browser's push service needs,
-- the topics chosen (daily, battle, match) and the language of the messages.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'es',
    topics TEXT NOT NULL,
    -- SHA-256 of the browser's battle token, so someone searching isn't told about themselves.
    token TEXT,
    created_at INTEGER NOT NULL,
    -- When each topic was last delivered, so one doesn't hold back another.
    last_daily_at INTEGER,
    last_battle_at INTEGER,
    last_match_at INTEGER
);
