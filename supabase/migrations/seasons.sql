-- Seizoenen: nieuw seizoen starten, stats per seizoen opslaan
-- Run this in the Supabase SQL Editor

-- 1. Seasons tabel
CREATE TABLE IF NOT EXISTS seasons (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        text NOT NULL,
  start_date  date,
  end_date    date,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. season_id op matches
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS season_id bigint REFERENCES seasons(id) ON DELETE SET NULL;

-- 3. Player season stats snapshot tabel
CREATE TABLE IF NOT EXISTS player_season_stats (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id           int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id           bigint NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id             uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  goals               int NOT NULL DEFAULT 0,
  assists             int NOT NULL DEFAULT 0,
  yellow_cards        int NOT NULL DEFAULT 0,
  red_cards           int NOT NULL DEFAULT 0,
  own_goals           int NOT NULL DEFAULT 0,
  min                 int NOT NULL DEFAULT 0,
  wash_count          int NOT NULL DEFAULT 0,
  consumption_count   int NOT NULL DEFAULT 0,
  transport_count     int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, season_id)
);

-- 4. Retroactief seizoen aanmaken voor bestaande teams
-- Voor elk bestaand team: maak "Seizoen 1" aan en koppel alle bestaande wedstrijden
INSERT INTO seasons (team_id, name, start_date, is_active)
SELECT DISTINCT
  team_id,
  'Seizoen 1',
  MIN(date)::date,
  true
FROM matches
GROUP BY team_id
ON CONFLICT DO NOTHING;

-- Koppel alle bestaande wedstrijden aan het retroactieve seizoen
UPDATE matches m
SET season_id = s.id
FROM seasons s
WHERE s.team_id = m.team_id
  AND m.season_id IS NULL;

-- 5. RLS
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_stats ENABLE ROW LEVEL SECURITY;

-- Seasons: lezen voor team members, schrijven voor managers
CREATE POLICY "seasons_select" ON seasons
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "seasons_insert" ON seasons
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'manager' AND status = 'active'
    )
  );

CREATE POLICY "seasons_update" ON seasons
  FOR UPDATE USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'manager' AND status = 'active'
    )
  );

-- Player season stats: lezen voor team members, schrijven via RPC (SECURITY DEFINER)
CREATE POLICY "player_season_stats_select" ON player_season_stats
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 6. RPC: start_new_season
-- Slaat huidige stats op als snapshot, reset players stats, maakt nieuw seizoen aan
CREATE OR REPLACE FUNCTION start_new_season(
  p_team_id   uuid,
  p_name      text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_season_id bigint;
  v_new_season_id bigint;
BEGIN
  -- Controleer of aanroeper manager is
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = auth.uid()
      AND team_id = p_team_id
      AND role = 'manager'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Geen toegang';
  END IF;

  -- Haal actief seizoen op
  SELECT id INTO v_old_season_id
  FROM seasons
  WHERE team_id = p_team_id AND is_active = true
  LIMIT 1;

  -- Sla huidige spelersstats op als seizoen-snapshot
  IF v_old_season_id IS NOT NULL THEN
    INSERT INTO player_season_stats (
      player_id, season_id, team_id,
      goals, assists, yellow_cards, red_cards, own_goals,
      min, wash_count, consumption_count, transport_count
    )
    SELECT
      id, v_old_season_id, p_team_id,
      goals, assists, yellow_cards, red_cards, COALESCE(own_goals, 0),
      min, wash_count, consumption_count, COALESCE(transport_count, 0)
    FROM players
    WHERE team_id = p_team_id AND is_guest IS NOT TRUE
    ON CONFLICT (player_id, season_id) DO UPDATE SET
      goals             = EXCLUDED.goals,
      assists           = EXCLUDED.assists,
      yellow_cards      = EXCLUDED.yellow_cards,
      red_cards         = EXCLUDED.red_cards,
      own_goals         = EXCLUDED.own_goals,
      min               = EXCLUDED.min,
      wash_count        = EXCLUDED.wash_count,
      consumption_count = EXCLUDED.consumption_count,
      transport_count   = EXCLUDED.transport_count;

    -- Sluit het oude seizoen af
    UPDATE seasons
    SET is_active = false, end_date = CURRENT_DATE
    WHERE id = v_old_season_id;
  END IF;

  -- Reset spelersstats
  UPDATE players
  SET
    goals             = 0,
    assists           = 0,
    yellow_cards      = 0,
    red_cards         = 0,
    own_goals         = 0,
    min               = 0,
    wash_count        = 0,
    consumption_count = 0,
    transport_count   = 0
  WHERE team_id = p_team_id AND is_guest IS NOT TRUE;

  -- Maak nieuw seizoen aan
  INSERT INTO seasons (team_id, name, start_date, is_active)
  VALUES (p_team_id, p_name, CURRENT_DATE, true)
  RETURNING id INTO v_new_season_id;

  RETURN v_new_season_id;
END;
$$;
