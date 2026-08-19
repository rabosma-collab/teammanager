-- Kernfix: elke wedstrijd moet onder een seizoen vallen
-- Wees-wedstrijden (season_id IS NULL) verdwijnen zodra een team een actief seizoen krijgt.
-- Deze migratie is idempotent en mag opnieuw gedraaid worden.
-- Run this in the Supabase SQL Editor

-- 1. Teams met wees-wedstrijden maar zonder actief seizoen: maak een actief 'Seizoen 1' aan.
INSERT INTO seasons (team_id, name, start_date, is_active)
SELECT
  m.team_id,
  'Seizoen 1',
  MIN(m.date)::date,
  true
FROM matches m
WHERE m.season_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM seasons s
    WHERE s.team_id = m.team_id AND s.is_active = true
  )
GROUP BY m.team_id;

-- 2. Koppel alle resterende wees-wedstrijden aan het actieve seizoen van hun team.
UPDATE matches m
SET season_id = s.id
FROM seasons s
WHERE s.team_id = m.team_id
  AND s.is_active = true
  AND m.season_id IS NULL;
