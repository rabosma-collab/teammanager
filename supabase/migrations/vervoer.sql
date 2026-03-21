-- ============================================================
-- Vervoer-taak
--
-- Voegt vervoer toe als wedstrijdtaak, vergelijkbaar met wasbeurt.
-- - players.transport_count: telt hoe vaak een speler vervoer heeft geregeld
-- - matches.transport_player_ids: array van speler-IDs die vervoer regelen (override)
-- - team_settings.track_vervoer: toggle voor de feature
-- - team_settings.vervoer_count: aantal chauffeurs (default 3)
-- ============================================================

-- Spelers: tel hoe vaak iemand vervoer heeft geregeld
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS transport_count int NOT NULL DEFAULT 0;

-- Wedstrijden: handmatige override (array van player_ids)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS transport_player_ids int[] NOT NULL DEFAULT '{}';

-- Teaminstellingen: feature toggle + aantal chauffeurs
ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS track_vervoer boolean NOT NULL DEFAULT true;

ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS vervoer_count int NOT NULL DEFAULT 3;
