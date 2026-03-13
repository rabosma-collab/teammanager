-- lineup_period_overrides
-- Bewaart per periode de positiewijzigingen die een manager heeft doorgevoerd
-- via drag-and-drop op de pitchview (periode 2+).
-- Dit is een optionele override bovenop de berekende opstelling (computeLineupForPeriod).
-- Als er geen override bestaat voor een periode, wordt de berekende opstelling gebruikt.

CREATE TABLE IF NOT EXISTS lineup_period_overrides (
  match_id  bigint  NOT NULL REFERENCES matches(id)  ON DELETE CASCADE,
  team_id   uuid    NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  period    integer NOT NULL CHECK (period >= 2),
  position  integer NOT NULL CHECK (position >= 0),
  player_id integer          REFERENCES players(id)  ON DELETE SET NULL,
  PRIMARY KEY (match_id, period, position)
);

ALTER TABLE lineup_period_overrides ENABLE ROW LEVEL SECURITY;

-- Alle actieve teamleden mogen lezen
CREATE POLICY "team_members_read_period_overrides"
  ON lineup_period_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = lineup_period_overrides.team_id
        AND tm.user_id = auth.uid()
        AND tm.status  = 'active'
    )
  );

-- Alleen managers en staff mogen schrijven
CREATE POLICY "managers_write_period_overrides"
  ON lineup_period_overrides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = lineup_period_overrides.team_id
        AND tm.user_id = auth.uid()
        AND tm.role    IN ('manager', 'staff')
        AND tm.status  = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = lineup_period_overrides.team_id
        AND tm.user_id = auth.uid()
        AND tm.role    IN ('manager', 'staff')
        AND tm.status  = 'active'
    )
  );
