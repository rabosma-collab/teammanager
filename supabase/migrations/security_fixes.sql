-- ============================================================
-- security_fixes.sql
--
-- Beveiligingsfixes voor:
--   1. stat_credits UPDATE  — alleen eigen rij + award_player_credits() RPC
--   2. players UPDATE       — split: manager alles / speler eigen rij
--   3. match_absences       — speler mag alleen eigen afwezigheid
--   4. invite_tokens UPDATE — tighter + accept_invite() RPC (atomisch)
--   5. activity_log INSERT  — via insert_activity() RPC (actor_id server-side)
--
-- HOE UITVOEREN:
--   Plak dit script in de Supabase SQL Editor en voer het uit.
--   Het is idempotent: meerdere keren uitvoeren doet geen kwaad.
-- ============================================================


-- ============================================================
-- 1. STAT_CREDITS — eigen rij bijwerken (spelen) + RPC voor uitbetaling
-- ============================================================
--
-- Probleem: elke teamgenoot kon de credits van een ander bijwerken.
--
-- Oplossing:
--   a) UPDATE-policy beperkt tot eigen player_id (spendCredit / spendCreditsForStats)
--   b) award_player_credits() RPC omzeilt RLS voor SPDW-uitbetaling
--      (wordt door elk teamlid getriggerd, maar controleert teamlidmaatschap intern)
-- ============================================================

DROP POLICY IF EXISTS "credits_update" ON stat_credits;

CREATE POLICY "credits_update"
  ON stat_credits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = stat_credits.team_id
        AND tm.user_id = auth.uid()
        AND tm.player_id = stat_credits.player_id
        AND tm.status = 'active'
    )
  );

-- SECURITY DEFINER: omzeilt RLS — mag door elk teamlid worden aangeroepen
-- voor SPDW-uitbetalingen waarbij andere spelers credits ontvangen.
CREATE OR REPLACE FUNCTION public.award_player_credits(
  p_player_id  int,
  p_team_id    uuid,
  p_new_balance int,
  p_change     int,
  p_reason     text,
  p_match_id   bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Controleer of aanroeper teamlid is
  IF NOT is_team_member(p_team_id) THEN
    RAISE EXCEPTION 'Geen toegang tot dit team';
  END IF;

  UPDATE stat_credits
  SET balance = p_new_balance
  WHERE player_id = p_player_id
    AND team_id   = p_team_id;

  INSERT INTO stat_credit_transactions (team_id, player_id, balance_change, reason, match_id)
  VALUES (p_team_id, p_player_id, p_change, p_reason, p_match_id);
END;
$$;


-- ============================================================
-- 2. PLAYERS UPDATE — split: manager alles / speler eigen rij
-- ============================================================
--
-- Probleem: elke teamgenoot kon stats van alle spelers aanpassen.
--
-- Oplossing:
--   - players_update_manager : managers mogen alles (goals, FIFA-stats, etc.)
--   - players_update_self    : spelers mogen alleen hun eigen rij (naam, avatar)
--                              De kolom-beperking (alleen naam/avatar) is afgedwongen
--                              in de app (ProfileModal). Een extra RPC
--                              (update_own_profile) kan dit in de toekomst
--                              volledig server-side afdwingen.
-- ============================================================

DROP POLICY IF EXISTS "players_update" ON players;

CREATE POLICY "players_update_manager"
  ON players FOR UPDATE
  USING (is_team_manager(team_id));

CREATE POLICY "players_update_self"
  ON players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id  = players.team_id
        AND tm.user_id  = auth.uid()
        AND tm.player_id = players.id
        AND tm.status   = 'active'
    )
  );


-- ============================================================
-- 3. MATCH_ABSENCES — speler mag alleen eigen afwezigheid
-- ============================================================
--
-- Probleem: elk teamlid kon elke speler als afwezig markeren.
--
-- Oplossing: INSERT/UPDATE/DELETE beperken tot eigen player_id
--            of manager (die beheert het voor iedereen).
-- ============================================================

DROP POLICY IF EXISTS "absences_insert" ON match_absences;
DROP POLICY IF EXISTS "absences_update" ON match_absences;
DROP POLICY IF EXISTS "absences_delete" ON match_absences;

CREATE POLICY "absences_insert"
  ON match_absences FOR INSERT
  WITH CHECK (
    -- Manager mag voor iedereen invoeren
    is_team_manager((SELECT team_id FROM matches WHERE id = match_id))
    OR
    -- Speler mag alleen eigen afwezigheid invoeren
    EXISTS (
      SELECT 1 FROM team_members tm
        JOIN matches m ON m.id = match_absences.match_id
      WHERE tm.team_id   = m.team_id
        AND tm.user_id   = auth.uid()
        AND tm.player_id = match_absences.player_id
        AND tm.status    = 'active'
    )
  );

CREATE POLICY "absences_update"
  ON match_absences FOR UPDATE
  USING (
    is_team_manager((SELECT team_id FROM matches WHERE id = match_id))
    OR
    EXISTS (
      SELECT 1 FROM team_members tm
        JOIN matches m ON m.id = match_absences.match_id
      WHERE tm.team_id   = m.team_id
        AND tm.user_id   = auth.uid()
        AND tm.player_id = match_absences.player_id
        AND tm.status    = 'active'
    )
  );

CREATE POLICY "absences_delete"
  ON match_absences FOR DELETE
  USING (
    is_team_manager((SELECT team_id FROM matches WHERE id = match_id))
    OR
    EXISTS (
      SELECT 1 FROM team_members tm
        JOIN matches m ON m.id = match_absences.match_id
      WHERE tm.team_id   = m.team_id
        AND tm.user_id   = auth.uid()
        AND tm.player_id = match_absences.player_id
        AND tm.status    = 'active'
    )
  );


-- ============================================================
-- 4. INVITE_TOKENS — tighter UPDATE + accept_invite() RPC
-- ============================================================
--
-- Probleem: elke ingelogde gebruiker kon elk token als gebruikt markeren,
--           en de used_at-check was alleen client-side (race condition).
--
-- Oplossing:
--   a) UPDATE-policy: used_at IS NULL vereist (server-side)
--   b) accept_invite() RPC: FOR UPDATE lock voorkomt gelijktijdige acceptaties
-- ============================================================

DROP POLICY IF EXISTS "invite_tokens_update" ON invite_tokens;

CREATE POLICY "invite_tokens_update"
  ON invite_tokens FOR UPDATE
  USING (
    is_team_manager(team_id)
    OR (auth.uid() IS NOT NULL AND used_at IS NULL)
  )
  WITH CHECK (
    is_team_manager(team_id)
    OR (auth.uid() IS NOT NULL AND used_by = auth.uid())
  );

-- Atomische RPC: valideert en markeert token in één transactie.
-- FOR UPDATE lock voorkomt dat twee gebruikers tegelijk hetzelfde token accepteren.
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token invite_tokens%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_token
  FROM invite_tokens
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid');
  END IF;

  IF v_token.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'used');
  END IF;

  IF v_token.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  IF v_token.max_uses IS NOT NULL AND COALESCE(v_token.use_count, 0) >= v_token.max_uses THEN
    RETURN jsonb_build_object('error', 'used');
  END IF;

  UPDATE invite_tokens
  SET used_at   = now(),
      used_by   = auth.uid(),
      use_count = COALESCE(use_count, 0) + 1
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ============================================================
-- 5. ACTIVITY_LOG INSERT — via insert_activity() RPC
-- ============================================================
--
-- Probleem: de client stuurde actorId mee, waardoor een speler
--           activiteiten kon loggen alsof een ander het deed.
--
-- Oplossing: insert_activity() RPC leidt actor_id af van auth.uid()
--            via team_members. Directe INSERT-policy wordt verwijderd.
-- ============================================================

CREATE OR REPLACE FUNCTION public.insert_activity(
  p_team_id   uuid,
  p_type      text,
  p_subject_id int     DEFAULT NULL,
  p_match_id   bigint  DEFAULT NULL,
  p_payload    jsonb   DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id int;
BEGIN
  IF NOT is_team_member(p_team_id) THEN
    RAISE EXCEPTION 'Geen toegang tot dit team';
  END IF;

  -- Leid actor_id af van de ingelogde gebruiker (kan NULL zijn voor managers zonder spelerrecord)
  SELECT player_id INTO v_actor_id
  FROM team_members
  WHERE user_id  = auth.uid()
    AND team_id  = p_team_id
    AND status   = 'active'
  LIMIT 1;

  INSERT INTO activity_log (team_id, type, actor_id, subject_id, match_id, payload)
  VALUES (p_team_id, p_type, v_actor_id, p_subject_id, p_match_id, p_payload);
END;
$$;

-- Verwijder directe INSERT-policy: alle nieuwe entries gaan via de RPC
DROP POLICY IF EXISTS "Team members can insert activity" ON activity_log;
DROP POLICY IF EXISTS "activity_insert" ON activity_log;
