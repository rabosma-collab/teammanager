-- ============================================================
-- rls_tabellen.sql
--
-- RLS voor tabellen die nog niet beveiligd waren:
--   players, matches, lineups, substitutions, match_absences,
--   guest_players, team_settings, position_instructions,
--   match_position_instructions
--
-- Vereiste: rls_beveiliging.sql is al uitgevoerd
-- (hulpfuncties is_team_member / is_team_manager bestaan al)
--
-- HOE UITVOEREN:
--   Plak dit script in de Supabase SQL Editor en voer het uit.
--   Het is idempotent: meerdere keren uitvoeren doet geen kwaad.
-- ============================================================


-- ============================================================
-- 1. PLAYERS
-- ============================================================
--
-- Alle teamleden mogen spelers zien (voor de opstelling, kaarten etc.)
-- Alleen managers mogen spelers toevoegen of verwijderen.
-- UPDATE is open voor teamleden: spelers mogen hun eigen naam en
-- avatar bijwerken via ProfileModal.
-- ============================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_select"
  ON players FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "players_insert"
  ON players FOR INSERT
  WITH CHECK (is_team_manager(team_id));

CREATE POLICY "players_update"
  ON players FOR UPDATE
  USING (is_team_member(team_id));

CREATE POLICY "players_delete"
  ON players FOR DELETE
  USING (is_team_manager(team_id));


-- ============================================================
-- 2. MATCHES
-- ============================================================
--
-- Alle teamleden mogen wedstrijden zien.
-- Alleen managers mogen aanmaken, bewerken en verwijderen.
-- ============================================================

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select"
  ON matches FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "matches_insert"
  ON matches FOR INSERT
  WITH CHECK (is_team_manager(team_id));

CREATE POLICY "matches_update"
  ON matches FOR UPDATE
  USING (is_team_manager(team_id));

CREATE POLICY "matches_delete"
  ON matches FOR DELETE
  USING (is_team_manager(team_id));


-- ============================================================
-- 3. LINEUPS
-- ============================================================
--
-- Lineups hebben geen eigen team_id — we joinen via matches.
-- Lezen: alle teamleden (spelers zien de opstelling).
-- Schrijven: alleen managers.
-- ============================================================

ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lineups_select"
  ON lineups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_member(m.team_id)
    )
  );

CREATE POLICY "lineups_insert"
  ON lineups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );

CREATE POLICY "lineups_update"
  ON lineups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );

CREATE POLICY "lineups_delete"
  ON lineups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );


-- ============================================================
-- 4. SUBSTITUTIONS
-- ============================================================

ALTER TABLE substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "substitutions_select"
  ON substitutions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_member(m.team_id)
    )
  );

CREATE POLICY "substitutions_insert"
  ON substitutions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );

CREATE POLICY "substitutions_update"
  ON substitutions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );

CREATE POLICY "substitutions_delete"
  ON substitutions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );


-- ============================================================
-- 5. MATCH_ABSENCES
-- ============================================================
--
-- Spelers mogen hun eigen afwezigheid doorgeven (insert/update).
-- Lezen is voor alle teamleden (manager ziet wie er is).
-- ============================================================

ALTER TABLE match_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "absences_select"
  ON match_absences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_member(m.team_id)
    )
  );

CREATE POLICY "absences_insert"
  ON match_absences FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_member(m.team_id)
    )
  );

CREATE POLICY "absences_update"
  ON match_absences FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_member(m.team_id)
    )
  );

CREATE POLICY "absences_delete"
  ON match_absences FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_member(m.team_id)
    )
  );


-- ============================================================
-- 6. GUEST_PLAYERS
-- ============================================================

ALTER TABLE guest_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guests_select"
  ON guest_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_member(m.team_id)
    )
  );

CREATE POLICY "guests_insert"
  ON guest_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );

CREATE POLICY "guests_update"
  ON guest_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );

CREATE POLICY "guests_delete"
  ON guest_players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );


-- ============================================================
-- 7. TEAM_SETTINGS
-- ============================================================

ALTER TABLE team_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select"
  ON team_settings FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "settings_insert"
  ON team_settings FOR INSERT
  WITH CHECK (is_team_manager(team_id));

CREATE POLICY "settings_update"
  ON team_settings FOR UPDATE
  USING (is_team_manager(team_id));


-- ============================================================
-- 8. POSITION_INSTRUCTIONS
-- ============================================================

ALTER TABLE position_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posinstr_select"
  ON position_instructions FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "posinstr_insert"
  ON position_instructions FOR INSERT
  WITH CHECK (is_team_manager(team_id));

CREATE POLICY "posinstr_update"
  ON position_instructions FOR UPDATE
  USING (is_team_manager(team_id));

CREATE POLICY "posinstr_delete"
  ON position_instructions FOR DELETE
  USING (is_team_manager(team_id));


-- ============================================================
-- 9. MATCH_POSITION_INSTRUCTIONS
-- ============================================================

ALTER TABLE match_position_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mposinstr_select"
  ON match_position_instructions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_member(m.team_id)
    )
  );

CREATE POLICY "mposinstr_insert"
  ON match_position_instructions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );

CREATE POLICY "mposinstr_update"
  ON match_position_instructions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );

CREATE POLICY "mposinstr_delete"
  ON match_position_instructions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id AND is_team_manager(m.team_id)
    )
  );


-- ============================================================
-- 10. MATCH_PLAYER_STATS
-- ============================================================
--
-- Heeft een eigen team_id kolom, dus geen join via matches nodig.
-- save_match_stats RPC is SECURITY DEFINER en omzeilt RLS —
-- schrijven via de app werkt dus sowieso. Deze policies beveiligen
-- directe API-aanroepen.
-- ============================================================

ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matchstats_select"
  ON match_player_stats FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "matchstats_insert"
  ON match_player_stats FOR INSERT
  WITH CHECK (is_team_manager(team_id));

CREATE POLICY "matchstats_update"
  ON match_player_stats FOR UPDATE
  USING (is_team_manager(team_id));

CREATE POLICY "matchstats_delete"
  ON match_player_stats FOR DELETE
  USING (is_team_manager(team_id));


-- ============================================================
-- 11. FIX TEAMS_DELETE POLICY (bug in rls_beveiliging.sql)
-- ============================================================
--
-- Probleem: TeamSettingsView verwijdert team_members op regel 152
-- en daarna teams op regel 153. Op dat moment is is_team_manager()
-- al false (team_members is leeg), waardoor de teams DELETE werd
-- geblokkeerd door RLS — een foutmelding terwijl alle andere data
-- al verwijderd was.
--
-- Oplossing: voeg created_by = auth.uid() toe als fallback.
-- De oorspronkelijke maker kan het team altijd verwijderen,
-- ook als team_members al weg is.
-- ============================================================

DROP POLICY IF EXISTS "teams_delete" ON teams;

CREATE POLICY "teams_delete"
  ON teams FOR DELETE
  USING (
    is_team_manager(id)
    OR created_by = auth.uid()
  );
