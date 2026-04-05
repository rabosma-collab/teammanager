-- Multi-account per speler: vader + moeder kunnen beide inloggen namens hetzelfde kind
-- Uitvoeren in Supabase SQL Editor

-- 1. Verwijder de bestaande unique constraint op (team_id, player_id)
--    zodat meerdere accounts aan dezelfde speler gekoppeld kunnen worden.
--    De exacte naam kan verschillen; probeer beide varianten.
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_team_id_player_id_key;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_team_id_player_id_unique;

-- 2. Nieuwe constraint: één user mag niet twee keer hetzelfde team+speler hebben.
--    (voorkomt dat dezelfde persoon zichzelf twee keer koppelt)
DROP INDEX IF EXISTS team_members_user_player_team_unique;
CREATE UNIQUE INDEX team_members_user_player_team_unique
  ON team_members (team_id, user_id, player_id)
  WHERE player_id IS NOT NULL AND status = 'active';

-- 3. display_name kolom op team_members bestaat al voor stafleden.
--    Niets te doen — we hergebruiken dezelfde kolom voor ouder-accounts.
