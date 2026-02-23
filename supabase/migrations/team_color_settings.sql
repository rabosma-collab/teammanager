-- ============================================================
-- team_color_settings.sql
--
-- Voegt kleur en setup-status toe aan teams,
-- en maakt de team_settings tabel aan.
--
-- Uitvoeren in Supabase SQL Editor (eenmalig).
-- ============================================================

-- 1. Uitbreiden teams tabel
ALTER TABLE teams ADD COLUMN IF NOT EXISTS color text DEFAULT '#f59e0b';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS setup_done boolean DEFAULT false;

-- 2. team_settings tabel
CREATE TABLE IF NOT EXISTS team_settings (
  team_id            uuid PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  default_formation  text DEFAULT '4-3-3-aanvallend',
  match_duration     integer DEFAULT 90,
  track_goals        boolean DEFAULT true,
  track_assists      boolean DEFAULT true,
  track_minutes      boolean DEFAULT true,
  track_cards        boolean DEFAULT false,
  track_clean_sheets boolean DEFAULT false,
  track_spdw         boolean DEFAULT true,
  track_results      boolean DEFAULT true
);

-- 3. RLS inschakelen
ALTER TABLE team_settings ENABLE ROW LEVEL SECURITY;

-- Alle actieve teamleden kunnen de instellingen lezen
CREATE POLICY "team_members_can_read_settings"
  ON team_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_settings.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.status = 'active'
    )
  );

-- Alleen managers kunnen instellingen aanpassen (INSERT, UPDATE, DELETE)
CREATE POLICY "managers_can_manage_settings"
  ON team_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_settings.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role = 'manager'
        AND team_members.status = 'active'
    )
  );
