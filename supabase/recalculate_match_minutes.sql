-- ============================================================
-- recalculate_match_minutes(p_match_id)
--
-- Herberekent speelminuten voor een AL AFGESLOTEN wedstrijd.
-- Bedoeld voor correctie als finalize_match een oudere versie
-- had (hardcoded 90 min, geen rotatie-support, geen played_min).
--
-- Wat het doet:
--   1. Simuleert wat het OUDE algoritme heeft toegepast op players.min
--      (90 min, single-row, zonder rotatie-correctie)
--   2. Simuleert wat het NIEUWE algoritme zou toepassen
--      (speelduur uit team_settings, rotatie-aware)
--   3. Past de delta toe: min += (nieuw - oud)
--   4. Voegt played_min toe op basis van het nieuwe algoritme
--      (AANNAME: played_min was 0 voor deze wedstrijd, d.w.z.
--       het oude algoritme heeft played_min NIET bijgewerkt)
--
-- ⚠️  NIET IDEMPOTENT — draai dit maximaal één keer per wedstrijd.
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_match_minutes(p_match_id integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_team_id  uuid;
  v_status   text;
  v_duration integer;
  v_sub      record;
BEGIN
  -- Valideer
  SELECT team_id, match_status INTO v_team_id, v_status
  FROM matches WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wedstrijd niet gevonden');
  END IF;

  IF v_status <> 'afgerond' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Gebruik finalize_match voor concept-wedstrijden. Status: ' || v_status);
  END IF;

  -- Speelduur
  SELECT COALESCE(match_duration, 60) INTO v_duration
  FROM team_settings WHERE team_id = v_team_id;
  IF v_duration IS NULL THEN v_duration := 60; END IF;

  DROP TABLE IF EXISTS _old;
  DROP TABLE IF EXISTS _new;
  DROP TABLE IF EXISTS _gids;

  -- Gastspeler-IDs
  CREATE TEMP TABLE _gids ON COMMIT DROP AS
  SELECT id FROM guest_players WHERE match_id = p_match_id;

  -- ─── OUD algoritme (wat de database-versie heeft toegepast) ───
  -- Hardcoded 90 min, single-row per speler, geen rotatie-correctie
  CREATE TEMP TABLE _old (
    player_id integer NOT NULL,
    is_guest  boolean NOT NULL DEFAULT false,
    s         integer NOT NULL DEFAULT 0,   -- start_min
    e         integer NOT NULL DEFAULT 90   -- end_min
  ) ON COMMIT DROP;

  INSERT INTO _old (player_id, is_guest, s, e)
  SELECT player_id, false, 0, 90
  FROM lineups WHERE match_id = p_match_id;

  INSERT INTO _old (player_id, is_guest, s, e)
  SELECT id, true, 0, 90
  FROM guest_players WHERE match_id = p_match_id AND lineup_position IS NOT NULL;

  FOR v_sub IN
    SELECT player_out_id, player_in_id, COALESCE(custom_minute, minute) AS eff_min
    FROM substitutions WHERE match_id = p_match_id
    ORDER BY COALESCE(custom_minute, minute) ASC
  LOOP
    UPDATE _old SET e = v_sub.eff_min WHERE player_id = v_sub.player_out_id;
    IF EXISTS (SELECT 1 FROM _old WHERE player_id = v_sub.player_in_id) THEN
      UPDATE _old SET e = 90 WHERE player_id = v_sub.player_in_id;
    ELSE
      INSERT INTO _old VALUES (
        v_sub.player_in_id,
        EXISTS(SELECT 1 FROM _gids WHERE id = v_sub.player_in_id),
        v_sub.eff_min, 90
      );
    END IF;
  END LOOP;

  -- ─── NIEUW algoritme (correct: speelduur + rotatie-aware) ───
  CREATE TEMP TABLE _new (
    player_id integer NOT NULL,
    is_guest  boolean NOT NULL DEFAULT false,
    p_min     integer NOT NULL DEFAULT 0,
    on_field  boolean NOT NULL DEFAULT true,
    entry_min integer NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  INSERT INTO _new (player_id, is_guest, p_min, on_field, entry_min)
  SELECT player_id, false, 0, true, 0
  FROM lineups WHERE match_id = p_match_id;

  INSERT INTO _new (player_id, is_guest, p_min, on_field, entry_min)
  SELECT id, true, 0, true, 0
  FROM guest_players WHERE match_id = p_match_id AND lineup_position IS NOT NULL;

  FOR v_sub IN
    SELECT player_out_id, player_in_id, COALESCE(custom_minute, minute) AS eff_min
    FROM substitutions WHERE match_id = p_match_id
    ORDER BY COALESCE(custom_minute, minute) ASC
  LOOP
    UPDATE _new
    SET p_min = p_min + (v_sub.eff_min - entry_min), on_field = false
    WHERE player_id = v_sub.player_out_id AND on_field = true;

    IF EXISTS (SELECT 1 FROM _new WHERE player_id = v_sub.player_in_id) THEN
      UPDATE _new SET on_field = true, entry_min = v_sub.eff_min
      WHERE player_id = v_sub.player_in_id;
    ELSE
      INSERT INTO _new VALUES (
        v_sub.player_in_id,
        EXISTS(SELECT 1 FROM _gids WHERE id = v_sub.player_in_id),
        0, true, v_sub.eff_min
      );
    END IF;
  END LOOP;

  UPDATE _new
  SET p_min = p_min + (v_duration - entry_min)
  WHERE on_field = true;

  -- ─── Delta toepassen op players.min ───
  -- Trek de foutieve bankminuten (oud, 90-min) af en tel de correcte op
  UPDATE players p
  SET min = GREATEST(0,
    p.min
    - GREATEST(0, 90 - (o.e - o.s))   -- oud algoritme had dit toegevoegd
    + GREATEST(0, v_duration - n.p_min) -- nieuw correct
  )
  FROM _old o
  JOIN _new n ON n.player_id = o.player_id
  WHERE p.id = o.player_id
    AND NOT o.is_guest;

  -- ─── played_min toevoegen ───
  -- Aanname: played_min was 0 voor deze wedstrijd (niet toegepast door oud algoritme)
  UPDATE players p
  SET played_min = p.played_min + n.p_min
  FROM _new n
  WHERE p.id = n.player_id
    AND NOT n.is_guest;

  RETURN jsonb_build_object('success', true, 'match_duration_used', v_duration);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION recalculate_match_minutes(integer) TO anon;
GRANT EXECUTE ON FUNCTION recalculate_match_minutes(integer) TO authenticated;
