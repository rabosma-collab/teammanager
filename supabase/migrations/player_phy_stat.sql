-- Add PHY (Fysiek) stat to players table
-- Default value 70 (slightly above average, reflects baseline fitness)

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS phy integer NOT NULL DEFAULT 70;
