-- ============================================================
-- Auto-opstelling: team_settings uitbreiden + speler voorkeurspositie
-- ============================================================

-- 1. Nieuwe kolommen op team_settings voor auto-opstelling defaults
ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS auto_lineup_enabled            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_lineup_basis              text    NOT NULL DEFAULT 'bench_minutes'
    CHECK (auto_lineup_basis IN ('bench_minutes', 'played_minutes')),
  ADD COLUMN IF NOT EXISTS auto_lineup_rotate_goalkeeper   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_lineup_position_mode       text    NOT NULL DEFAULT 'off'
    CHECK (auto_lineup_position_mode IN ('off', 'soft', 'strict'));

-- 2. Voorkeurspositie opslaan per speler
--    preferred_position = Keeper / Verdediger / Middenvelder / Aanvaller (of NULL = geen voorkeur)
--    can_play_goalkeeper = mag deze speler ook als keeper worden opgesteld?
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS preferred_position   text    DEFAULT NULL
    CHECK (preferred_position IS NULL OR preferred_position IN ('Keeper', 'Verdediger', 'Middenvelder', 'Aanvaller')),
  ADD COLUMN IF NOT EXISTS can_play_goalkeeper   boolean NOT NULL DEFAULT false;
