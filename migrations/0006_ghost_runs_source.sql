-- Where each recorded rival comes from: a real finished battle, or the seed script
-- (simulated runs for day one, to be replaced as real ones pile up).
ALTER TABLE ghost_runs ADD COLUMN source TEXT NOT NULL DEFAULT 'real';

-- The seed script inserted its runs with one shared timestamp; a battle records at most 4.
UPDATE ghost_runs SET source = 'seed'
WHERE recorded_at IN (SELECT recorded_at FROM ghost_runs GROUP BY recorded_at HAVING COUNT(*) > 4);

CREATE INDEX IF NOT EXISTS ghost_runs_pick ON ghost_runs (format, source, total_points);
