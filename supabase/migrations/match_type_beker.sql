-- Add 'beker' (cup match) as a valid match_type
-- 'competitie'     = competition match (default)
-- 'oefenwedstrijd' = friendly match
-- 'beker'          = cup match

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_match_type_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_match_type_check
  CHECK (match_type IN ('competitie', 'oefenwedstrijd', 'beker'));
