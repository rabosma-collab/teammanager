-- ============================================================
-- played_minutes.sql
--
-- Voegt gespeelde minuten toe als optionele feature:
--   1. players.played_min         — career totaal gespeelde minuten
--   2. team_settings.track_played_minutes — toggle (default uit)
--
-- HOE UITVOEREN:
--   Plak dit script in de Supabase SQL Editor en voer het uit.
-- ============================================================

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS played_min int NOT NULL DEFAULT 0;

ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS track_played_minutes boolean NOT NULL DEFAULT false;
