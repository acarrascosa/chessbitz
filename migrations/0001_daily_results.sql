-- Anonymous, aggregated challenge results: one counter per (day, mistakes).
-- mistakes = 0..4 for completed lines, 5 for lost challenges.
CREATE TABLE IF NOT EXISTS daily_results (
    day INTEGER NOT NULL,
    mistakes INTEGER NOT NULL CHECK (mistakes BETWEEN 0 AND 5),
    plays INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, mistakes)
) WITHOUT ROWID;
