-- Migration: consumpties feature
-- Voer uit in Supabase SQL Editor

-- 1. Spelers: consumpties-teller bijhouden (hoeveel keer consumpties meegebracht)
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS consumption_count int DEFAULT 0;

-- 2. Wedstrijden: handmatige override voor wie consumpties meebrengt
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS consumpties_player_id int REFERENCES players(id);

-- 3. Teaminstellingen: feature toggles voor wasbeurt en consumpties
ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS track_wasbeurt boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_consumpties boolean DEFAULT true;
