-- Discord Activity: the last battle played in each channel, so the bot can remind
-- the players there the next day. Rows are forgotten after 30 days without playing.
CREATE TABLE IF NOT EXISTS discord_battles (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT,
    lang TEXT NOT NULL,
    -- UTC day number (days since 1970-01-01) of the last match.
    day INTEGER NOT NULL,
    winner_id TEXT,
    winner_name TEXT NOT NULL,
    winner_points INTEGER NOT NULL,
    -- JSON array of the players' Discord user ids.
    players TEXT NOT NULL,
    reminded_day INTEGER
);

CREATE INDEX IF NOT EXISTS discord_battles_day ON discord_battles (day);
