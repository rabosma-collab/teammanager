-- Add match_type to matches table
-- 'competitie' = competition match (default)
-- 'oefenwedstrijd' = friendly match

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS match_type text NOT NULL DEFAULT 'competitie'
  CHECK (match_type IN ('competitie', 'oefenwedstrijd'));
