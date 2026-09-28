CREATE TABLE IF NOT EXISTS ghost_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    format TEXT NOT NULL,
    board_ids TEXT NOT NULL,
    display_name TEXT NOT NULL,
    results TEXT NOT NULL,
    total_points INTEGER NOT NULL,
    boards_solved INTEGER NOT NULL,
    board_count INTEGER NOT NULL,
    recorded_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ghost_runs_format ON ghost_runs (format);
CREATE INDEX IF NOT EXISTS ghost_runs_points ON ghost_runs (format, total_points);
