-- lineup_period_formations
-- Bewaart per periode de formatie die een manager heeft gekozen (optionele override).
-- Als er geen record bestaat voor een periode, wordt de standaardformatie van de wedstrijd gebruikt.

CREATE TABLE IF NOT EXISTS lineup_period_formations (
  match_id  bigint  NOT NULL REFERENCES matches(id)  ON DELETE CASCADE,
  team_id   uuid    NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  period    integer NOT NULL CHECK (period >= 2),
  formation text    NOT NULL,
  PRIMARY KEY (match_id, period)
);

ALTER TABLE lineup_period_formations ENABLE ROW LEVEL SECURITY;

-- Alle actieve teamleden mogen lezen
CREATE POLICY "team_members_read_period_formations"
  ON lineup_period_formations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = lineup_period_formations.team_id
        AND tm.user_id = auth.uid()
        AND tm.status  = 'active'
    )
  );

-- Alleen managers en staff mogen schrijven
CREATE POLICY "managers_write_period_formations"
  ON lineup_period_formations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = lineup_period_formations.team_id
        AND tm.user_id = auth.uid()
        AND tm.role    IN ('manager', 'staff')
        AND tm.status  = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = lineup_period_formations.team_id
        AND tm.user_id = auth.uid()
        AND tm.role    IN ('manager', 'staff')
        AND tm.status  = 'active'
    )
  );
