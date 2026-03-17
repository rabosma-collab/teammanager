-- Team approval status
-- Run this in the Supabase SQL Editor

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Bestaande teams zijn al actief
UPDATE teams SET status = 'active' WHERE status IS NULL;

-- Handige view voor super-admin: openstaande verzoeken
CREATE OR REPLACE VIEW pending_teams AS
SELECT
  t.id,
  t.name,
  t.color,
  t.created_at,
  tm.user_id,
  au.email
FROM teams t
JOIN team_members tm ON tm.team_id = t.id AND tm.role = 'manager'
JOIN auth.users au ON au.id = tm.user_id
WHERE t.status = 'pending'
ORDER BY t.created_at DESC;

-- Goedkeuren: UPDATE teams SET status = 'active' WHERE id = '<team-id>';
-- Afwijzen:   UPDATE teams SET status = 'rejected' WHERE id = '<team-id>';
