-- ============================================================
-- Spelerstatus: selectie / gastspeler / oud-speler
-- ============================================================
-- Een speler kan verplaatst worden naar de gastspeler-pool of naar oud-spelers.
-- De historie (statistieken, opstellingen, wissels) blijft volledig bewaard,
-- maar de speler verschijnt niet meer standaard in de wedstrijdselectie.
--   'active' = normale selectie (default)
--   'guest'  = gastspeler (historie bewaard, niet in standaardselectie)
--   'former' = oud-speler (historie bewaard, niet in standaardselectie)

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- De players-tabel had al een oude 'status'-kolom (waarden zoals 'aanwezig'/'afwezig').
-- Daardoor werd ADD COLUMN IF NOT EXISTS overgeslagen en bleven die legacy-waarden staan,
-- waardoor spelers uit de selectie verdwenen. Normaliseer alles wat niet naar het nieuwe
-- schema past terug naar 'active'.
UPDATE players
  SET status = 'active'
  WHERE status IS NULL OR status NOT IN ('active', 'guest', 'former');

-- Pas nu pas de default en CHECK-constraint toe (deze werden overgeslagen als de kolom al bestond).
ALTER TABLE players ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_status_check;
ALTER TABLE players
  ADD CONSTRAINT players_status_check CHECK (status IN ('active', 'guest', 'former'));
