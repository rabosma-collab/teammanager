-- Voeg team_id toe aan substitution_schemes zodat team-specifieke schema's mogelijk zijn.
-- NULL = globaal/systeem-schema (zichtbaar voor alle teams)
-- NOT NULL = team-specifiek schema (alleen zichtbaar voor dat team)

ALTER TABLE substitution_schemes
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE CASCADE;

ALTER TABLE substitution_schemes ENABLE ROW LEVEL SECURITY;

-- RLS: iedereen mag globale schema's lezen; ingelogde gebruikers mogen hun eigen team-schema's lezen
DROP POLICY IF EXISTS "substitution_schemes_select" ON substitution_schemes;
CREATE POLICY "substitution_schemes_select" ON substitution_schemes
  FOR SELECT USING (
    team_id IS NULL
    OR team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Schrijven: alleen managers mogen team-specifieke schema's aanmaken/wijzigen
DROP POLICY IF EXISTS "substitution_schemes_insert" ON substitution_schemes;
CREATE POLICY "substitution_schemes_insert" ON substitution_schemes
  FOR INSERT WITH CHECK (
    team_id IS NOT NULL
    AND team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'manager' AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "substitution_schemes_delete" ON substitution_schemes;
CREATE POLICY "substitution_schemes_delete" ON substitution_schemes
  FOR DELETE USING (
    team_id IS NOT NULL
    AND team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'manager' AND status = 'active'
    )
  );
