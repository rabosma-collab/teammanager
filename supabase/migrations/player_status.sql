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
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'guest', 'former'));
