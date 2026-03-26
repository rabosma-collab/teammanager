-- ============================================================
-- player_motivation.sql
--
-- Voegt Spelersmotivatie-instellingen toe aan team_settings:
--   1. player_card_mode  — 'competitive' | 'teamsterren' | 'none'
--   2. spdw_enabled      — boolean (alleen actief bij competitive)
--   3. allow_edit_others — boolean (alleen actief bij competitive)
--
-- Bestaande teams: houden huidige gedrag (competitive, spdw aan,
--                  edit_others aan voor backwards compatibility)
-- Nieuwe teams:    kiezen via wizard; edit_others default uit
--
-- HOE UITVOEREN:
--   Plak dit script in de Supabase SQL Editor en voer het uit.
-- ============================================================

-- 1. Kolommen toevoegen
ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS player_card_mode  text    NOT NULL DEFAULT 'competitive',
  ADD COLUMN IF NOT EXISTS spdw_enabled      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_edit_others boolean NOT NULL DEFAULT true;

-- 2. Bestaande teams expliciet op huidige gedrag zetten
--    (zodat niets verandert voor bestaande teams)
UPDATE team_settings
SET
  player_card_mode  = 'competitive',
  spdw_enabled      = true,
  allow_edit_others = true
WHERE player_card_mode = 'competitive';  -- no-op, maar documenteert de intentie
