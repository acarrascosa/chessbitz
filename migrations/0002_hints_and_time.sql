-- Aggregated hints and playing time per (day, mistakes) bucket, to show today's averages.
-- `detailed` counts the plays that reported them (results sent before this migration did not).
ALTER TABLE daily_results ADD COLUMN hints INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_results ADD COLUMN seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_results ADD COLUMN detailed INTEGER NOT NULL DEFAULT 0;
