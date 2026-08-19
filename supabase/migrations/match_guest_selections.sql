-- Gastspelers per wedstrijd kiesbaar (één doorlopend profiel)
-- Reguliere spelers met status 'guest' vallen standaard buiten de selectie.
-- Deze tabel markeert per wedstrijd welke gast-teamleden tóch meedoen, zodat ze op de
-- bank verschijnen onder hun eigen identiteit (players.id) en hun statistieken doorlopen.
-- Run this in the Supabase SQL Editor

-- 1. Tabel
CREATE TABLE IF NOT EXISTS match_guest_selections (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  match_id   bigint NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id  int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_guest_selections_match_id
  ON match_guest_selections (match_id);

-- 2. RLS
ALTER TABLE match_guest_selections ENABLE ROW LEVEL SECURITY;

-- Lezen: alle actieve teamleden
DROP POLICY IF EXISTS "match_guest_selections_select" ON match_guest_selections;
CREATE POLICY "match_guest_selections_select" ON match_guest_selections
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Schrijven (insert/delete): alleen managers
DROP POLICY IF EXISTS "match_guest_selections_insert" ON match_guest_selections;
CREATE POLICY "match_guest_selections_insert" ON match_guest_selections
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'manager' AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "match_guest_selections_delete" ON match_guest_selections;
CREATE POLICY "match_guest_selections_delete" ON match_guest_selections
  FOR DELETE USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'manager' AND status = 'active'
    )
  );
