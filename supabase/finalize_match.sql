-- ============================================================
-- finalize_match(p_match_id, p_calc_min, p_goals_for, p_goals_ag)
--
-- Sluit een wedstrijd atomisch af:
--   1. Valideert dat de wedstrijd in concept-status is
--   2. Berekent optioneel wisselminuten per speler
--   3. Updatet match_status + uitslag in één transactie
--
-- Alle stappen vallen of staan samen: bij een fout worden
-- alle wijzigingen teruggedraaid (sub-transactie semantiek).
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
  v_status text;
  v_sub    record;
BEGIN
  -- Stap 1: Vergrendel en valideer de wedstrijd (FOR UPDATE voorkomt race condition)
  SELECT match_status INTO v_status
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

  -- Stap 2: Bereken wisselminuten (optioneel)
  IF p_calc_min THEN
    -- Verwijder eventueel resterende temp-tabellen van een vorige gefaalde sessie
    DROP TABLE IF EXISTS _pt;
    DROP TABLE IF EXISTS _gids;

    -- Speeltijden per speler: start en end minuut
    CREATE TEMP TABLE _pt (
      player_id integer NOT NULL,
      is_guest  boolean NOT NULL DEFAULT false,
      start_min integer NOT NULL DEFAULT 0,
      end_min   integer NOT NULL DEFAULT 90
    ) ON COMMIT DROP;

    -- Basisspelers vanuit de lineups tabel (reguliere spelers)
    INSERT INTO _pt (player_id, is_guest, start_min, end_min)
    SELECT player_id, false, 0, 90
    FROM lineups
    WHERE match_id = p_match_id;

    -- Gastspelers met een lineup-positie voor deze wedstrijd
    INSERT INTO _pt (player_id, is_guest, start_min, end_min)
    SELECT id, true, 0, 90
    FROM guest_players
    WHERE match_id = p_match_id
      AND lineup_position IS NOT NULL;

    -- Verzamel gastspeler-IDs voor deze wedstrijd (om wissels te disambigueren)
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
      -- Speler eruit: trim zijn eindminuut
      UPDATE _pt
      SET end_min = v_sub.eff_min
      WHERE player_id = v_sub.player_out_id;

      -- Speler erin: voeg toe of update
      IF EXISTS (SELECT 1 FROM _pt WHERE player_id = v_sub.player_in_id) THEN
        -- Speler stond al in tabel (bijv. terug na blessure) → reset eindminuut
        UPDATE _pt SET end_min = 90 WHERE player_id = v_sub.player_in_id;
      ELSE
        INSERT INTO _pt (player_id, is_guest, start_min, end_min)
        VALUES (
          v_sub.player_in_id,
          EXISTS(SELECT 1 FROM _gids WHERE id = v_sub.player_in_id),
          v_sub.eff_min,
          90
        );
      END IF;
    END LOOP;

    -- Bereken bankminuten = 90 - gespeeld en update reguliere spelers
    -- (bankminuten > 0 betekent: niet het hele spel gespeeld)
    UPDATE players p
    SET min = p.min + (90 - (pt.end_min - pt.start_min))
    FROM _pt pt
    WHERE p.id = pt.player_id
      AND NOT pt.is_guest
      AND (90 - (pt.end_min - pt.start_min)) > 0;

    -- Zelfde voor gastspelers
    UPDATE guest_players gp
    SET min = gp.min + (90 - (pt.end_min - pt.start_min))
    FROM _pt pt
    WHERE gp.id = pt.player_id
      AND pt.is_guest
      AND (90 - (pt.end_min - pt.start_min)) > 0;
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
  -- PostgreSQL rolt automatisch alle wijzigingen in dit BEGIN-blok terug.
  -- Temp-tabellen (_pt, _gids) zijn ook teruggedraaid (sub-transactie semantiek).
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Verleen execute-rechten aan de anon/authenticated rollen die Supabase gebruikt
GRANT EXECUTE ON FUNCTION finalize_match(integer, boolean, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION finalize_match(integer, boolean, integer, integer) TO authenticated;
