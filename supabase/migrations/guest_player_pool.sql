-- Gastspeler pool: vaste pool van gastspelers per team
-- Uitvoeren in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS guest_player_pool (
  id serial PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  times_played integer NOT NULL DEFAULT 1,
  last_used timestamp with time zone DEFAULT now(),
  UNIQUE(team_id, name)
);

-- RLS
ALTER TABLE guest_player_pool ENABLE ROW LEVEL SECURITY;

-- Alle teamleden mogen de pool zien
CREATE POLICY "team members can view guest pool"
  ON guest_player_pool FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = guest_player_pool.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- Alleen managers mogen pool aanpassen
CREATE POLICY "managers can insert guest pool"
  ON guest_player_pool FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = guest_player_pool.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'manager'
        AND tm.status = 'active'
    )
  );

CREATE POLICY "managers can update guest pool"
  ON guest_player_pool FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = guest_player_pool.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'manager'
        AND tm.status = 'active'
    )
  );

CREATE POLICY "managers can delete guest pool"
  ON guest_player_pool FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = guest_player_pool.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'manager'
        AND tm.status = 'active'
    )
  );

-- Backfill: bestaande gastspelers automatisch in de pool zetten
-- Neemt de meest recente naam per team (case-sensitive DISTINCT)
INSERT INTO guest_player_pool (team_id, name, times_played, last_used)
SELECT
  team_id,
  name,
  COUNT(*) AS times_played,
  now() AS last_used
FROM guest_players
GROUP BY team_id, name
ON CONFLICT (team_id, name) DO NOTHING;
