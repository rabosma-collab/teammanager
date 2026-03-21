-- ============================================================
-- finalize_match(p_match_id, p_calc_min, p_goals_for, p_goals_ag)
--
-- Sluit een wedstrijd atomisch af:
--   1. Valideert dat de wedstrijd in concept-status is
--   2. Haalt speelduur op uit team_settings (default 60)
--   3. Berekent speelminuten per speler, rotatie-aware
--      (spelers die eruit en erin gaan krijgen correcte totaaltijd)
--   4. Updatet match_status + uitslag in één transactie
--
-- Alle stappen vallen of staan samen: bij een fout worden
-- alle wijzigingen teruggedraaid.
-- ============================================================

CREATE OR REPLACE FUNCTION finalize_match(
  p_match_id  integer,
  p_calc_min  boolean DEFAULT true,
  p_goals_for integer DEFAULT NULL,
  p_goals_ag  integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_status   text;
  v_team_id  uuid;
  v_duration integer;
  v_sub      record;
BEGIN
  -- Stap 1: Vergrendel en valideer de wedstrijd (FOR UPDATE voorkomt race condition)
  SELECT match_status, team_id INTO v_status, v_team_id
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wedstrijd niet gevonden');
  END IF;

  IF v_status <> 'concept' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Wedstrijd is niet in concept-status (huidige status: ' || v_status || ')'
    );
  END IF;

  -- Stap 2: Bereken speelminuten (optioneel)
  IF p_calc_min THEN
    -- Speelduur uit team_settings (default 60 als niet ingesteld)
    SELECT COALESCE(match_duration, 60) INTO v_duration
    FROM team_settings WHERE team_id = v_team_id;
    IF v_duration IS NULL THEN v_duration := 60; END IF;

    -- Verwijder eventueel resterende temp-tabellen van een vorige gefaalde sessie
    DROP TABLE IF EXISTS _pt;
    DROP TABLE IF EXISTS _gids;

    -- Rotatie-aware spelerstabel:
    --   p_min     = geaccumuleerde gespeelde minuten
    --   on_field  = staat momenteel op het veld
    --   entry_min = minuut van laatste betreding
    CREATE TEMP TABLE _pt (
      player_id integer NOT NULL,
      is_guest  boolean NOT NULL DEFAULT false,
      p_min     integer NOT NULL DEFAULT 0,
      on_field  boolean NOT NULL DEFAULT true,
      entry_min integer NOT NULL DEFAULT 0
    ) ON COMMIT DROP;

    -- Basisspelers: allemaal op het veld vanaf minuut 0
    INSERT INTO _pt (player_id, is_guest, p_min, on_field, entry_min)
    SELECT player_id, false, 0, true, 0
    FROM lineups
    WHERE match_id = p_match_id;

    -- Gastspelers met een lineup-positie
    INSERT INTO _pt (player_id, is_guest, p_min, on_field, entry_min)
    SELECT id, true, 0, true, 0
    FROM guest_players
    WHERE match_id = p_match_id
      AND lineup_position IS NOT NULL;

    -- Gastspeler-IDs voor disambiguatie bij wissels
    CREATE TEMP TABLE _gids ON COMMIT DROP AS
    SELECT id FROM guest_players WHERE match_id = p_match_id;

    -- Verwerk wissels op volgorde van minuut
    FOR v_sub IN
      SELECT
        player_out_id,
        player_in_id,
        COALESCE(custom_minute, minute) AS eff_min
      FROM substitutions
      WHERE match_id = p_match_id
      ORDER BY COALESCE(custom_minute, minute) ASC
    LOOP
      -- Speler eruit: accumuleer zijn tijd sinds laatste betreding
      UPDATE _pt
      SET p_min    = p_min + (v_sub.eff_min - entry_min),
          on_field = false
      WHERE player_id = v_sub.player_out_id
        AND on_field = true;

      -- Speler erin: al in tabel (rotatie) → hervat; nieuw → voeg toe
      IF EXISTS (SELECT 1 FROM _pt WHERE player_id = v_sub.player_in_id) THEN
        UPDATE _pt
        SET on_field  = true,
            entry_min = v_sub.eff_min
        WHERE player_id = v_sub.player_in_id;
      ELSE
        INSERT INTO _pt (player_id, is_guest, p_min, on_field, entry_min)
        VALUES (
          v_sub.player_in_id,
          EXISTS(SELECT 1 FROM _gids WHERE id = v_sub.player_in_id),
          0, true, v_sub.eff_min
        );
      END IF;
    END LOOP;

    -- Spelers nog op het veld: sluit af op eindtijd van de wedstrijd
    UPDATE _pt
    SET p_min = p_min + (v_duration - entry_min)
    WHERE on_field = true;

    -- Bankminuten bijwerken voor reguliere spelers (speelduur - gespeeld)
    UPDATE players p
    SET min = p.min + (v_duration - pt.p_min)
    FROM _pt pt
    WHERE p.id = pt.player_id
      AND NOT pt.is_guest
      AND (v_duration - pt.p_min) > 0;

    -- Gespeelde minuten bijwerken voor reguliere spelers
    UPDATE players p
    SET played_min = p.played_min + pt.p_min
    FROM _pt pt
    WHERE p.id = pt.player_id
      AND NOT pt.is_guest;

    -- Bankminuten voor gastspelers
    UPDATE guest_players gp
    SET min = gp.min + (v_duration - pt.p_min)
    FROM _pt pt
    WHERE gp.id = pt.player_id
      AND pt.is_guest
      AND (v_duration - pt.p_min) > 0;
  END IF;

  -- Stap 3: Finaliseer wedstrijd (atomisch met de speeltijd-updates hierboven)
  UPDATE matches
  SET
    match_status  = 'afgerond',
    goals_for     = COALESCE(p_goals_for, goals_for),
    goals_against = COALESCE(p_goals_ag,  goals_against)
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Verleen execute-rechten aan de anon/authenticated rollen die Supabase gebruikt
GRANT EXECUTE ON FUNCTION finalize_match(integer, boolean, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION finalize_match(integer, boolean, integer, integer) TO authenticated;
