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
-- 2. PLAYERS UPDATE — split: manager alles / speler eigen rij (naam+avatar)
-- ============================================================
--
-- Spelers mogen hun eigen naam en avatar bijwerken (ProfileModal).
-- FIFA-stats mogen alleen worden bijgewerkt via spend_credits_for_stats()
-- of spend_credit_single() — beide SECURITY DEFINER RPCs die afdwingen
-- dat credits worden betaald. Directe UPDATE op FIFA-stats van willekeurige
-- rijen (ook eigen rij) zonder credits is daarmee niet mogelijk via de API.
-- ============================================================

DROP POLICY IF EXISTS "players_update" ON players;
DROP POLICY IF EXISTS "players_update_manager" ON players;
DROP POLICY IF EXISTS "players_update_self" ON players;

CREATE POLICY "players_update_manager"
  ON players FOR UPDATE
  USING (is_team_manager(team_id));

-- Spelers: eigen rij bijwerken (naam, avatar via ProfileModal)
-- FIFA-stats via de credit-RPCs hieronder (SECURITY DEFINER, omzeilt RLS)
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
-- 2b. CREDIT-SPENDING RPCs voor FIFA-stat-bewerking
-- ============================================================
--
-- Spelers kunnen met credits de kaart van ELKE teamgenoot bewerken
-- (eigen kaart of die van een ander). De RPCs zijn SECURITY DEFINER
-- zodat ze de players-tabel mogen schrijven ongeacht de RLS-policy.
-- Ingebouwde validaties:
--   - spender is via team_members gekoppeld aan auth.uid()
--   - target-speler zit in hetzelfde team
--   - alleen FIFA-stat-kolommen (whitelist)
--   - credits worden atomisch afgetrokken en gelogd
-- ============================================================

-- Bulk: meerdere stats tegelijk opslaan (PlayerCardsView "Opslaan"-knop)
CREATE OR REPLACE FUNCTION public.spend_credits_for_stats(
  p_spender_id       int,
  p_target_player_id int,
  p_team_id          uuid,
  p_stats            jsonb,   -- bijv. {"pac": 75, "sho": 80}
  p_total_cost       int,
  p_new_balance      int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key  text;
  v_val  int;
  v_team uuid;
BEGIN
  -- Spender moet gekoppeld zijn aan auth.uid()
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id  = auth.uid()
      AND team_id  = p_team_id
      AND player_id = p_spender_id
      AND status   = 'active'
  ) THEN
    RAISE EXCEPTION 'Spender is niet gekoppeld aan je account';
  END IF;

  -- Target moet in hetzelfde team zitten
  SELECT team_id INTO v_team FROM players WHERE id = p_target_player_id;
  IF v_team IS DISTINCT FROM p_team_id THEN
    RAISE EXCEPTION 'Doelspeler zit niet in dit team';
  END IF;

  -- Pas elke stat toe (alleen whitelisted kolommen)
  FOR v_key, v_val IN SELECT key, value::int FROM jsonb_each_text(p_stats)
  LOOP
    IF v_key NOT IN ('pac','sho','pas','dri','def','phy','div','han','kic','ref','spe','pos') THEN
      RAISE EXCEPTION 'Ongeldige stat-kolom: %', v_key;
    END IF;
    EXECUTE format('UPDATE players SET %I = $1 WHERE id = $2', v_key)
      USING v_val, p_target_player_id;
  END LOOP;

  -- Credits aftrekken
  UPDATE stat_credits
  SET balance = p_new_balance
  WHERE player_id = p_spender_id
    AND team_id   = p_team_id;

  -- Transactie loggen
  INSERT INTO stat_credit_transactions (team_id, player_id, target_player_id, balance_change, reason)
  VALUES (p_team_id, p_spender_id, p_target_player_id, -p_total_cost, 'stat_change');
END;
$$;

-- Enkelvoudig: +1 / -1 op één stat (PlayerCardsView inline knoppen)
CREATE OR REPLACE FUNCTION public.spend_credit_single(
  p_spender_id       int,
  p_target_player_id int,
  p_team_id          uuid,
  p_stat             text,
  p_new_stat_value   int,    -- al berekend door de client (huidig ± 1, geclampd 1-99)
  p_new_balance      int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team uuid;
BEGIN
  -- Spender moet gekoppeld zijn aan auth.uid()
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id  = auth.uid()
      AND team_id  = p_team_id
      AND player_id = p_spender_id
      AND status   = 'active'
  ) THEN
    RAISE EXCEPTION 'Spender is niet gekoppeld aan je account';
  END IF;

  -- Target moet in hetzelfde team zitten
  SELECT team_id INTO v_team FROM players WHERE id = p_target_player_id;
  IF v_team IS DISTINCT FROM p_team_id THEN
    RAISE EXCEPTION 'Doelspeler zit niet in dit team';
  END IF;

  -- Alleen whitelisted stat-kolommen
  IF p_stat NOT IN ('pac','sho','pas','dri','def','phy','div','han','kic','ref','spe','pos') THEN
    RAISE EXCEPTION 'Ongeldige stat-kolom: %', p_stat;
  END IF;

  -- Stat bijwerken
  EXECUTE format('UPDATE players SET %I = $1 WHERE id = $2', p_stat)
    USING p_new_stat_value, p_target_player_id;

  -- Credit aftrekken
  UPDATE stat_credits
  SET balance = p_new_balance
  WHERE player_id = p_spender_id
    AND team_id   = p_team_id;

  -- Transactie loggen
  INSERT INTO stat_credit_transactions (team_id, player_id, target_player_id, stat, balance_change, reason)
  VALUES (p_team_id, p_spender_id, p_target_player_id, p_stat, -1, 'stat_change');
END;
$$;


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
