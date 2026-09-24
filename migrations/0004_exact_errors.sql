-- Hints now cost half an error per helped move, so errors can be 1.5. The buckets
-- stay whole (rounded up); these keep the exact sum in half points for the averages,
-- and how many plays reported it (results sent before this count their bucket).
ALTER TABLE daily_results ADD COLUMN halves INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_results ADD COLUMN exact INTEGER NOT NULL DEFAULT 0;
