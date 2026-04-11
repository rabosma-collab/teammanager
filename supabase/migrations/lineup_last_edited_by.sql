-- Bewaar wie de opstelling als laatste heeft opgeslagen, zodat meerdere managers
-- kunnen zien wie er als laatste aan gewerkt heeft.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS lineup_last_edited_by_name text;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS lineup_last_edited_at timestamptz;